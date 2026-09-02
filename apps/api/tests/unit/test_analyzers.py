"""Unit tests for query analysis and task decomposition."""

from neural_navigator.orchestration.analyzers import (
    analyze_query,
    decompose_research_tasks,
    latest_user_text,
)
from neural_navigator.schemas.base import ChatMessage
from neural_navigator.utils.constants import Role


def test_analyze_query_domains() -> None:
    tech = analyze_query("How do I write a Python async function with Postgres?")
    assert tech.domain == "technology"

    policy = analyze_query("What is the impact of inflation and energy policy on the economy?")
    assert policy.domain == "policy"

    science = analyze_query("Explain quantum entanglement in physics")
    assert science.domain == "science"

    general = analyze_query("Tell me about apples and oranges")
    assert general.domain == "general"


def test_analyze_query_complexity_and_intent() -> None:
    simple = analyze_query("What is 2 + 2?")
    assert simple.complexity == "simple"
    assert simple.intent == "question"

    complex_q = analyze_query(
        "Analyze comprehensively the research papers and empirical sources on quantum computing"
    )
    assert complex_q.complexity == "complex"
    assert complex_q.needs_research is True

    creative = analyze_query("Write a funny poem about robots")
    assert creative.intent == "creative"
    assert creative.complexity == "simple"


def test_analyze_query_ambiguity() -> None:
    vague = analyze_query("it")
    assert vague.ambiguity == "high"

    moderate = analyze_query("How does this work?")
    assert moderate.ambiguity == "medium"

    specific = analyze_query("What is the speed of light in vacuum?")
    assert specific.ambiguity == "low"


def test_decompose_research_tasks() -> None:
    analysis = analyze_query("Compare React vs Vue performance")
    tasks_fast = decompose_research_tasks(
        "Compare React vs Vue performance",
        analysis,
        deep=False,
    )
    assert len(tasks_fast) <= 2
    assert tasks_fast[0] == "Compare React vs Vue performance"

    tasks_deep = decompose_research_tasks(
        "Compare React vs Vue performance",
        analysis,
        deep=True,
    )
    assert len(tasks_deep) >= 3
    assert len(tasks_deep) <= 5
    assert any("methodology" in t or "papers" in t or "limitations" in t for t in tasks_deep)


def test_latest_user_text() -> None:
    messages = [
        ChatMessage(role=Role.USER, content="First prompt"),
        ChatMessage(role=Role.ASSISTANT, content="First answer"),
        ChatMessage(role=Role.USER, content="Latest inquiry"),
    ]
    assert latest_user_text(messages) == "Latest inquiry"
    assert latest_user_text([]) == ""
