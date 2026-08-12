
"""Knowledge extraction service - entity & relation extraction using LLM."""

import json
import logging
from typing import List, Dict, Tuple
from openai import AsyncOpenAI
from app.core.config import get_settings

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """你是一个保险客服知识图谱构建专家。请从以下客服对话/文档中抽取实体和关系，并将每个实体归类到对应的业务场景。

## 业务场景类型（11种）
1. 退款诉求：客户要求退款、退费、退保、退订等退还款项
2. 投诉威胁：客户表达投诉、举报、威胁曝光、315、银保监、信访、起诉、发律师函等
3. 专业人士进线：客户表明或涉及律师、媒体、监管人员、医生等专业身份
4. 代家人进线：来电人非本人，代配偶、父母、子女等家人咨询或办理业务
5. 关联订单：涉及具体订单号、保单号、合同编号、工单号等
6. 三方平台：涉及微信、支付宝、抖音、美团、蚂蚁等第三方平台或渠道
7. 非我司公司：提及平安、人保、太平洋、国寿等其他保险公司或外部公司
8. 支付渠道：涉及银行卡、信用卡、花呗、微信支付、银联等支付方式
9. 解约解绑银行卡：客户要求解约、解绑银行卡、取消自动续费、注销账户等
10. 多次主动询问保司：客户多次联系保险公司未得到解决、反复追问理赔进度等
11. 质问查不到扣费：客户质疑不明扣费、账单异常、扣款后未收到保单等
12. 其他：不属于以上任何场景的实体

## 要求
1. 仔细阅读文本，识别所有关键实体（人名、公司名、产品名、操作动作、诉求内容等）
2. 每个实体包含 name（实体名称，简洁准确）和 type（上述业务场景之一）
3. 抽取实体之间的关系，格式: (源实体名, 关系描述, 目标实体名)
4. 每个实体必须归类到最匹配的一个场景类型，优先选具体的而非"其他"
5. 以JSON格式返回

## 输出格式
{{
  "entities": [
    {{"name": "实体名", "type": "业务场景"}}
  ],
  "relations": [
    {{"source": "源实体名", "target": "目标实体名", "relation": "关系描述"}}
  ]
}}

## 文本
{text}

请输出JSON:"""


class KnowledgeExtractor:
    """Extract entities and relations from text using LLM."""

    def __init__(self):
        settings = get_settings()
        self.client = AsyncOpenAI(
            base_url=settings.llm_api_base,
            api_key=settings.llm_api_key,
        )
        self.model = settings.llm_model

    async def extract(self, text: str) -> Tuple[List[Dict], List[Dict]]:
        """Extract entities and relations from text.

        Returns (entities_list, relations_list)
        """
        prompt = EXTRACTION_PROMPT.format(text=text[:3000])

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=2000,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            result = json.loads(content)

            entities = result.get("entities", [])
            relations = result.get("relations", [])

            return entities, relations

        except Exception as e:
            logger.error(f"Knowledge extraction failed: {e}")
            return [], []

    async def extract_from_chunks(self, chunks: List[str]) -> Tuple[List[Dict], List[Dict]]:
        """Extract from multiple chunks, sampling to avoid excessive API calls."""
        # Sample: first chunk, middle chunk, last chunk (or fewer for small docs)
        if len(chunks) <= 3:
            samples = chunks
        else:
            mid = len(chunks) // 2
            samples = [chunks[0], chunks[mid], chunks[-1]]

        all_entities = []
        all_relations = []

        for chunk in samples:
            entities, relations = await self.extract(chunk)
            all_entities.extend(entities)
            all_relations.extend(relations)

        return all_entities, all_relations
