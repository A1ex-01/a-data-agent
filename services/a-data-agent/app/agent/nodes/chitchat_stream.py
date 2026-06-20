"""
Chitchat reply node — short-circuits the data-query pipeline when the
intent classifier decides the user isn't asking about data.

This node does NOT touch MySQL / Qdrant / ES / embedding. It only
streams a text reply from the same DeepSeek chat model the rest of the
graph uses. The reply is sent to the client incrementally via SSE, one
`{"type": "chitchat", "delta": "..."}` event per token, and finalized
with a single `{"type": "answer", "text": "<full text>"}` event so the
UI can show a stable copy once streaming completes.

The shape of the streamed events deliberately mirrors the existing
progress/result events so the front-end can keep using one SSE parser.
"""

from __future__ import annotations

from langchain_core.messages import AIMessageChunk, HumanMessage, SystemMessage
from langgraph.runtime import Runtime

from app.agent.context import DataAgentContext
from app.agent.llm import llm
from app.agent.state import DataAgentState
from app.core.log import logger
from app.prompt.prompt_loader import load_prompt

SYSTEM_PROMPT = load_prompt("chitchat_system")


def _extract_delta_text(chunk) -> str:
    """Pull the textual delta out of a LangChain streaming chunk.

    LangChain 1.x chat models stream `AIMessageChunk` objects whose
    `content` is either a plain string or a list of content parts (for
    multi-modal / tool-call models). We accept both shapes.
    """
    if isinstance(chunk, AIMessageChunk):
        content = chunk.content
    else:
        # Fallback: any object with a `.content` attribute.
        content = getattr(chunk, "content", "")

    if isinstance(content, str):
        return content
    if isinstance(content, list):
        out: list[str] = []
        for part in content:
            if isinstance(part, str):
                out.append(part)
            elif isinstance(part, dict):
                # OpenAI-style content parts: {"type": "text", "text": "..."}.
                text = part.get("text")
                if isinstance(text, str):
                    out.append(text)
        return "".join(out)
    return ""


async def chitchat_stream(
    state: DataAgentState,
    runtime: Runtime[DataAgentContext],
) -> DataAgentState:
    writer = runtime.stream_writer

    writer({"type": "progress", "step": "闲聊回复", "status": "running"})

    query = state["query"]
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=query),
    ]

    accumulated = ""
    try:
        async for chunk in llm.astream(messages):
            delta = _extract_delta_text(chunk)
            if not delta:
                continue
            accumulated += delta
            writer({"type": "chitchat", "delta": delta})

        writer({"type": "progress", "step": "闲聊回复", "status": "success"})
        writer({"type": "answer", "text": accumulated})
        logger.info(f"Chitchat reply ({len(accumulated)} chars): {accumulated}")

        return {"answer_text": accumulated, "final_answer": accumulated}
    except Exception as exc:
        writer({"type": "progress", "step": "闲聊回复", "status": "error"})
        logger.error(f"Chitchat reply failed: {exc}")
        raise
