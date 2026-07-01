import { calculateTradeRiskMetrics } from '../services/risk';
import { SetupType } from '../types';
import { SKILL_ENGINE_SOURCE, SkillDefinition, SkillInput, SkillOutput } from './skillTypes';

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function missingFields(input: SkillInput, fields: string[]) {
  return fields.filter((field) => {
    if (field === 'feature') return input.feature === null;
    if (field === 'analysis') return input.analysis === null;
    if (field === 'snapshot') return input.snapshot === null;
    if (field === 'account') return input.account === null;

    const source = field.startsWith('feature.')
      ? input.feature
      : field.startsWith('analysis.')
        ? input.analysis
        : field.startsWith('snapshot.')
          ? input.snapshot
          : input.trade;
    const parts = field.split('.');
    const key = parts[1] ?? parts[0] ?? field;
    const value = source ? (source as unknown as Record<string, unknown>)[key] : null;
    return value === null || value === undefined || value === '';
  });
}

function createOutput(
  skill: SkillDefinition,
  input: SkillInput,
  payload: Omit<SkillOutput, 'skillId' | 'skillName' | 'skillVersion' | 'tradeId' | 'symbol' | 'category' | 'source'>,
): SkillOutput {
  return {
    skillId: skill.id,
    skillName: skill.name,
    skillVersion: skill.version,
    tradeId: input.trade.id,
    symbol: input.trade.symbol,
    category: skill.category,
    source: SKILL_ENGINE_SOURCE,
    ...payload,
  };
}

function entryQualityLabel(score: number | null) {
  if (score === null) return 'unknown';
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'weak';
  return 'risky';
}

function riskLabel(score: number | null, ruleViolation: boolean) {
  if (score === null) return 'unknown';
  if (ruleViolation) return 'rule_violation';
  if (score < 75) return 'caution';
  return 'within_rules';
}

function setupLabel(setupType: string | null | undefined) {
  const known: Record<SetupType, string> = {
    new_listing_pullback_breakout: 'new_listing_pullback_breakout',
    volume_breakout_previous_high: 'volume_breakout_previous_high',
    extreme_fear_rebound: 'extreme_fear_rebound',
    other: 'other',
  };
  if (!setupType) return 'unknown';
  return known[setupType as SetupType] ?? 'unknown';
}

const entryQualitySkill: SkillDefinition = {
  id: 'entry_quality_v1',
  name: 'Entry Quality',
  version: '1.0.0',
  description: 'Evaluates saved entry context using feature quality, risk, setup consistency, and reviewable evidence.',
  category: 'entry_quality',
  inputSchema: ['Trade', 'TradeFeature', 'TradeAnalysis', 'TradeSnapshot'],
  outputSchema: ['score', 'label', 'summary', 'explanation', 'evidence'],
  safetyLevel: 'research_only',
  explanation: 'This skill scores the recorded entry context. It does not make trading decisions.',
  run(input) {
    const missing = missingFields(input, ['feature', 'feature.dataQualityScore']);
    if (!input.feature) {
      return createOutput(entryQualitySkill, input, {
        score: null,
        label: 'unknown',
        summary: 'Entry quality cannot be scored because feature data is missing.',
        explanation: 'Generate TradeFeatures first so this skill can evaluate recorded risk and market context.',
        evidence: { missingFields: missing },
        output: { reason: 'missing_feature_data' },
      });
    }

    const risk = input.account ? calculateTradeRiskMetrics(input.trade, input.account.currentBalance) : null;
    let score = input.feature.dataQualityScore;
    if ((risk?.estimatedRiskPercent ?? 0) > (input.account?.maxRiskPerTradePercent ?? 2)) score -= 25;
    if ((risk?.rrRatio ?? 2) < 1) score -= 12;
    if (input.trade.leverage > 5) score -= 20;
    if (!input.trade.isFollowingSystem) score -= 15;
    if (!input.feature.trend || input.feature.trend === 'unknown') score -= 8;
    if (input.feature.rsi !== null && (input.feature.rsi > 75 || input.feature.rsi < 25)) score -= 6;

    const finalScore = clampScore(score);
    const label = entryQualityLabel(finalScore);

    return createOutput(entryQualitySkill, input, {
      score: finalScore,
      label,
      summary: `Entry quality is ${label} based on saved risk, feature quality, and setup consistency.`,
      explanation:
        'The score combines data quality, estimated risk percent, RR ratio, leverage, system fit, trend availability, and RSI context. It is a research observation only.',
      evidence: {
        dataQualityScore: input.feature.dataQualityScore,
        estimatedRiskPercent: round(risk?.estimatedRiskPercent),
        rrRatio: round(risk?.rrRatio),
        leverage: input.trade.leverage,
        isFollowingSystem: input.trade.isFollowingSystem,
        trend: input.feature.trend,
        rsi: round(input.feature.rsi),
        missingFields: missing,
      },
      output: {
        label,
        score: finalScore,
      },
    });
  },
};

