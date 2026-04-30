import { phase1Flags } from '../config/phase1Flags';
import { journeyProcessQueue } from '../queues/journeyProcess.queue';
import { JourneyExecutionService } from './journeyExecutionService';

type JourneyEventType =
  | 'contact_created'
  | 'conversation_created'
  | 'message_received'
  | 'tag_added'
  | 'list_added';

type JourneyEventPayload = {
  contactId: string;
  channelId?: string | null;
  conversationId?: string | null;
  tagName?: string | null;
  listId?: string | null;
  messageContent?: string | null;
};

const journeyExecutionService = new JourneyExecutionService();

export async function dispatchJourneyEvent(
  eventType: JourneyEventType,
  payload: JourneyEventPayload,
): Promise<void> {
  if (phase1Flags.journeyQueueEnabled) {
    await journeyProcessQueue.enqueue(eventType, payload);
    return;
  }
  await journeyExecutionService.processEvent(eventType, payload);
}

