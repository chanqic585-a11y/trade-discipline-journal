import { createTradeTimelineEvent } from '../db/repositories';
import { TimelineEventType } from '../types';

interface TimelineInput {
  tradeId: number;
  eventType: TimelineEventType;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function createTimelineEvent(input: TimelineInput) {
  return createTradeTimelineEvent({
    tradeId: input.tradeId,
    eventType: input.eventType,
    title: input.title,
    description: input.description,
    metadataJson: JSON.stringify(input.metadata ?? {}),
  });
}
