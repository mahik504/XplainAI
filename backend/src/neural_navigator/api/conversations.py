"""REST API for conversation history."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from neural_navigator.core.dependencies import PrincipalDep
from neural_navigator.services.conversations import ConversationStore

router = APIRouter(prefix="/conversations", tags=["conversations"])


class CreateConversationBody(BaseModel):
    title: str | None = Field(default=None, max_length=120)


class RenameConversationBody(BaseModel):
    title: str = Field(min_length=1, max_length=120)


def _store(request: Request) -> ConversationStore:
    store: ConversationStore | None = getattr(request.app.state, "conversation_store", None)
    if store is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Conversation store unavailable.",
        )
    return store


@router.get("")
async def list_conversations(
    request: Request,
    principal: PrincipalDep,
) -> dict[str, Any]:
    store = _store(request)
    items = [item.as_dict() for item in store.list(user_id=principal.subject)]
    return {"items": items}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    request: Request,
    principal: PrincipalDep,
    body: CreateConversationBody | None = None,
) -> dict[str, Any]:
    store = _store(request)
    created = store.create(
        title=body.title if body else None,
        user_id=principal.subject,
    )
    return created.as_dict()


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    request: Request,
    principal: PrincipalDep,
) -> dict[str, Any]:
    store = _store(request)
    payload = store.get(conversation_id, user_id=principal.subject)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return payload


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    request: Request,
    principal: PrincipalDep,
) -> None:
    store = _store(request)
    if not store.delete(conversation_id, user_id=principal.subject):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")


@router.patch("/{conversation_id}")
async def rename_conversation(
    conversation_id: str,
    body: RenameConversationBody,
    request: Request,
    principal: PrincipalDep,
) -> dict[str, Any]:
    store = _store(request)
    if not store.rename(conversation_id, body.title, user_id=principal.subject):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    payload = store.get(conversation_id, user_id=principal.subject)
    assert payload is not None
    return {
        "id": payload["id"],
        "user_id": payload.get("user_id", principal.subject),
        "title": payload["title"],
        "created_at": payload["created_at"],
        "updated_at": payload["updated_at"],
        "message_count": len(payload["messages"]),
    }
