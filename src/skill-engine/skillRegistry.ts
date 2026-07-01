import { builtInSkills } from './builtInSkills';
import { SkillDefinition } from './skillTypes';

const skillMap = new Map<string, SkillDefinition>(
  builtInSkills.map((skill) => [skill.id, skill]),
);

export function listAvailableSkills(): SkillDefinition[] {
  return [...builtInSkills];
}

export function getSkillById(skillId: string): SkillDefinition | null {
  return skillMap.get(skillId) ?? null;
}
