import { CreateSkillResultInput, SkillOutput } from './skillTypes';

export function mapSkillOutputToResult(
  output: SkillOutput,
  runGroupId: string | null,
): CreateSkillResultInput {
  return {
    skillId: output.skillId,
    skillName: output.skillName,
    skillVersion: output.skillVersion,
    runGroupId,
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
