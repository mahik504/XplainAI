"""Unit tests for Tool RBAC permissions and governance."""

import pytest

from neural_navigator.core.config import Settings
from neural_navigator.core.security.permissions import ToolPermission
from neural_navigator.orchestration.tool_registry import ToolRegistry


def test_tool_permissions_intflag() -> None:
    read_only = ToolPermission.READ_PUBLIC
    full_exec = ToolPermission.READ_PUBLIC | ToolPermission.EXECUTE_LOCAL | ToolPermission.EXECUTE_NETWORK

    assert bool(full_exec & ToolPermission.READ_PUBLIC) is True
    assert bool(full_exec & ToolPermission.EXECUTE_NETWORK) is True
    assert bool(read_only & ToolPermission.EXECUTE_NETWORK) is False


@pytest.mark.asyncio
async def test_tool_registry_rbac_enforcement() -> None:
    settings = Settings()
    registry = ToolRegistry(settings)

    # Execute with sufficient permissions
    res_ok = await registry.execute(
        "calculator",
        user_permissions=ToolPermission.EXECUTE_LOCAL,
        expression="10 * 5",
    )
    assert res_ok.status == "ok"
    assert res_ok.data["result"] == 50.0

    # Execute with insufficient permissions (READ_PUBLIC only)
    res_denied = await registry.execute(
        "calculator",
        user_permissions=ToolPermission.READ_PUBLIC,
        expression="10 * 5",
    )
    assert res_denied.status == "error"
    assert res_denied.data["error"] == "permission_denied"


def test_tool_registry_list_tools_metadata() -> None:
    settings = Settings()
    registry = ToolRegistry(settings)
    tools = registry.list_tools()

    names = {t["name"] for t in tools}
    assert "web_search" in names
    assert "calculator" in names
    assert "deep_crawler" in names

    calc_tool = next(t for t in tools if t["name"] == "calculator")
    assert calc_tool["required_permission"] == "EXECUTE_LOCAL"
