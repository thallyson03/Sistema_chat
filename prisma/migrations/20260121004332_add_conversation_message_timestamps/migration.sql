-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "lastAgentMessageAt" TIMESTAMP(3),
ADD COLUMN     "lastCustomerMessageAt" TIMESTAMP(3);
