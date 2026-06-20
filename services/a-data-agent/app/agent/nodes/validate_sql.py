from langgraph.runtime import Runtime

from app.agent.context import DataAgentContext
from app.agent.state import DataAgentState
from app.core.log import logger

# use an attribute on the function to persist error count across invocations
async def validate_sql(state: DataAgentState, runtime: Runtime[DataAgentContext]):
    writer = runtime.stream_writer
    retry_count = state.get("sql_retry_count", 0)
    writer({"type": "progress", "step": "验证SQL", "status": "running"})

    dw_mysql_repository = runtime.context["dw_mysql_repository"]

    sql = state["sql"]

    try:
        # Mock error three times, succeed on the fourth call
            # On the 4th time and after, call the real validation
            await dw_mysql_repository.validate_sql(sql)
            writer({"type": "progress", "step": "验证SQL", "status": "success"})
            logger.info(f"SQL验证成功: {sql}")
            return {"error": None}
    except Exception as e:
        writer({"type": "progress", "step": "验证SQL", "status": "error"})
        logger.error(f"SQL验证失败: {sql}")
        return {"error": str(e), "sql_retry_count": retry_count + 1}