const riskDisciplineSkill: SkillDefinition = {
  id: 'risk_discipline_v1',
  name: 'Risk Discipline',
  version: '1.0.0',
  description: 'Checks whether the recorded trade stays within local risk rules.',
  category: 'risk',
  inputSchema: ['Trade', 'AccountSettings'],
  outputSchema: ['score', 'label', 'summary', 'explanation', 'evidence'],
  safetyLevel: 'research_only',
  explanation: 'This skill compares recorded trade risk with local risk settings. It does not change orders.',
  run(input) {
    const missing = missingFields(input, ['account', 'stopLossPrice']);
    if (!input.account || input.trade.stopLossPrice <= 0) {
      return createOutput(riskDisciplineSkill, input, {
        score: null,
        label: 'unknown',
        summary: 'Risk discipline cannot be scored because account rules or stop loss data is missing.',
        explanation: 'This skill needs local risk settings and a saved stop loss to calculate estimated risk percent.',
        evidence: { missingFields: missing, hasStopLoss: input.trade.stopLossPrice > 0 },
        output: { reason: 'missing_risk_inputs' },
      });
    }

    const risk = calculateTradeRiskMetrics(input.trade, input.account.currentBalance);
    const riskPercent = risk.estimatedRiskPercent;
    const maxRisk = input.account.maxRiskPerTradePercent;
    const ruleViolation = riskPercent !== null && riskPercent > maxRisk;
    let score = 100;
    if (ruleViolation) score -= 45;
    else if (riskPercent !== null && riskPercent > maxRisk * 0.8) score -= 15;
    if (input.trade.leverage > 5) score -= 25;
    if (risk.rrRatio === null) score -= 10;
    if (!input.trade.isFollowingSystem) score -= 12;

    const finalScore = clampScore(score);
    const label = riskLabel(finalScore, ruleViolation);

    return createOutput(riskDisciplineSkill, input, {
      score: finalScore,
      label,
      summary: `Risk discipline is ${label} against the saved local rules.`,
      explanation:
        'The score uses estimated risk percent, stop-loss distance, RR availability, leverage, and system fit. It does not expand risk or create execution instructions.',
      evidence: {
        estimatedRiskPercent: round(riskPercent),
        maxRiskPerTradePercent: maxRisk,
        maxDailyLossPercent: input.account.maxDailyLossPercent,
        stopLossDistancePercent: round(risk.stopLossDistancePercent),
        rrRatio: round(risk.rrRatio),
        leverage: input.trade.leverage,
        hasStopLoss: input.trade.stopLossPrice > 0,
        missingFields: missing,
      },
      output: {
        label,
        score: finalScore,
        ruleViolation,
      },
    });
  },
};

const marketContextSkill: SkillDefinition = {
  id: 'market_context_v1',
  name: 'Market Context',
  version: '1.0.0',
  description: 'Summarizes market state from the Feature Database.',
  category: 'market_context',
  inputSchema: ['TradeFeature'],
  outputSchema: ['label', 'summary', 'explanation', 'evidence'],
  safetyLevel: 'research_only',
  explanation: 'This skill describes current feature context without forecasting price movement.',
  run(input) {
    const missing = missingFields(input, ['feature', 'feature.trend', 'feature.dataQualityScore']);
    if (!input.feature) {
      return createOutput(marketContextSkill, input, {
        score: null,
        label: 'unknown',
        summary: 'Market context is unknown because feature data is missing.',
        explanation: 'Generate or refresh TradeFeatures before running this market-context skill.',
        evidence: { missingFields: missing },
        output: { reason: 'missing_feature_data' },
      });
    }

    const quality = input.feature.dataQualityScore;
    const volatility = input.feature.marketVolatility;
    const trend = input.feature.trend;
    const change24h = input.feature.change24h;
    let label = 'unknown';
    if (quality < 50) label = 'low_quality_data';
    else if ((volatility ?? 0) >= 5 || Math.abs(change24h ?? 0) >= 7) label = 'volatile';
    else if (trend === 'up' || trend === 'down') label = 'trending';
    else if (trend === 'flat') label = 'ranging';

    return createOutput(marketContextSkill, input, {
      score: quality,
      label,
      summary: `Market context is ${label} based on saved public-market features.`,
      explanation:
        'The label uses trend, RSI, ATR, MACD, volume, 24h change, volatility, and data quality. It describes state only and does not forecast outcomes.',
      evidence: {
        trend,
        rsi: round(input.feature.rsi),
        atr: round(input.feature.atr),
        macd: round(input.feature.macd),
        volume: round(input.feature.volume),
        change24h: round(change24h),
        marketVolatility: round(volatility),
        dataQualityScore: quality,
        missingFields: missing,
      },
      output: {
        label,
        dataQualityScore: quality,
      },
    });
  },
};

