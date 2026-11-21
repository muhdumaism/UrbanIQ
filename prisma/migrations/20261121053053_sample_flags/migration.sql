-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false;
