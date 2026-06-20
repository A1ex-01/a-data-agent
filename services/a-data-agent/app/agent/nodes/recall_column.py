from langchain_core.output_parsers import JsonOutputParser
from langgraph.runtime import Runtime
from app.agent.llm import llm
from app.agent.context import DataAgentContext
from app.agent.state import DataAgentState
from app.core.log import logger
from langchain_core.prompts import PromptTemplate

from app.entities.column_info import ColumnInfo
from app.prompt.prompt_loader import load_prompt

async def recall_column(state: DataAgentState, runtime: Runtime[DataAgentContext]) -> DataAgentState:
    writer = runtime.stream_writer
    writer({"type": "progress", "step": "召回字段", "status": "running"})
    # 召回 columns
    keywords = state["keywords"]
    query = state["query"]
    # logger.info(f"召回关键词: {keywords}")
    # 1. 建立 llm
    try:
        prompt = PromptTemplate(
            template=load_prompt("extend_keywords_for_column_recall"),
            input_variables=["query"]
        )
        output_parser = JsonOutputParser()
        chain = prompt | llm | output_parser
        result = await chain.ainvoke({
            "query": query
        })
        
        # logger.info(f"拓展后的内容召回字段信息: {result}")
        
        # logger.info(f"拓展后的内容召回字段信息: {result}")
        embedding_client = runtime.context["embedding_client"]
        column_qdrant_repository = runtime.context["column_qdrant_repository"]
        
        # 拓展后的内容召回字段信息
        keywords = list(set(keywords + result))
        retrieved_columns_map: dict[str, ColumnInfo] = {}
        # 一个一个查
        for keyword in keywords:
            embedding = await embedding_client.aembed_query(keyword)
            payloads: list[ColumnInfo] = await column_qdrant_repository.search(embedding, score_threshold=0.6, limit=20)
            # logger.info(f"召回字段信息payload: {payloads}")
            for payload in payloads:
                if payload.id not in retrieved_columns_map:
                    retrieved_columns_map[payload.id] = payload

        retrieved_columns: list[ColumnInfo] = list(retrieved_columns_map.values())

        all_names = [col.name for col in retrieved_columns]
        logger.info(f"召回字段名称: {','.join(all_names)}")

        writer({"type": "progress", "step": "召回字段", "status": "success"})
        # 给下层
        return {
            "retrieved_columns": retrieved_columns
        }
    except Exception as e:
        writer({"type": "progress", "step": "召回字段", "status": "error", "error": str(e)})
        logger.error(f"召回字段失败: {e}")
        raise