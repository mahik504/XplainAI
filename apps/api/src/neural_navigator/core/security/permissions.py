"""Tool permission RBAC model for agent governance."""

from enum import IntFlag, auto


class ToolPermission(IntFlag):
    """Fine-grained tool execution permission flags."""

    NONE = 0
    READ_PUBLIC = auto()  # Web search, ArXiv, Wikipedia, public crawler
    READ_SENSITIVE = auto()  # Internal documents, user memory, database
    EXECUTE_LOCAL = auto()  # Pure arithmetic, local parsers
    EXECUTE_SANDBOX = auto()  # Sandboxed code / docker execution
    EXECUTE_NETWORK = auto()  # Outbound crawler, webhook triggers
    WRITE_LOCAL = auto()  # Local workspace artifact creation
    WRITE_EXTERNAL = auto()  # External API mutations
    ADMIN = auto()  # Administrative operations
