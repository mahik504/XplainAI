"""SQLite-backed conversation persistence (multi-tenant isolated)."""

from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pathlib import Path


def _utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


@dataclass(slots=True)
class ConversationSummary:
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int
    user_id: str = "anonymous"

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "message_count": self.message_count,
            "user_id": self.user_id,
        }


class ConversationStore:
    def __init__(self, db_path: Path) -> None:
        self._path = db_path
        self._lock = Lock()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        return connection

    def _init_schema(self) -> None:
        with self._lock, self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL DEFAULT 'anonymous',
                    title TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_conversations_user
                    ON conversations(user_id, updated_at DESC);
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    pipeline_state TEXT,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_messages_conversation
                    ON messages(conversation_id, id);
                """
            )
            # Automatic column migration if table existed prior to user_id addition
            pragma_info = connection.execute("PRAGMA table_info(conversations)").fetchall()
            existing_cols = {row["name"] for row in pragma_info}
            if "user_id" not in existing_cols:
                connection.execute(
                    "ALTER TABLE conversations ADD COLUMN user_id TEXT NOT NULL DEFAULT 'anonymous'"
                )

    @staticmethod
    def title_from_prompt(prompt: str) -> str:
        cleaned = " ".join(prompt.strip().split())
        if not cleaned:
            return "New conversation"
        return cleaned[:64] + ("…" if len(cleaned) > 64 else "")

    def create(
        self, *, title: str | None = None, user_id: str = "anonymous"
    ) -> ConversationSummary:
        conversation_id = str(uuid.uuid4())
        now = _utc_now()
        resolved = title.strip() if title and title.strip() else "New conversation"
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                INSERT INTO conversations (id, user_id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (conversation_id, user_id, resolved, now, now),
            )
        return ConversationSummary(
            id=conversation_id,
            title=resolved,
            created_at=now,
            updated_at=now,
            message_count=0,
            user_id=user_id,
        )

    def list(self, *, user_id: str | None = None, limit: int = 50) -> list[ConversationSummary]:
        with self._lock, self._connect() as connection:
            if user_id is not None:
                rows = connection.execute(
                    """
                    SELECT c.id, c.user_id, c.title, c.created_at, c.updated_at,
                           COUNT(m.id) AS message_count
                    FROM conversations c
                    LEFT JOIN messages m ON m.conversation_id = c.id
                    WHERE c.user_id = ?
                    GROUP BY c.id
                    ORDER BY c.updated_at DESC
                    LIMIT ?
                    """,
                    (user_id, limit),
                ).fetchall()
            else:
                rows = connection.execute(
                    """
                    SELECT c.id, c.user_id, c.title, c.created_at, c.updated_at,
                           COUNT(m.id) AS message_count
                    FROM conversations c
                    LEFT JOIN messages m ON m.conversation_id = c.id
                    GROUP BY c.id
                    ORDER BY c.updated_at DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()
        return [
            ConversationSummary(
                id=row["id"],
                title=row["title"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                message_count=int(row["message_count"]),
                user_id=row["user_id"],
            )
            for row in rows
        ]

    def get(self, conversation_id: str, *, user_id: str | None = None) -> dict[str, Any] | None:
        with self._lock, self._connect() as connection:
            if user_id is not None:
                conversation = connection.execute(
                    """
                    SELECT id, user_id, title, created_at, updated_at
                    FROM conversations WHERE id = ? AND user_id = ?
                    """,
                    (conversation_id, user_id),
                ).fetchone()
            else:
                conversation = connection.execute(
                    """
                    SELECT id, user_id, title, created_at, updated_at
                    FROM conversations WHERE id = ?
                    """,
                    (conversation_id,),
                ).fetchone()

            if conversation is None:
                return None

            messages = connection.execute(
                """
                SELECT id, role, content, pipeline_state, created_at
                FROM messages
                WHERE conversation_id = ?
                ORDER BY id ASC
                """,
                (conversation_id,),
            ).fetchall()

        return {
            "id": conversation["id"],
            "user_id": conversation["user_id"],
            "title": conversation["title"],
            "created_at": conversation["created_at"],
            "updated_at": conversation["updated_at"],
            "messages": [
                {
                    "id": str(row["id"]),
                    "role": row["role"],
                    "content": row["content"],
                    "pipeline_state": json.loads(row["pipeline_state"])
                    if row["pipeline_state"]
                    else None,
                    "created_at": row["created_at"],
                }
                for row in messages
            ],
        }

    def delete(self, conversation_id: str, *, user_id: str | None = None) -> bool:
        with self._lock, self._connect() as connection:
            if user_id is not None:
                cursor = connection.execute(
                    "DELETE FROM conversations WHERE id = ? AND user_id = ?",
                    (conversation_id, user_id),
                )
            else:
                cursor = connection.execute(
                    "DELETE FROM conversations WHERE id = ?",
                    (conversation_id,),
                )
            return cursor.rowcount > 0

    def rename(self, conversation_id: str, title: str, *, user_id: str | None = None) -> bool:
        cleaned = title.strip() or "New conversation"
        with self._lock, self._connect() as connection:
            if user_id is not None:
                cursor = connection.execute(
                    """
                    UPDATE conversations SET title = ?, updated_at = ?
                    WHERE id = ? AND user_id = ?
                    """,
                    (cleaned[:80], _utc_now(), conversation_id, user_id),
                )
            else:
                cursor = connection.execute(
                    "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                    (cleaned[:80], _utc_now(), conversation_id),
                )
            return cursor.rowcount > 0

    def append_message(
        self,
        conversation_id: str,
        *,
        role: str,
        content: str,
        pipeline_state: dict[str, Any] | None = None,
        title_if_empty: str | None = None,
        user_id: str | None = None,
    ) -> None:
        now = _utc_now()
        payload = json.dumps(pipeline_state) if pipeline_state else None
        with self._lock, self._connect() as connection:
            if user_id is not None:
                conversation = connection.execute(
                    "SELECT id, title FROM conversations WHERE id = ? AND user_id = ?",
                    (conversation_id, user_id),
                ).fetchone()
            else:
                conversation = connection.execute(
                    "SELECT id, title FROM conversations WHERE id = ?",
                    (conversation_id,),
                ).fetchone()

            if conversation is None:
                raise KeyError(conversation_id)

            connection.execute(
                """
                INSERT INTO messages (conversation_id, role, content, pipeline_state, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (conversation_id, role, content, payload, now),
            )
            new_title = conversation["title"]
            if title_if_empty and conversation["title"] == "New conversation" and role == "user":
                new_title = self.title_from_prompt(title_if_empty)
            connection.execute(
                "UPDATE conversations SET updated_at = ?, title = ? WHERE id = ?",
                (now, new_title, conversation_id),
            )