const disciplineLossReviewSkill: SkillDefinition = {
  id: 'discipline_loss_review_v1',
  name: 'Discipline Loss Review',
  version: '1.0.0',
  description: 'Reviews discipline-related behaviors after a trade is completed.',
  category: 'review',
  inputSchema: ['Trade'],
  outputSchema: ['score', 'label', 'summary', 'explanation', 'evidence'],
  safetyLevel: 'research_only',
  explanation: 'This skill supports calm review. It does not blame the user or prescribe trades.',
  run(input) {
    if (input.trade.status !== 'reviewed' || input.trade.lossType === null) {
      return createOutput(disciplineLossReviewSkill, input, {
        score: null,
        label: 'incomplete_review',
        summary: 'Review data is incomplete for this trade.',
        explanation: 'Complete the trade review before this skill classifies discipline-related behavior.',
        evidence: {
          status: input.trade.status,
          lossType: input.trade.lossType,
          missingFields: ['lossType', 'review fields'].filter(() => input.trade.lossType === null),
        },
        output: { reason: 'review_incomplete' },
      });
    }

    const disciplineFlags = [
      input.trade.followedPlan === false,
      input.trade.movedStopLoss === true,
      input.trade.addedPosition === true,
      input.trade.earlyTakeProfit === true,
      input.trade.impulsiveTrade === true,
    ].filter(Boolean).length;

    let label = input.trade.lossType;
    if (input.trade.lossType === 'discipline_loss' || disciplineFlags > 0) label = 'discipline_loss';

    const score = label === 'discipline_loss' ? 35 : label === 'strategy_loss' ? 75 : 85;

    return createOutput(disciplineLossReviewSkill, input, {
      score,
      label,
      summary: `Review classification is ${label}.`,
      explanation:
        'The classification uses followed-plan, moved-stop, added-position, early-target, impulsive-trade, and loss-type fields. A planned loss can still be high-quality execution.',
      evidence: {
        followedPlan: input.trade.followedPlan,
        movedStopLoss: input.trade.movedStopLoss,
        addedPosition: input.trade.addedPosition,
        earlyTakeProfit: input.trade.earlyTakeProfit,
        impulsiveTrade: input.trade.impulsiveTrade,
        lossType: input.trade.lossType,
        disciplineFlags,
      },
      output: {
        label,
        score,
      },
    });
  },
};

const setupPatternSkill: SkillDefinition = {
  id: 'setup_pattern_v1',
  name: 'Setup Pattern',
  version: '1.0.0',
  description: 'Classifies the recorded setup pattern using saved setup and feature context.',
  category: 'research',
  inputSchema: ['Trade', 'TradeFeature'],
  outputSchema: ['label', 'summary', 'explanation', 'evidence'],
  safetyLevel: 'research_only',
  explanation: 'This skill classifies recorded pattern context. It is not a signal.',
  run(input) {
    const setupType = input.feature?.setupType ?? input.trade.setupType;
    const label = setupLabel(setupType);
    const missing = missingFields(input, ['feature', 'feature.trend', 'feature.candlePattern']);
    const score = input.feature?.dataQualityScore ?? null;

    return createOutput(setupPatternSkill, input, {
      score,
      label,
      summary: `Setup pattern is classified as ${label}.`,
      explanation:
        'The classification uses the saved setup type with supporting trend, RSI, ATR, volume, volatility, candle pattern, final PnL, and plan-following fields when available.',
      evidence: {
        setupType,
        trend: input.feature?.trend ?? null,
        rsi: round(input.feature?.rsi),
        atr: round(input.feature?.atr),
        volume: round(input.feature?.volume),
        marketVolatility: round(input.feature?.marketVolatility),
        candlePattern: input.feature?.candlePattern ?? null,
        finalPnl: input.trade.pnl,
        followedPlan: input.trade.followedPlan,
        missingFields: missing,
      },
      output: {
        label,
        score,
      },
    });
  },
};

export const builtInSkills: SkillDefinition[] = [
  entryQualitySkill,
  riskDisciplineSkill,
  marketContextSkill,
  disciplineLossReviewSkill,
  setupPatternSkill,
];
