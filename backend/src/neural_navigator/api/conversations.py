"""REST API for conversation history."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/conversations", tags=["conversations"])


class CreateConversationBody(BaseModel):
    title: str | None = Field(default=None, max_length=120)


class RenameConversationBody(BaseModel):
    title: str = Field(min_length=1, max_length=120)


def _store(request: Request) -> Any:
    store = getattr(request.app.state, "conversation_store", None)
    if store is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Conversation store unavailable.",
        )
    return store


@router.get("")
async def list_conversations(request: Request) -> dict[str, Any]:
    store = _store(request)
    items = [item.as_dict() for item in store.list()]
    return {"items": items}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    request: Request, body: CreateConversationBody | None = None
) -> dict[str, Any]:
    store = _store(request)
    created = store.create(title=body.title if body else None)
    return created.as_dict()


@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str, request: Request) -> dict[str, Any]:
    store = _store(request)
    payload = store.get(conversation_id)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return payload


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(conversation_id: str, request: Request) -> None:
    store = _store(request)
    if not store.delete(conversation_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")


@router.patch("/{conversation_id}")
async def rename_conversation(
    conversation_id: str, body: RenameConversationBody, request: Request
) -> dict[str, Any]:
    store = _store(request)
    if not store.rename(conversation_id, body.title):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    payload = store.get(conversation_id)
    assert payload is not None
    return {
        "id": payload["id"],
        "title": payload["title"],
        "created_at": payload["created_at"],
        "updated_at": payload["updated_at"],
        "message_count": len(payload["messages"]),
    }
