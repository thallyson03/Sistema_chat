-- Backfill manual (produção) se o script Node não estiver disponível no container.
-- Executar: npx prisma db execute --file scripts/migrateContactArchitecture.sql

UPDATE "Conversation" conv
SET "channelSnapshot" = jsonb_build_object(
    'channelId', ch."id",
    'name', ch."name",
    'type', ch."type",
    'status', ch."status",
    'provider', COALESCE(ch."config"->>'provider', CASE WHEN ch."evolutionInstanceId" IS NOT NULL THEN 'evolution' END),
    'evolutionInstanceId', ch."evolutionInstanceId",
    'phoneNumberId', ch."config"->>'phoneNumberId',
    'capturedAt', to_jsonb(NOW()::text)
)
FROM "Channel" ch
WHERE conv."channelId" = ch."id"
  AND conv."channelSnapshot" IS NULL;

INSERT INTO "ContactChannelIdentity" ("id", "contactId", "channelId", "externalId", "createdAt", "updatedAt")
SELECT
    md5(random()::text || c."id" || conv."channelId")::text,
    c."id",
    conv."channelId",
    regexp_replace(c."phone", '\D', '', 'g'),
    NOW(),
    NOW()
FROM "Conversation" conv
INNER JOIN "Contact" c ON c."id" = conv."contactId"
WHERE conv."channelId" IS NOT NULL
  AND length(regexp_replace(c."phone", '\D', '', 'g')) >= 10
ON CONFLICT ("channelId", "externalId") DO UPDATE
SET "contactId" = EXCLUDED."contactId",
    "lastSeenAt" = NOW(),
    "updatedAt" = NOW();
