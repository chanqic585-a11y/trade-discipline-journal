import {
  AccountSettings,
  SkillCategory,
  SkillResult,
  Trade,
  TradeAnalysis,
  TradeFeature,
  TradeSnapshot,
} from '../types';

export const SKILL_ENGINE_SOURCE = 'local_skill_engine_v6';

export type SkillSafetyLevel = 'research_only';

export interface SkillInput {
  trade: Trade;
  feature: TradeFeature | null;
  analysis: TradeAnalysis | null;
  snapshot: TradeSnapshot | null;
  account: AccountSettings | null;
}

export interface SkillOutput {
  skillId: string;
  skillName: string;
  skillVersion: string;
  tradeId?: number;
  symbol?: string;
  category: SkillCategory;
  score?: number | null;
  label?: string | null;
  summary: string;
  explanation: string;
  evidence: Record<string, unknown>;
  output: Record<string, unknown>;
  source: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  category: SkillCategory;
  inputSchema: readonly string[];
  outputSchema: readonly string[];
  safetyLevel: SkillSafetyLevel;
  explanation: string;
  run: (input: SkillInput) => SkillOutput;
}

export type CreateSkillResultInput = Omit<SkillResult, 'id' | 'createdAt'>;
