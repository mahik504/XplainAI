from neural_navigator.orchestration.modes import RunMode
from neural_navigator.orchestration.pipeline import analyze_query, _decompose_research_tasks


def test_mode_parse_aliases() -> None:
    assert RunMode.parse("fast") is RunMode.FAST
    assert RunMode.parse("moderate") is RunMode.BALANCED
    assert RunMode.parse("deep") is RunMode.DEEP_RESEARCH
    assert RunMode.parse(None) is RunMode.BALANCED


def test_analyze_query_research_need() -> None:
    analysis = analyze_query("Should India invest in nuclear energy?")
    assert analysis.needs_research is True
    assert analysis.complexity in {"moderate", "complex"}


def test_deep_research_tasks_unique() -> None:
    analysis = analyze_query("Compare React vs Vue for production apps")
    tasks = _decompose_research_tasks(
        "Compare React vs Vue for production apps",
        analysis,
        deep=True,
    )
    assert len(tasks) >= 2
    assert len(tasks) == len(set(task.lower() for task in tasks))


def test_missing_context_and_counter() -> None:
    from neural_navigator.orchestration.post_analysis import (
        build_counter_perspective,
        detect_missing_context,
    )

    missing = detect_missing_context("Should I buy a laptop for work?")
    assert any(item.item == "Budget" for item in missing)
    assert detect_missing_context("Tell me a joke.") == []

    counter = build_counter_perspective(
        user_query="Compare React vs Vue",
        answer="React is often preferred for large ecosystems. " * 4,
        mode="balanced",
    )
    assert counter is not None
    assert build_counter_perspective(
        user_query="Tell me a joke",
        answer="Why did the chicken cross the road? " * 4,
        mode="balanced",
    ) is None
