import { ResearchDashboardData } from './researchTypes';

export function buildResearchSummary(data: Omit<ResearchDashboardData, 'summaryNotes'>): string[] {
  const notes: string[] = [
    'This dashboard summarizes historical trades, feature quality, and research skill observations.',
  ];

  if (data.overview.totalTrades === 0) {
    notes.push('No local trades are available yet. Create trades before reading research patterns.');
  }

  if (data.overview.totalTrades > 0 && data.overview.featureRows === 0) {
    notes.push('Data quality is limited. Generate or refresh TradeFeatures before drawing conclusions.');
  }

  if (data.skillSummary.latestRunResultCount === 0) {
    notes.push('No latest Skill run is available. Run Skill Engine to add research observations.');
  }

  if (data.discipline.incompleteReviewCount > 0) {
    notes.push('Some trades still need review. Completing reviews improves research quality.');
  }

  return notes;
}
