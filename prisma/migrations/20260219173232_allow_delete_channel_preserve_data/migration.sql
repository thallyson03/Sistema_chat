-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_channelId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_channelId_fkey";

-- AlterTable
ALTER TABLE "Contact" ALTER COLUMN "channelId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "channelId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
