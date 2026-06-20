from typing import Optional

from app.conf.app_config import EmbeddingConfig, app_config


class EmbeddingClientManager:
    def __init__(self, config: EmbeddingConfig):
        self.client = None
        self.config = config

    def _get_url(self):
        return f"http://{self.config.host}:{self.config.port}"

    def init(self):
        from langchain_openai import OpenAIEmbeddings
        # 本地 TEI 提供 OpenAI 兼容的 /v1/embeddings 接口
        self.client = OpenAIEmbeddings(
            base_url=f"{self._get_url()}/v1",
            api_key="EMPTY",  # TEI 不校验
            model=self.config.model,
            check_embedding_ctx_length=False,
        )


embedding_client_manager = EmbeddingClientManager(app_config.embedding)