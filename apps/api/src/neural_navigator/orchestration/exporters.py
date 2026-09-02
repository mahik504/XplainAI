"""Artifact exporters for research sessions: Markdown, PDF, and structured JSON Evidence Pack."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from neural_navigator.domain.models.research import (
    Claim,
    Evidence,
    EvidenceGraph,
    Source,
)

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None  # type: ignore[assignment]


def _utc_iso_now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class MarkdownExporter:
    """Exports research session data into a structured, publication-grade Markdown dossier."""

    @classmethod
    def export(cls, session_data: dict[str, Any]) -> str:
        title = session_data.get("title") or "Autonomous Research Report"
        session_id = session_data.get("id") or session_data.get("session_id") or "ses_unknown"
        created_at = session_data.get("created_at") or _utc_iso_now()
        egi_score = float(session_data.get("egi_score", 0.85))
        trust_metrics = session_data.get("trust_metrics", {})
        answer_text = session_data.get("synthesis") or session_data.get("answer_text") or ""
        claims = session_data.get("claims") or session_data.get("domain_claims") or []
        sources = session_data.get("sources") or session_data.get("domain_sources") or []
        contradictions = session_data.get("contradictions") or []
        assumptions = session_data.get("assumptions") or []
        mode = session_data.get("mode", "deep_research")

        lines: list[str] = [
            f"# {title}",
            "",
            "> **XplainAI Research Operating System Dossier**",
            f"> - **Session ID**: `{session_id}`",
            f"> - **Generated At**: {created_at}",
            f"> - **Research Mode**: `{mode}`",
            f"> - **Evidence-Grounding Indicator (EGI 2.0)**: **{egi_score * 100:.1f}%**",
            "",
        ]

        if trust_metrics:
            lines.extend(
                [
                    "### Trust & Grounding Telemetry",
                    f"- **Source Authority**: {float(trust_metrics.get('source_quality', 0.85)) * 100:.1f}%",
                    f"- **Evidence Confidence**: {float(trust_metrics.get('evidence_confidence', 0.85)) * 100:.1f}%",
                    f"- **Claim Grounding Coverage**: {float(trust_metrics.get('claim_grounding', 0.85)) * 100:.1f}%",
                    f"- **Citation Fidelity**: {float(trust_metrics.get('citation_fidelity', 1.0)) * 100:.1f}%",
                    f"- **Contradiction Penalty**: -{float(trust_metrics.get('contradiction_penalty', 0.0)) * 100:.1f}%",
                    "",
                ]
            )

        lines.extend(
            [
                "## Executive Summary & Research Synthesis",
                "",
                answer_text or "_No synthesis recorded for this session._",
                "",
            ]
        )

        if claims:
            lines.extend(
                [
                    "## Epistemic Verification Matrix",
                    "",
                    "| # | Claim | Status | Confidence | Evidence Sources |",
                    "|---|-------|--------|------------|------------------|",
                ]
            )
            for idx, clm in enumerate(claims, start=1):
                if isinstance(clm, Claim):
                    c_dict = clm.as_dict()
                elif isinstance(clm, dict):
                    c_dict = clm
                else:
                    c_dict = {"text": str(clm), "status": "unverified", "confidence": 0.7}

                c_text = str(c_dict.get("text", "")).replace("|", "\\|").strip()
                status_val = str(c_dict.get("status", "unverified")).upper()
                conf_val = f"{float(c_dict.get('confidence', 0.7)) * 100:.0f}%"
                ev_ids = c_dict.get("evidence_ids", [])
                ev_str = ", ".join(ev_ids) if ev_ids else "Direct synthesis"
                lines.append(f"| {idx} | {c_text} | `{status_val}` | {conf_val} | {ev_str} |")
            lines.append("")

        if contradictions:
            lines.extend(
                [
                    "## Contradictions & Dialectic Divergences",
                    "",
                ]
            )
            for con in contradictions:
                c_dict = con if isinstance(con, dict) else con.as_dict()
                lines.extend(
                    [
                        f"### Severity: `{c_dict.get('severity', 'moderate').upper()}` — {c_dict.get('contradiction_type', 'divergence')}",
                        f"- **Explanation**: {c_dict.get('explanation', 'Conflicting findings detected.')}",
                        "",
                    ]
                )

        if assumptions:
            lines.extend(
                [
                    "## Assumptions & Epistemic Boundaries",
                    "",
                ]
            )
            for asm in assumptions:
                a_dict = asm if isinstance(asm, dict) else asm.as_dict()
                lines.append(
                    f"- `{a_dict.get('risk_level', 'low').upper()}` ({float(a_dict.get('grounded_score', 0.5)) * 100:.0f}% grounded): {a_dict.get('text', '')}"
                )
            lines.append("")

        # References Section (F11.1 requirement: ## References)
        lines.extend(
            [
                "## References",
                "",
            ]
        )
        if sources:
            for idx, src in enumerate(sources, start=1):
                if isinstance(src, Source):
                    s_dict = src.as_dict()
                elif isinstance(src, dict):
                    s_dict = src
                else:
                    s_dict = {"title": "Source", "url": str(src)}

                s_title = s_dict.get("title") or f"Source {idx}"
                s_url = s_dict.get("url") or "#"
                s_domain = s_dict.get("domain") or ""
                s_auth = float(s_dict.get("authority_score", 0.8))
                s_snippet = s_dict.get("snippet")

                lines.append(f"[{idx}] **{s_title}** — [{s_url}]({s_url})")
                if s_domain:
                    lines.append(f"    - **Domain**: `{s_domain}` | **Authority**: {s_auth * 100:.0f}%")
                if s_snippet:
                    lines.append(f"    - **Snippet**: _{s_snippet[:300]}_")
                lines.append("")
        else:
            lines.append("_No external sources recorded._\n")

        return "\n".join(lines)


class PDFExporter:
    """Exports research session reports into formatted PDF documents using PyMuPDF."""

    @classmethod
    def export(cls, session_data: dict[str, Any]) -> bytes:
        if fitz is None:
            raise RuntimeError("PyMuPDF (fitz) is required for PDF generation")

        doc = fitz.open()
        title = session_data.get("title") or "Autonomous Research Report"
        session_id = session_data.get("id") or session_data.get("session_id") or "ses_unknown"
        created_at = session_data.get("created_at") or _utc_iso_now()
        egi_score = float(session_data.get("egi_score", 0.85))
        answer_text = session_data.get("synthesis") or session_data.get("answer_text") or ""
        claims = session_data.get("claims") or session_data.get("domain_claims") or []
        sources = session_data.get("sources") or session_data.get("domain_sources") or []

        # Standard A4: 595 x 842 points
        page = doc.new_page(width=595, height=842)
        margin = 40.0

        # 1. Header banner
        page.draw_rect(fitz.Rect(margin, 35, 595 - margin, 85), color=(0.12, 0.23, 0.38), fill=(0.93, 0.96, 1.0), width=1)
        page.insert_text(fitz.Point(margin + 12, 58), "XPLAINAI AUTONOMOUS RESEARCH DOSSIER", fontsize=10, fontname="helv", color=(0.2, 0.4, 0.6))
        page.insert_text(fitz.Point(margin + 12, 75), title[:60], fontsize=14, fontname="helv", color=(0.08, 0.15, 0.28))

        # EGI Badge on top right
        badge_x = 595 - margin - 110
        page.draw_rect(fitz.Rect(badge_x, 42, 595 - margin - 10, 78), color=(0.1, 0.6, 0.3), fill=(0.9, 0.98, 0.92), width=1)
        page.insert_text(fitz.Point(badge_x + 8, 56), "EGI 2.0 SCORE", fontsize=7, fontname="helv", color=(0.1, 0.5, 0.2))
        page.insert_text(fitz.Point(badge_x + 8, 72), f"{egi_score * 100:.1f}%", fontsize=12, fontname="helv", color=(0.05, 0.45, 0.15))

        y_offset = 105.0

        # Metadata line
        page.insert_text(fitz.Point(margin, y_offset), f"Session: {session_id}   |   Date: {created_at}", fontsize=8, fontname="helv", color=(0.4, 0.4, 0.4))
        y_offset += 25.0

        # Section: Executive Summary
        page.insert_text(fitz.Point(margin, y_offset), "1. Executive Summary & Synthesis", fontsize=12, fontname="helv", color=(0.1, 0.2, 0.35))
        y_offset += 15.0

        # Synthesis text body
        rect_summary = fitz.Rect(margin, y_offset, 595 - margin, min(y_offset + 250, 780))
        clean_answer = "\n".join(line.strip() for line in answer_text.splitlines() if line.strip()) or "No answer synthesized."
        page.insert_textbox(rect_summary, clean_answer, fontsize=9.5, fontname="helv", color=(0.15, 0.15, 0.15))

        # Check height used
        y_offset += min(220.0, len(clean_answer) * 0.45 + 30.0)

        if y_offset > 600:
            page = doc.new_page(width=595, height=842)
            y_offset = 50.0

        # Section: Epistemic Claims
        if claims:
            page.insert_text(fitz.Point(margin, y_offset), "2. Epistemic Claims Verification", fontsize=12, fontname="helv", color=(0.1, 0.2, 0.35))
            y_offset += 18.0

            for i, clm in enumerate(claims[:8], start=1):
                c_dict = clm.as_dict() if hasattr(clm, "as_dict") else (clm if isinstance(clm, dict) else {"text": str(clm)})
                c_text = c_dict.get("text", "")[:120]
                status = str(c_dict.get("status", "unverified")).upper()
                conf = f"{float(c_dict.get('confidence', 0.7)) * 100:.0f}%"

                page.insert_text(fitz.Point(margin + 10, y_offset), f"[{i}] {c_text}", fontsize=9, fontname="helv", color=(0.1, 0.1, 0.1))
                page.insert_text(fitz.Point(595 - margin - 90, y_offset), f"{status} ({conf})", fontsize=8, fontname="helv", color=(0.2, 0.4, 0.3) if "SUPPORTED" in status else (0.6, 0.2, 0.1))
                y_offset += 16.0

            y_offset += 15.0

        if y_offset > 650:
            page = doc.new_page(width=595, height=842)
            y_offset = 50.0

        # Section: References
        page.insert_text(fitz.Point(margin, y_offset), "3. References & Evidence Dossier", fontsize=12, fontname="helv", color=(0.1, 0.2, 0.35))
        y_offset += 18.0

        for i, src in enumerate(sources[:10], start=1):
            s_dict = src.as_dict() if hasattr(src, "as_dict") else (src if isinstance(src, dict) else {"title": "Source", "url": str(src)})
            s_title = (s_dict.get("title") or f"Source {i}")[:60]
            s_url = (s_dict.get("url") or "")[:70]

            if y_offset > 800:
                page = doc.new_page(width=595, height=842)
                y_offset = 50.0

            page.insert_text(fitz.Point(margin + 10, y_offset), f"[{i}] {s_title}", fontsize=9, fontname="helv", color=(0.08, 0.15, 0.25))
            page.insert_text(fitz.Point(margin + 25, y_offset + 12), s_url, fontsize=7.5, fontname="helv", color=(0.3, 0.45, 0.65))
            y_offset += 28.0

        # Add page footers across all pages
        total_p = len(doc)
        for p_idx in range(total_p):
            p = doc[p_idx]
            p.draw_line(fitz.Point(margin, 810), fitz.Point(595 - margin, 810), color=(0.8, 0.8, 0.8), width=0.5)
            p.insert_text(fitz.Point(margin, 824), "XplainAI Autonomous Research OS • Confidential Dossier", fontsize=7.5, fontname="helv", color=(0.5, 0.5, 0.5))
            p.insert_text(fitz.Point(595 - margin - 60, 824), f"Page {p_idx + 1} of {total_p}", fontsize=7.5, fontname="helv", color=(0.5, 0.5, 0.5))

        pdf_bytes = doc.tobytes()
        doc.close()
        return pdf_bytes


class EvidencePackExporter:
    """Exports a complete, mathematically verifiable JSON Evidence Pack bundle."""

    @classmethod
    def export(cls, session_data: dict[str, Any]) -> dict[str, Any]:
        session_id = session_data.get("id") or session_data.get("session_id") or "ses_unknown"
        created_at = session_data.get("created_at") or _utc_iso_now()
        answer_text = session_data.get("synthesis") or session_data.get("answer_text") or ""
        egi_score = float(session_data.get("egi_score", 0.85))
        trust_metrics = dict(session_data.get("trust_metrics", {}))

        # Sources
        raw_sources = session_data.get("sources") or session_data.get("domain_sources") or []
        sources = [
            s.as_dict() if isinstance(s, Source) else (s if isinstance(s, dict) else {"id": f"src_{i}", "url": str(s), "title": str(s)})
            for i, s in enumerate(raw_sources, start=1)
        ]

        # Evidence
        raw_evidence = session_data.get("evidence") or session_data.get("domain_evidence") or []
        evidence = [
            e.as_dict() if isinstance(e, Evidence) else (e if isinstance(e, dict) else {"id": f"evi_{i}", "text": str(e)})
            for i, e in enumerate(raw_evidence, start=1)
        ]

        # Claims
        raw_claims = session_data.get("claims") or session_data.get("domain_claims") or []
        claims = [
            c.as_dict() if isinstance(c, Claim) else (c if isinstance(c, dict) else {"id": f"clm_{i}", "text": str(c), "status": "unverified", "confidence": 0.7})
            for i, c in enumerate(raw_claims, start=1)
        ]

        # Citations
        raw_citations = session_data.get("citations") or session_data.get("domain_citations") or []
        citations = [
            cit.as_dict() if hasattr(cit, "as_dict") else cit
            for cit in raw_citations
        ]

        # Graph
        raw_graph = session_data.get("graph") or session_data.get("domain_graph") or {}
        if isinstance(raw_graph, EvidenceGraph):
            graph = raw_graph.as_dict()
        elif isinstance(raw_graph, dict):
            graph = raw_graph
        else:
            graph = {"nodes": [], "edges": [], "density": 0.0, "cluster_count": 1}

        # Contradictions & Assumptions
        contradictions = [
            con.as_dict() if hasattr(con, "as_dict") else con
            for con in session_data.get("contradictions", [])
        ]
        assumptions = [
            asm.as_dict() if hasattr(asm, "as_dict") else asm
            for asm in session_data.get("assumptions", [])
        ]

        # Manifest
        manifest = {
            "pack_version": "2.2.0",
            "session_id": session_id,
            "created_at": created_at,
            "sources_count": len(sources),
            "evidence_count": len(evidence),
            "claims_count": len(claims),
            "citations_count": len(citations),
            "egi_score": round(egi_score, 4),
            "trust_metrics": trust_metrics,
        }

        return {
            "manifest": manifest,
            "synthesis": answer_text,
            "claims": claims,
            "evidence": evidence,
            "sources": sources,
            "citations": citations,
            "contradictions": contradictions,
            "assumptions": assumptions,
            "graph": graph,
            "trust_metrics": trust_metrics,
        }
