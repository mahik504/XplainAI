"""Topology ORM entity storing 3D constellation & 2D DAG cached graph layouts."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neural_navigator.infrastructure.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from neural_navigator.infrastructure.db.models.query import Query


class EvidenceGraphTopology(Base, TimestampMixin):
    __tablename__ = "evidence_graph_topologies"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # 'top_...'
    query_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("queries.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    node_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    edge_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    density: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    cluster_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Serialized graph nodes (with 3D positions) and edges
    graph_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    query: Mapped[Query] = relationship("Query", back_populates="topology")
