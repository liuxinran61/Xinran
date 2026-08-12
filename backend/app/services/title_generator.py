"""AI-powered title generation for imported documents."""

import logging
from openai import AsyncOpenAI
from app.core.config import get_settings

logger = logging.getLogger(__name__)

TITLE_PROMPT = """你是一个文档标题生成助手。根据以下文档内容，生成一个简洁准确的中文标题。

要求：
1. 15个字以内
2. 准确概括文档的核心主题
3. 不要加引号、书名号等装饰符号
4. 只返回标题文本，不要任何解释

文档内容：
{text}

标题："""


class TitleGenerator:
    """Generate document titles using LLM."""

    def __init__(self):
        settings = get_settings()
        self.client = AsyncOpenAI(
            base_url=settings.llm_api_base,
            api_key=settings.llm_api_key,
        )
        self.model = settings.llm_model

    async def generate(self, text: str, max_chars: int = 2000) -> str | None:
        """Generate a concise Chinese title from document content.

        Returns the title string, or None if generation fails.
        """
        # Only use the beginning of the text — the intro usually
        # contains enough information, and we save tokens.
        snippet = text[:max_chars].strip()
        if len(snippet) < 50:
            return None

        prompt = TITLE_PROMPT.format(text=snippet)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=50,
                timeout=10,
            )
            title = response.choices[0].message.content.strip()
            # Clean up common artifacts
            title = title.strip('"').strip("'").strip("《").strip("》").strip("「").strip("」")
            title = title.replace("\n", " ").replace("\r", "")
            if 2 <= len(title) <= 80:
                logger.info(f"AI generated title: {title}")
                return title
            else:
                logger.warning(f"AI title out of range ({len(title)} chars): {title}")
                return None
        except Exception as e:
            logger.warning(f"Title generation failed: {e}")
            return None
