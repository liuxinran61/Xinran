// ===== Skill: import-url =====
import { Globe } from "lucide-react";
import type { Skill, SkillContext, SkillResult } from "../../registry";

export const importUrlSkill: Skill = {
  id: "import-url",
  name: "导入链接",
  description: "导入网页链接，AI 自动抓取并解析网页内容，提取知识存入知识库。",
  icon: Globe,

  keywords: ["导入", "链接", "url", "http", "网页", "网站", "import url"],

  canHandle(input: string): boolean {
    // URL pattern detection
    if (/https?:\/\/[^\s]+/.test(input)) return true;
    const lower = input.toLowerCase();
    return this.keywords.some((kw) => lower.includes(kw));
  },

  async execute(input: string, ctx: SkillContext): Promise<SkillResult> {
    const urlMatch = input.match(/(https?:\/\/[^\s]+)/);
    if (!urlMatch) {
      return {
        success: true,
        message: "请提供要导入的网页链接，例如：\n\n`https://example.com/article`\n\n也可以点击 📎 → **网页链接** 打开导入表单。",
      };
    }

    const url = urlMatch[0];
    const rest = input.replace(url, "").trim();
    const title = rest || url.slice(0, 60);

    try {
      const res = await fetch(`${ctx.apiBase}/api/knowledge-bases/${ctx.kbId}/import-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title: rest || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return {
        success: true,
        message: `✅ **${title}** 已导入到「${ctx.kbName}」，正在后台抓取和解析网页内容。`,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `❌ 导入失败: ${e?.message || "未知错误"}`,
        error: e?.message,
      };
    }
  },
};
