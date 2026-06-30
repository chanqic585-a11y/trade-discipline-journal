import { EmotionBefore, LossType, MarketType, SetupType } from './types';

export const marketTypeLabels: Record<MarketType, string> = {
  spot: '现货',
  futures: '合约',
};

export const directionLabels = {
  long: '做多',
  short: '做空',
} as const;

export const setupTypeLabels: Record<SetupType, string> = {
  new_listing_pullback_breakout: '新币上市首次回踩突破',
  volume_breakout_previous_high: '放量突破前高',
  extreme_fear_rebound: '极端恐慌反弹',
  other: '其他',
};

export const emotionLabels: Record<EmotionBefore, string> = {
  calm: '冷静',
  anxious: '焦虑',
  greedy: '贪婪',
  revenge: '想回本',
  fomo: '害怕错过',
};

export const lossTypeLabels: Record<LossType, string> = {
  strategy_loss: '策略亏损',
  discipline_loss: '纪律亏损',
  no_loss: '无亏损',
};

export const setupTypeOptions = Object.keys(setupTypeLabels) as SetupType[];
export const emotionOptions = Object.keys(emotionLabels) as EmotionBefore[];
export const lossTypeOptions = Object.keys(lossTypeLabels) as LossType[];
