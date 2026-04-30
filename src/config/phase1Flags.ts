function asBool(value: string | undefined, fallback = false): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export const phase1Flags = {
  webhookQueueEnabled: asBool(process.env.WEBHOOK_QUEUE_ENABLED, false),
  messageQueueEnabled: asBool(process.env.MESSAGE_QUEUE_ENABLED, false),
  botQueueEnabled: asBool(process.env.BOT_QUEUE_ENABLED, false),
  webhookIdempotencyEnabled: asBool(process.env.WEBHOOK_IDEMPOTENCY_ENABLED, true),
  messageIdempotencyEnabled: asBool(process.env.MESSAGE_IDEMPOTENCY_ENABLED, true),
  useBullMQ: asBool(process.env.USE_BULLMQ, false),
};

