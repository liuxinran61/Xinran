// ===== Skill: upload-file =====
import { FileText } from "lucide-react";
import { uploadDocument } from "../../../api/client";
import type { Skill, SkillContext, SkillResult } from "../../registry";

export const uploadFileSkill: Skill = {
  id: "upload-file",
  name: "上传文件",
  description: "将本地文档、图片、音视频上传到知识库，AI 自动解析提取知识。",
  icon: FileText,

  keywords: ["上传", "文件", "文档", "导入文件", "upload", "file", "pdf", "doc", "图片", "视频"],

  canHandle(input: string): boolean {
    const lower = input.toLowerCase();
    return this.keywords.some((kw) => lower.includes(kw));
  },

  async execute(_input: string, ctx: SkillContext): Promise<SkillResult> {
    // File upload is triggered via file input (not text), so this acts as a prompt
    return {
      success: true,
      message: `请点击 📎 按钮选择要上传的文件，或直接将文件拖拽到对话框。\n\n目标知识库：**${ctx.kbName}**`,
    };
  },
};

/** Direct file upload — called from Operator when file is selected via picker/drop */
export async function executeFileUpload(
  file: File,
  ctx: SkillContext,
): Promise<SkillResult> {
  try {
    await uploadDocument(ctx.kbId, file);
    return {
      success: true,
      message: `✅ **${file.name}** 已上传到「${ctx.kbName}」，AI 正在后台解析处理。`,
    };
  } catch (e: any) {
    return {
      success: false,
      message: `❌ 上传失败: ${e?.message || "未知错误"}`,
      error: e?.message,
    };
  }
}
