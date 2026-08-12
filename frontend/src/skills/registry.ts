// ===== Skill types & registry =====
import type { LucideIcon } from "lucide-react";
import { uploadFileSkill } from "./definitions/upload-file/index";
import { importUrlSkill } from "./definitions/import-url/index";

// ── Types ────────────────────────────────────────────────

export interface SkillContext {
  kbId: string;
  kbName: string;
  apiBase: string;
}

export interface SkillResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  canHandle: (input: string, ctx: SkillContext) => boolean;
  execute: (input: string, ctx: SkillContext) => Promise<SkillResult>;
}

// ── Registry ─────────────────────────────────────────────

const REGISTRY: Skill[] = [uploadFileSkill, importUrlSkill];

export function matchSkill(input: string, ctx: SkillContext): Skill | null {
  return REGISTRY.find((s) => s.canHandle(input, ctx)) ?? null;
}

export function getSkillById(id: string): Skill | undefined {
  return REGISTRY.find((s) => s.id === id);
}

export function getSkills(): Skill[] {
  return REGISTRY;
}
