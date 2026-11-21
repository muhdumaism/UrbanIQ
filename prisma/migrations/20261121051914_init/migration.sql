-- CreateEnum
CREATE TYPE "Category" AS ENUM ('ROADS', 'WASTE', 'WATER_SUPPLY', 'STREETLIGHTING', 'ELECTRICAL_HAZARDS', 'TREES', 'STORMWATER_DRAINAGE', 'SEWERAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'NEEDS_REVIEW', 'WAITING_FOR_DETAILS', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'TRIAGED', 'FAILED');

-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('DEVICE', 'PIN', 'LANDMARK', 'NONE');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('ORIGINAL', 'AUTO_LINKED', 'OFFICER_LINKED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SuggestionKind" AS ENUM ('POSSIBLE_DUPLICATE', 'POSSIBLE_RECURRENCE');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "OfficerRole" AS ENUM ('OFFICER', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('SYSTEM', 'OFFICER', 'CITIZEN');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateEnum
CREATE TYPE "InfoRequestKind" AS ENUM ('LOCATION', 'DETAIL');

-- CreateEnum
CREATE TYPE "InfoRequestStatus" AS ENUM ('OPEN', 'ANSWERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingRule" (
    "id" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "wardCode" TEXT NOT NULL DEFAULT '*',
    "departmentId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Officer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "OfficerRole" NOT NULL DEFAULT 'OFFICER',
    "departmentId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Officer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficerSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "trackingTokenHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "text" TEXT,
    "photoKey" TEXT,
    "photoMime" TEXT,
    "photoWidth" INTEGER,
    "photoHeight" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "locationText" TEXT,
    "locationSource" "LocationSource" NOT NULL DEFAULT 'NONE',
    "locationConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "wardCode" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'RECEIVED',
    "triage" JSONB,
    "triageProvider" TEXT,
    "triageError" TEXT,
    "severity" "Severity",
    "severityReason" TEXT,
    "ticketId" TEXT,
    "linkType" "LinkType",
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "subtype" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "severityReason" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "departmentId" TEXT,
    "urgentReview" BOOLEAN NOT NULL DEFAULT false,
    "needsReevaluation" BOOLEAN NOT NULL DEFAULT false,
    "reviewReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "wardCode" TEXT,
    "locationText" TEXT,
    "publicNote" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuplicateSuggestion" (
    "id" TEXT NOT NULL,
    "kind" "SuggestionKind" NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reportId" TEXT NOT NULL,
    "sourceTicketId" TEXT NOT NULL,
    "candidateTicketId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "distanceMeters" DOUBLE PRECISION,
    "explanation" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicateSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfoRequest" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "kind" "InfoRequestKind" NOT NULL,
    "question" TEXT NOT NULL,
    "status" "InfoRequestStatus" NOT NULL DEFAULT 'OPEN',
    "answer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "InfoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "reportId" TEXT,
    "actorType" "ActorType" NOT NULL,
    "officerId" TEXT,
    "type" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'INTERNAL',
    "publicMessage" TEXT,
    "note" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RoutingRule_subtype_wardCode_key" ON "RoutingRule"("subtype", "wardCode");

-- CreateIndex
CREATE UNIQUE INDEX "Officer_email_key" ON "Officer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OfficerSession_tokenHash_key" ON "OfficerSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reference_key" ON "Report"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Report_trackingTokenHash_key" ON "Report"("trackingTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Report_idempotencyKey_key" ON "Report"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Report_ticketId_idx" ON "Report"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_reference_key" ON "Ticket"("reference");

-- CreateIndex
CREATE INDEX "Ticket_status_severity_createdAt_idx" ON "Ticket"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_subtype_status_idx" ON "Ticket"("subtype", "status");

-- CreateIndex
CREATE INDEX "TicketEvent_ticketId_createdAt_idx" ON "TicketEvent"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_status_runAfter_idx" ON "Job"("status", "runAfter");

-- AddForeignKey
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Officer" ADD CONSTRAINT "Officer_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerSession" ADD CONSTRAINT "OfficerSession_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateSuggestion" ADD CONSTRAINT "DuplicateSuggestion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateSuggestion" ADD CONSTRAINT "DuplicateSuggestion_sourceTicketId_fkey" FOREIGN KEY ("sourceTicketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateSuggestion" ADD CONSTRAINT "DuplicateSuggestion_candidateTicketId_fkey" FOREIGN KEY ("candidateTicketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfoRequest" ADD CONSTRAINT "InfoRequest_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfoRequest" ADD CONSTRAINT "InfoRequest_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
