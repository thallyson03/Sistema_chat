-- Finalização: remover colunas legadas do Contact e tornar phone obrigatório/único

UPDATE "Contact"
SET "phone" = regexp_replace(COALESCE("phone", "channelIdentifier", ''), '\D', '', 'g')
WHERE "phone" IS NULL OR TRIM("phone") = '';

DELETE FROM "Contact"
WHERE "phone" IS NULL OR length(regexp_replace("phone", '\D', '', 'g')) < 10;

UPDATE "Contact" SET "phone" = regexp_replace("phone", '\D', '', 'g');

ALTER TABLE "Contact" DROP CONSTRAINT IF EXISTS "Contact_channelId_fkey";
DROP INDEX IF EXISTS "Contact_channelId_channelIdentifier_key";
DROP INDEX IF EXISTS "Contact_channelId_idx";

ALTER TABLE "Contact" DROP COLUMN IF EXISTS "channelId";
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "channelIdentifier";

ALTER TABLE "Contact" ALTER COLUMN "phone" SET NOT NULL;

DROP INDEX IF EXISTS "Contact_phone_key";
CREATE UNIQUE INDEX "Contact_phone_key" ON "Contact"("phone");
