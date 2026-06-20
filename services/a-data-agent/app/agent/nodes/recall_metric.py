from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import PromptTemplate
from langgraph.runtime import Runtime
from app.agent.llm import llm
from app.agent.context import DataAgentContext
from app.agent.state import DataAgentState
from app.core.log import logger
from app.entities.metric_info import MetricInfo
from app.prompt.prompt_loader import load_prompt


async def recall_metric(state: DataAgentState, runtime: Runtime[DataAgentContext]) -> DataAgentState:
    writer = runtime.stream_writer
    writer({"type": "progress", "step": "召回指标", "status": "running"})
    # 召回 columns
    keywords = state["keywords"]
    query = state["query"]
    # logger.info(f"召回关键词: {keywords}")
    # 1. 建立 llm
    try:
        prompt = PromptTemplate(
            template=load_prompt("extend_keywords_for_metric_recall"),
            input_variables=["query"]
        )
        output_parser = JsonOutputParser()
        chain = prompt | llm | output_parser
        result = await chain.ainvoke({
            "query": query
        })
        
        embedding_client = runtime.context["embedding_client"]
        metric_qdrant_repository = runtime.context["metric_qdrant_repository"]
        
        # 拓展后的内容召回字段信息
        keywords = list(set(keywords + result))
        retrieved_metric_map: dict[str, MetricInfo] = {}
        # 一个一个查
        for keyword in keywords:
            embedding = await embedding_client.aembed_query(keyword)
            payloads: list[MetricInfo] = await metric_qdrant_repository.search(embedding, score_threshold=0.6, limit=20)
            # logger.info(f"召回字段信息payload: {payloads}")
            for payload in payloads:
                if payload.id not in retrieved_metric_map:
                    retrieved_metric_map[payload.id] = payload

        retrieved_metrics: list[MetricInfo] = list(retrieved_metric_map.values())
        names = [metric.name for metric in retrieved_metrics]
        logger.info(f"召回指标名称: {','.join(names)}")
        writer({"type": "progress", "step": "召回指标", "status": "success"})
        # 给下层
        return {
            "retrieved_metrics": retrieved_metrics
        }
    except Exception as e:
        writer({"type": "progress", "step": "召回指标", "status": "error", "error": str(e)})
        logger.error(f"召回字段失败: {e}")
        raise
