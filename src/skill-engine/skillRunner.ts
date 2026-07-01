import {
  createSkillResult,
  getAccountSettings,
  getLatestTradeSnapshot,
  getTradeAnalysisByTradeId,
  getTradeById,
  getTradeFeatureByTradeId,
  listTrades,
} from '../db/repositories';
import { SkillResult } from '../types';
import { getSkillById, listAvailableSkills as listRegisteredSkills } from './skillRegistry';
import { mapSkillOutputToResult } from './skillResultMapper';
import { SkillDefinition, SkillInput } from './skillTypes';

function createRunGroupId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `skill_run_${Date.now()}_${random}`;
}

async function loadSkillInput(tradeId: number): Promise<SkillInput> {
  const [trade, feature, analysis, snapshot, account] = await Promise.all([
    getTradeById(tradeId),
    getTradeFeatureByTradeId(tradeId),
    getTradeAnalysisByTradeId(tradeId),
    getLatestTradeSnapshot(tradeId),
    getAccountSettings().catch(() => null),
  ]);

  if (!trade) throw new Error('Trade not found for Skill Engine.');

  return {
    trade,
    feature,
    analysis,
    snapshot,
    account,
  };
}

async function runDefinitionForTrade(
  skill: SkillDefinition,
  tradeId: number,
  runGroupId: string,
): Promise<SkillResult> {
  const input = await loadSkillInput(tradeId);
  const output = skill.run(input);
  return createSkillResult(mapSkillOutputToResult(output, runGroupId));
}

export function listAvailableSkills() {
  return listRegisteredSkills();
}

export async function runSkillForTrade(skillId: string, tradeId: number): Promise<SkillResult> {
  const skill = getSkillById(skillId);
  if (!skill) throw new Error(`Skill not found: ${skillId}`);
  return runDefinitionForTrade(skill, tradeId, createRunGroupId());
}

export async function runAllSkillsForTrade(
  tradeId: number,
  runGroupId = createRunGroupId(),
): Promise<SkillResult[]> {
  const skills = listRegisteredSkills();
  const results: SkillResult[] = [];

  for (const skill of skills) {
    results.push(await runDefinitionForTrade(skill, tradeId, runGroupId));
  }

  return results;
}

export async function runAllSkillsForAllTrades() {
  const trades = await listTrades();
  const runGroupId = createRunGroupId();
  let totalResults = 0;

  for (const trade of trades) {
    const results = await runAllSkillsForTrade(trade.id, runGroupId);
    totalResults += results.length;
  }

  return {
    runGroupId,
    totalTrades: trades.length,
    totalResults,
  };
}
