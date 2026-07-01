import { CreateSkillResultInput, SkillOutput } from './skillTypes';

export function mapSkillOutputToResult(output: SkillOutput): CreateSkillResultInput {
  return {
    skillId: output.skillId,
    skillName: output.skillName,
    skillVersion: output.skillVersion,
    tradeId: output.tradeId ?? null,
    symbol: output.symbol ?? null,
    category: output.category,
    score: output.score ?? null,
    label: output.label ?? null,
    summary: output.summary,
    explanation: output.explanation,
    evidenceJson: JSON.stringify(output.evidence),
    outputJson: JSON.stringify(output.output),
    source: output.source,
  };
}
