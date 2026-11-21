ALTER TABLE "Citizen" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "Citizen" ADD COLUMN "email" TEXT, ADD COLUMN "googleSub" TEXT;
CREATE UNIQUE INDEX "Citizen_email_key" ON "Citizen"("email");
CREATE UNIQUE INDEX "Citizen_googleSub_key" ON "Citizen"("googleSub");
CREATE TABLE "CitizenEmailVerification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "googleSub" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "next" TEXT NOT NULL DEFAULT '/me',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CitizenEmailVerification_tokenHash_key" ON "CitizenEmailVerification"("tokenHash");
