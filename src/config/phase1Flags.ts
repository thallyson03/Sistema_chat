function asBool(value: string | undefined, fallback = false): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export const phase1Flags = {
  webhookQueueEnabled: asBool(process.env.WEBHOOK_QUEUE_ENABLED, false),
  messageQueueEnabled: asBool(process.env.MESSAGE_QUEUE_ENABLED, false),
  botQueueEnabled: asBool(process.env.BOT_QUEUE_ENABLED, false),
  journeyQueueEnabled: asBool(process.env.JOURNEY_QUEUE_ENABLED, false),
  pipelineAutomationQueueEnabled: asBool(process.env.PIPELINE_AUTOMATION_QUEUE_ENABLED, false),
  realtimeScopedEventsEnabled: asBool(process.env.REALTIME_SCOPED_EVENTS_ENABLED, false),
  providerQueueFallbackEnabled: asBool(process.env.PROVIDER_QUEUE_FALLBACK_ENABLED, true),
  webhookIdempotencyEnabled: asBool(process.env.WEBHOOK_IDEMPOTENCY_ENABLED, true),
  messageIdempotencyEnabled: asBool(process.env.MESSAGE_IDEMPOTENCY_ENABLED, true),
  useBullMQ: asBool(process.env.USE_BULLMQ, false),
};

