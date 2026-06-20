from langgraph.graph import StateGraph, START, END
from app.agent.nodes import recall_column, recall_value, recall_metric, merge_retrieved_info, filter_metric, filter_table, add_extra_context, generate_sql, validate_sql, correct_sql, run_sql
from app.clients.embedding_client_manager import embedding_client_manager
from app.clients.es_client_manager import es_client_manager
from app.clients.mysql_client_manager import dw_mysql_client_manager, meta_mysql_client_manager
from app.clients.qdrant_client_manager import qdrant_client_manager
import asyncio
from app.agent.context import DataAgentContext
from app.agent.state import DataAgentState
from app.agent.nodes.extract_keywords import extract_keywords
from app.repositories.es.value_es_repository import ValueESRepository
from app.repositories.mysql.dw.dw_mysql_repository import DWMySQLRepository
from app.repositories.mysql.meta.meta_mysql_repository import MetaMySQLRepository
from app.repositories.qdrant.column_qdrant_repository import ColumnQdrantRepository
from app.repositories.qdrant.metric_qdrant_repository import MetricQdrantRepository



   
    
graph_builder = StateGraph(state_schema=DataAgentState, context_schema=DataAgentContext)

# 添加节点
graph_builder.add_node("extract_keywords", extract_keywords)
graph_builder.add_node("recall_column", recall_column)
graph_builder.add_node("recall_value", recall_value)
graph_builder.add_node("recall_metric", recall_metric)
graph_builder.add_node("merge_retrieved_info", merge_retrieved_info)
graph_builder.add_node("filter_metric", filter_metric)
graph_builder.add_node("filter_table", filter_table)
graph_builder.add_node("add_extra_context", add_extra_context)
graph_builder.add_node("generate_sql", generate_sql)
graph_builder.add_node("validate_sql", validate_sql)
graph_builder.add_node("correct_sql", correct_sql)
graph_builder.add_node("run_sql", run_sql)
# 添加普通边
graph_builder.add_edge(START, "extract_keywords")
graph_builder.add_edge("extract_keywords", "recall_column")
graph_builder.add_edge("extract_keywords", "recall_metric")
graph_builder.add_edge("extract_keywords", "recall_value")
graph_builder.add_edge("recall_column", "merge_retrieved_info")
graph_builder.add_edge("recall_value", "merge_retrieved_info")
graph_builder.add_edge("recall_metric", "merge_retrieved_info")
graph_builder.add_edge("merge_retrieved_info", "filter_metric")
graph_builder.add_edge("merge_retrieved_info", "filter_table")
graph_builder.add_edge("filter_metric", "add_extra_context")
graph_builder.add_edge("filter_table", "add_extra_context")
graph_builder.add_edge("add_extra_context", "generate_sql")
graph_builder.add_edge("generate_sql", "validate_sql")
# 添加条件边
# 1. 校验成功， run_sql
# 2. 校验失败， correct_sql
graph_builder.add_conditional_edges(
    source="validate_sql",
    path=lambda state: "run_sql" if state["error"] is None else "correct_sql",
    path_map={
        "run_sql": "run_sql",
        "correct_sql": "correct_sql"
    }
)

max_retry_count = 3

graph_builder.add_conditional_edges(
    source="correct_sql",
    path=lambda state: "validate_sql" if state["error"] is not None and state.get("sql_retry_count", 0) < max_retry_count else "run_sql",
    path_map={
        "validate_sql": "validate_sql",
        "run_sql": "run_sql"
    }
)
graph_builder.add_edge("run_sql", END)
graph = graph_builder.compile()




async def initGraph():
     # 注入 qdrant
    embedding_client_manager.init()
    qdrant_client_manager.init()
    es_client_manager.init()
    meta_mysql_client_manager.init()
    dw_mysql_client_manager.init()
    
    # print(graph.get_graph().draw_mermaid())
    
    async with meta_mysql_client_manager.session_factory() as meta_session, dw_mysql_client_manager.session_factory() as dw_session:
        agent_state = DataAgentState(query="华北地区AOV是多少")

        meta_mysql_repository = MetaMySQLRepository(meta_session)
        dw_mysql_repository = DWMySQLRepository(dw_session)
        column_qdrant_repository = ColumnQdrantRepository(qdrant_client_manager.client)
        value_es_repository = ValueESRepository(es_client_manager.client)
        metric_qdrant_repository = MetricQdrantRepository(qdrant_client_manager.client)
        agent_context = DataAgentContext(
            embedding_client=embedding_client_manager.client,
            column_qdrant_repository=column_qdrant_repository,
            value_es_repository=value_es_repository,
            metric_qdrant_repository=metric_qdrant_repository,
            meta_mysql_repository=meta_mysql_repository,
            dw_mysql_repository=dw_mysql_repository
        )
        
        result = graph.astream(input=agent_state, context=agent_context, stream_mode=["custom"])
        async for chunk in result:
            print(chunk)
    
    await qdrant_client_manager.close()
    await es_client_manager.close()
    await meta_mysql_client_manager.close()
    await dw_mysql_client_manager.close()

if __name__ == "__main__":
    asyncio.run(initGraph())

