"""Initial schema for users, sessions, queries, sources, documents, claims, evidence, citations, contradictions, topologies, and document_chunks.

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-09-01 12:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import pgvector
from pgvector.sqlalchemy import Vector
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Extensions (for PostgreSQL)
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # 2. Users Table
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("preferences", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # 3. Research Sessions Table
    op.create_table(
        "research_sessions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("mode", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_sessions_user_updated", "research_sessions", ["user_id", "updated_at"], unique=False)
    op.create_index(op.f("ix_research_sessions_user_id"), "research_sessions", ["user_id"], unique=False)

    # 4. Queries Table
    op.create_table(
        "queries",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("session_id", sa.String(length=64), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("synthesized_text", sa.Text(), nullable=True),
        sa.Column("intent", sa.String(length=50), nullable=True),
        sa.Column("domain", sa.String(length=50), nullable=True),
        sa.Column("complexity", sa.String(length=50), nullable=True),
        sa.Column("egi_score", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("token_usage", sa.JSON(), nullable=True),
        sa.Column("stage_timings", sa.JSON(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["research_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_queries_session_created", "queries", ["session_id", "created_at"], unique=False)
    op.create_index(op.f("ix_queries_session_id"), "queries", ["session_id"], unique=False)

    # 5. Sources Table
    op.create_table(
        "sources",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("session_id", sa.String(length=64), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("url_hash", sa.String(length=64), nullable=False),
        sa.Column("canonical_url", sa.Text(), nullable=True),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=True),
        sa.Column("published_date", sa.String(length=100), nullable=True),
        sa.Column("authority_score", sa.Float(), nullable=False),
        sa.Column("snippet", sa.Text(), nullable=True),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["research_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_sources_session_domain", "sources", ["session_id", "domain"], unique=False)
    op.create_index("idx_sources_url_hash", "sources", ["url_hash"], unique=False)
    op.create_index(op.f("ix_sources_domain"), "sources", ["domain"], unique=False)
    op.create_index(op.f("ix_sources_session_id"), "sources", ["session_id"], unique=False)
    op.create_index(op.f("ix_sources_url_hash"), "sources", ["url_hash"], unique=False)

    # 6. Documents Table
    op.create_table(
        "documents",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=True),
        sa.Column("session_id", sa.String(length=64), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("raw_content", sa.Text(), nullable=True),
        sa.Column("cleaned_text", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("char_count", sa.Integer(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["research_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_documents_session_hash", "documents", ["session_id", "content_hash"], unique=False)
    op.create_index(op.f("ix_documents_content_hash"), "documents", ["content_hash"], unique=False)
    op.create_index(op.f("ix_documents_session_id"), "documents", ["session_id"], unique=False)
    op.create_index(op.f("ix_documents_source_id"), "documents", ["source_id"], unique=False)

    # 7. Claims Table
    op.create_table(
        "claims",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("query_id", sa.String(length=64), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("importance", sa.String(length=20), nullable=False),
        sa.Column("sentence_index", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["query_id"], ["queries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_claims_query_status", "claims", ["query_id", "status"], unique=False)
    op.create_index(op.f("ix_claims_query_id"), "claims", ["query_id"], unique=False)
    op.create_index(op.f("ix_claims_status"), "claims", ["status"], unique=False)

    # 8. Evidence Table
    op.create_table(
        "evidence",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("document_id", sa.String(length=64), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("relevance_score", sa.Float(), nullable=False),
        sa.Column("char_start", sa.Integer(), nullable=True),
        sa.Column("char_end", sa.Integer(), nullable=True),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("bounding_box", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_evidence_document_id", "evidence", ["document_id"], unique=False)
    op.create_index("idx_evidence_source_id", "evidence", ["source_id"], unique=False)
    op.create_index(op.f("ix_evidence_document_id"), "evidence", ["document_id"], unique=False)
    op.create_index(op.f("ix_evidence_source_id"), "evidence", ["source_id"], unique=False)

    # 9. Citations Table
    op.create_table(
        "citations",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("query_id", sa.String(length=64), nullable=False),
        sa.Column("claim_id", sa.String(length=64), nullable=False),
        sa.Column("evidence_id", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("inline_marker", sa.String(length=50), nullable=False),
        sa.Column("citation_index", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["claim_id"], ["claims.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["evidence_id"], ["evidence.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["query_id"], ["queries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_citations_claim_evidence", "citations", ["claim_id", "evidence_id"], unique=False)
    op.create_index("idx_citations_query_claim", "citations", ["query_id", "claim_id"], unique=False)
    op.create_index(op.f("ix_citations_claim_id"), "citations", ["claim_id"], unique=False)
    op.create_index(op.f("ix_citations_evidence_id"), "citations", ["evidence_id"], unique=False)
    op.create_index(op.f("ix_citations_query_id"), "citations", ["query_id"], unique=False)
    op.create_index(op.f("ix_citations_source_id"), "citations", ["source_id"], unique=False)

    # 10. Contradictions Table
    op.create_table(
        "contradictions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("query_id", sa.String(length=64), nullable=False),
        sa.Column("claim_id", sa.String(length=64), nullable=True),
        sa.Column("evidence_a_id", sa.String(length=64), nullable=False),
        sa.Column("evidence_b_id", sa.String(length=64), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["claim_id"], ["claims.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["evidence_a_id"], ["evidence.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["evidence_b_id"], ["evidence.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["query_id"], ["queries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_contradictions_query_severity", "contradictions", ["query_id", "severity"], unique=False)
    op.create_index(op.f("ix_contradictions_claim_id"), "contradictions", ["claim_id"], unique=False)
    op.create_index(op.f("ix_contradictions_query_id"), "contradictions", ["query_id"], unique=False)

    # 11. Evidence Graph Topologies Table
    op.create_table(
        "evidence_graph_topologies",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("query_id", sa.String(length=64), nullable=False),
        sa.Column("node_count", sa.Integer(), nullable=False),
        sa.Column("edge_count", sa.Integer(), nullable=False),
        sa.Column("density", sa.Float(), nullable=False),
        sa.Column("cluster_count", sa.Integer(), nullable=False),
        sa.Column("graph_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["query_id"], ["queries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_evidence_graph_topologies_query_id"), "evidence_graph_topologies", ["query_id"], unique=True)

    # 12. Document Chunks Table (for pgvector)
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("document_id", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=True),
        sa.Column("session_id", sa.String(length=64), nullable=True),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("searchable_text", sa.Text(), nullable=False),
        sa.Column("section_title", sa.String(length=255), nullable=True),
        sa.Column("section_path", sa.JSON(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("bbox", sa.JSON(), nullable=True),
        sa.Column("char_start", sa.Integer(), nullable=True),
        sa.Column("char_end", sa.Integer(), nullable=True),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("tsv", postgresql.TSVECTOR(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["research_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_chunks_session_doc", "document_chunks", ["session_id", "document_id"], unique=False)
    op.create_index(op.f("ix_document_chunks_document_id"), "document_chunks", ["document_id"], unique=False)
    op.create_index(op.f("ix_document_chunks_session_id"), "document_chunks", ["session_id"], unique=False)
    op.create_index(op.f("ix_document_chunks_source_id"), "document_chunks", ["source_id"], unique=False)


def downgrade() -> None:
    op.drop_table("document_chunks")
    op.drop_table("evidence_graph_topologies")
    op.drop_table("contradictions")
    op.drop_table("citations")
    op.drop_table("evidence")
    op.drop_table("claims")
    op.drop_table("documents")
    op.drop_table("sources")
    op.drop_table("queries")
    op.drop_table("research_sessions")
    op.drop_table("users")
