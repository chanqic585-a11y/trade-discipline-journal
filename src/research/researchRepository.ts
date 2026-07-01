import {
  getDataQualitySummary,
  getLatestSkillRunSummary,
  listLatestSkillResults,
  listSkillResults,
  listTradeFeatures,
  listTrades,
} from '../db/repositories';
import { ResearchDataset } from './researchTypes';

export async function listResearchTrades() {
  return listTrades();
}

export async function listResearchTradeFeatures() {
  return listTradeFeatures();
}

export async function listResearchSkillResults() {
  return listSkillResults(5000);
}

export async function listLatestResearchSkillResults() {
  return listLatestSkillResults(5000);
}

export async function loadResearchDataset(): Promise<ResearchDataset> {
  const [
    trades,
    tradeFeatures,
    skillResults,
    latestSkillResults,
    dataQualitySummary,
    latestSkillRunSummary,
  ] = await Promise.all([
    listResearchTrades(),
    listResearchTradeFeatures(),
    listResearchSkillResults(),
    listLatestResearchSkillResults(),
    getDataQualitySummary(),
    getLatestSkillRunSummary(),
  ]);

  return {
    trades,
    tradeFeatures,
    skillResults,
    latestSkillResults,
    dataQualitySummary,
    latestSkillRunSummary,
  };
}
