-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "locationPrecise" BOOLEAN NOT NULL DEFAULT false;
