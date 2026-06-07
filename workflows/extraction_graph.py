"""
LangGraph Workflow

Load Document
    ↓
Extract
    ↓
Validate
    ↓
Confidence
    ↓
Persist
    ↓
END
"""

from langgraph.graph import (
    StateGraph,
    END
)

from workflows.state import (
    ExtractionState
)

from workflows.nodes import (
    load_document_node,
    extract_node,
    validate_node,
    confidence_node,
    persist_node
)


workflow = StateGraph(
    ExtractionState
)


workflow.add_node(
    "load_document",
    load_document_node
)

workflow.add_node(
    "extract",
    extract_node
)

workflow.add_node(
    "validate",
    validate_node
)

workflow.add_node(
    "confidence",
    confidence_node
)

workflow.add_node(
    "persist",
    persist_node
)


workflow.set_entry_point(
    "load_document"
)


workflow.add_edge(
    "load_document",
    "extract"
)

workflow.add_edge(
    "extract",
    "validate"
)

workflow.add_edge(
    "validate",
    "confidence"
)

workflow.add_edge(
    "confidence",
    "persist"
)

workflow.add_edge(
    "persist",
    END
)


graph = workflow.compile()