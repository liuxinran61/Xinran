"""Auto-classification service for insurance CS documents.
Uses LLM to determine which scenario a document belongs to,
then routes it to the correct knowledge base.
"""

import json
import logging
from typing import Optional
from openai import AsyncOpenAI
from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Insurance CS scenario definitions for LLM classification
CLASSIFY_PROMPT = """你是一个保险客服文档分类助手。请根据以下文档内容，判断它属于哪个保险客服场景。

## 可选场景（11个）
1. 退款诉求 - 客户要求退保/退款，提及犹豫期
2. 投诉威胁 - 客户威胁投诉银保监会/媒体/律师
3. 专业人士进线 - 自称律师/媒体/监管人员
4. 代家人进线 - 家人代替被保人进线
5. 关联订单 - 关联到其他订单或保单
6. 三方平台 - 通过支付宝/微信等第三方平台购买
7. 非我司公司 - 误以为是我司产品，实际是其他保险公司
8. 支付渠道 - 用户提及支付方式(微信/支付宝/银行卡)
9. 解约解绑银行卡 - 要求取消自动续费或解绑银行卡
10. 多次主动询问保司 - 客户多次联系保司未得到解决
11. 质问查不到扣费 - 已被扣费但未收到保单

## 场景大类
- 理赔类: 退款诉求、质问查不到扣费、解约解绑银行卡
- 纠纷类: 投诉威胁、专业人士进线、多次主动询问保司
- 身份类: 代家人进线、三方平台、非我司公司
- 支付类: 用户提及支付渠道
- 订单类: 关联订单

## 严重程度
- critical: 投诉威胁、质问查不到扣费
- high: 退款诉求、专业人士进线、三方平台、解约解绑银行卡、多次主动询问保司
- medium: 代家人进线、关联订单、非我司公司、支付渠道

## 输出要求
返回 JSON 格式（只返回 JSON，不要其他文字）：
{
  "scenario": "场景名",
  "category": "场景大类",
  "severity": "严重程度",
  "confidence": 0.92,
  "keywords": ["关键词1", "关键词2"],
  "reason": "一句话理由"
}

如果文档与保险客服场景不相关，返回：
{
  "scenario": "其他",
  "category": "其他",
  "severity": "low",
  "confidence": 0.5,
  "keywords": [],
  "reason": "文档内容与保险客服场景不匹配"
}
"""


class DocumentClassifier:
    """Classify insurance CS documents into scenarios."""

    @staticmethod
    def _get_client() -> AsyncOpenAI:
        return AsyncOpenAI(
            base_url=settings.llm_api_base,
            api_key=settings.llm_api_key,
        )

    @classmethod
    async def classify(cls, text: str, filename: str = "") -> dict:
        """Classify a document into an insurance CS scenario.

        Args:
            text: Document text (first 3000 chars for efficiency)
            filename: Original filename for context

        Returns:
            dict with scenario, category, severity, confidence, keywords
        """
        client = cls._get_client()

        # Truncate text to avoid excessive token usage
        truncated = text[:3000] if len(text) > 3000 else text
        user_msg = f"文档名: {filename}\n\n文档内容:\n{truncated}"

        try:
            response = await client.chat.completions.create(
                model=settings.llm_model,
                messages=[
                    {"role": "system", "content": CLASSIFY_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.1,
                max_tokens=300,
                response_format={"type": "json_object"},
            )

            result_text = response.choices[0].message.content.strip()
            result = json.loads(result_text)

            # Validate required fields
            return {
                "scenario": result.get("scenario", "其他"),
                "category": result.get("category", "其他"),
                "severity": result.get("severity", "low"),
                "confidence": float(result.get("confidence", 0.5)),
                "keywords": result.get("keywords", []),
                "reason": result.get("reason", ""),
            }

        except Exception as e:
            logger.error(f"Classification failed: {e}")
            return {
                "scenario": "其他",
                "category": "其他",
                "severity": "low",
                "confidence": 0.0,
                "keywords": [],
                "reason": f"分类失败: {str(e)}",
            }

    @classmethod
    async def find_or_create_kb(
        cls, db, category: str, existing_kbs: list
    ) -> tuple:
        """Find matching knowledge base or create a new one for the category.

        Args:
            db: AsyncSession
            category: Category name (理赔类 / 纠纷类 / etc.)
            existing_kbs: List of existing KnowledgeBase objects

        Returns:
            (kb_id, kb_name, is_new)
        """
        from uuid import uuid4
        from app.models.models import KnowledgeBase

        # Try to find existing KB with matching name
        for kb in existing_kbs:
            if kb.name == category or category in (kb.description or ""):
                return kb.id, kb.name, False

        # Create new KB for this category
        import os
        icon_map = {
            "理赔类": "alert-circle",
            "纠纷类": "flame",
            "身份类": "user-check",
            "支付类": "credit-card",
            "订单类": "shopping-cart",
        }

        new_kb = KnowledgeBase(
            id=uuid4(),
            name=category,
            description=f"保险客服 {category} 自动收集",
            icon=icon_map.get(category, "folder"),
        )
        db.add(new_kb)
        await db.flush()
        await db.refresh(new_kb)

        return new_kb.id, new_kb.name, True


    @classmethod
    def classify_rule_based(cls, text: str, filename: str = "") -> dict:
        """Rule-based fallback classifier using keyword matching.
        Used when LLM is unavailable or fails.

        Returns same format as classify().
        """
        import re
        text_lower = text.lower()
        filename_lower = filename.lower()

        # Define scenario detection rules (keyword → scenario)
        rules = [
            (["退款", "退保", "犹豫期", "全额退"], "退款诉求", "理赔类", "high"),
            (["投诉", "银保监", "威胁", "曝光", "媒体"], "投诉威胁", "纠纷类", "critical"),
            (["律师", "法务", "法律", "监管", "记者"], "专业人士进线", "纠纷类", "high"),
            (["家人", "代.*进线", "爸妈", "子女", "夫妻"], "代家人进线", "身份类", "medium"),
            (["关联订单", "多个.*单", "关联.*保单"], "关联订单", "订单类", "medium"),
            (["支付宝", "微信.*买", "第三方平台", "蚂蚁"], "三方平台", "身份类", "high"),
            (["不是.*我司", "非我司", "其他.*保险公司", "买错"], "非我司公司", "身份类", "medium"),
            (["支付.*渠道", "微信.*付", "支付宝.*付", "银行卡.*付"], "支付渠道", "支付类", "medium"),
            (["解约", "解绑", "取消.*续费", "自动续费", "绑卡"], "解约解绑银行卡", "理赔类", "high"),
            (["多次.*询问", "反复.*联系", "联系.*多次", "保司"], "多次主动询问保司", "纠纷类", "high"),
            (["扣费", "扣款", "查.*不到", "没.*收到.*保单", "没.*到账"], "质问查不到扣费", "理赔类", "critical"),
        ]

        for keywords, scenario, category, severity in rules:
            for kw in keywords:
                if re.search(kw, text_lower) or re.search(kw, filename_lower):
                    matched_kw = [kw for kw in keywords if re.search(kw, text_lower) or re.search(kw, filename_lower)]
                    return {
                        "scenario": scenario,
                        "category": category,
                        "severity": severity,
                        "confidence": 0.75,
                        "keywords": matched_kw[:5],
                        "reason": f"关键词匹配: {', '.join(matched_kw[:3])}",
                    }

        return {
            "scenario": "其他",
            "category": "其他",
            "severity": "low",
            "confidence": 0.3,
            "keywords": [],
            "reason": "未匹配到已知保险客服场景关键词",
        }


# Singleton
classifier = DocumentClassifier()
