"""
Intent classification for incoming queries.

Two-stage pipeline:

1. **Heuristic fast-path** — match the query against an explicit chitchat
   allowlist (identity questions, greetings, meta-questions about the
   assistant itself). If the query clearly belongs to chitchat, route
   there without spending an LLM call.
2. **LLM fallback** — for everything else, ask the LLM to choose between
   `chitchat` and `data_query`. The fallback prompt biases toward
   `data_query` when both interpretations are plausible.

The classification also writes a brief SSE `progress` event so the chat
UI can show "Classifying intent…" while the LLM call is in flight.
"""

from __future__ import annotations

import re

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import PromptTemplate
from langgraph.runtime import Runtime

from app.agent.context import DataAgentContext
from app.agent.llm import llm
from app.agent.state import DataAgentState
from app.core.log import logger
from app.prompt.prompt_loader import load_prompt

INTENT_DATA_QUERY = "data_query"
INTENT_CHITCHAT = "chitchat"

# Phrases / patterns that always route to chitchat without an LLM call.
# Keep this list tight — every entry must be a clear-cut non-data query.
_CHITCHAT_PATTERNS: tuple[re.Pattern[str], ...] = (
    # Identity / capability / meta questions about the assistant
    re.compile(r"你\s*(是|叫)\s*(谁|什么)", re.IGNORECASE),
    re.compile(r"你\s*能\s*(做|干)\s*什么", re.IGNORECASE),
    re.compile(r"介绍\s*一下\s*(你|自己|您)", re.IGNORECASE),
    re.compile(r"who\s+are\s+you", re.IGNORECASE),
    re.compile(r"what\s+can\s+you\s+do", re.IGNORECASE),
    re.compile(r"introduce\s+yourself", re.IGNORECASE),
    # Greetings / pleasantries / thanks — only when the WHOLE query is
    # short and has no sentence breaks (multi-sentence messages fall
    # through to the LLM fallback instead).
    re.compile(
        r"^\s*(你好|您好|hi|hello|hey|thanks|thank\s+you|谢谢|再见|bye)"
        r"\s*[!.。,~～]?\s*$",
        re.IGNORECASE,
    ),
)

# Tokens that strongly hint at a data question. If any of these appear
# in the query we *suppress* the chitchat fallback even when the
# heuristic weakly matched — better to over-route to data_query than
# silently skip a real data request.
_DATA_HINTS: tuple[str, ...] = (
    "多少", "几个", "哪个", "哪些", "排名", "top", "排行",
    "sum", "count", "avg", "average", "max", "min",
    "gmv", "uv", "pv", "dau", "mau", "aov", "roi", "ctr",
    "select", "from", "where", "group by",
    "表", "字段", "指标", "维度", "事实", "数仓", "数据库",
    "订单", "用户", "商品", "客户", "销售", "营收", "毛利",
    "天", "周", "月", "季", "年", "今日", "昨日", "本月", "上月",
)


def _chitchat_match(query: str) -> bool:
    """Run the heuristic fast-path. Returns True only when the query
    clearly belongs to chitchat and shows no data hints."""
    cleaned = query.strip()
    if not cleaned:
        return False

    for pattern in _CHITCHAT_PATTERNS:
        if pattern.search(cleaned):
            # Data hints override the heuristic.
            lowered = cleaned.lower()
            if any(hint in lowered for hint in _DATA_HINTS):
                return False
            return True

    return False


async def _classify_with_llm(query: str) -> str:
    """Ask the LLM to pick `chitchat` | `data_query`. Defaults to
    `data_query` on any parse failure (conservative)."""
    prompt = PromptTemplate(
        template=load_prompt("classify_intent"),
        input_variables=["query"],
    )
    parser = JsonOutputParser()
    chain = prompt | llm | parser

    try:
        result = await chain.ainvoke({"query": query})
    except Exception as exc:
        logger.warning(
            f"Intent LLM classification failed, defaulting to data_query: {exc}"
        )
        return INTENT_DATA_QUERY

    intent = result.get("intent") if isinstance(result, dict) else None
    if intent not in (INTENT_DATA_QUERY, INTENT_CHITCHAT):
        logger.warning(f"Unexpected intent value from LLM: {result!r}")
        return INTENT_DATA_QUERY
    return intent


async def classify_intent(
    state: DataAgentState,
    runtime: Runtime[DataAgentContext],
) -> DataAgentState:
    writer = runtime.stream_writer
    writer({"type": "progress", "step": "意图识别", "status": "running"})

    query = state["query"]

    try:
        if _chitchat_match(query):
            intent = INTENT_CHITCHAT
            logger.info(f"Intent classified by heuristic → {intent}")
        else:
            intent = await _classify_with_llm(query)
            logger.info(f"Intent classified by LLM → {intent}")

        writer({
            "type": "progress",
            "step": "意图识别",
            "status": "success",
            "intent": intent,
        })
        return {"intent": intent}
    except Exception as exc:
        # Conservative fallback: route to data_query so the original
        # behaviour is preserved on any unexpected failure.
        logger.error(f"Intent classification failed: {exc}")
        writer({
            "type": "progress",
            "step": "意图识别",
            "status": "error",
            "error": str(exc),
        })
        return {"intent": INTENT_DATA_QUERY}
