-- CreateTable
CREATE TABLE "Winner" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "category" TEXT,
    "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Winner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WinnerHistory" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "category" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "outcome" TEXT NOT NULL,
    "replacedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WinnerHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: enforces "one prize per person" at the database layer.
CREATE UNIQUE INDEX "Winner_userId_key" ON "Winner"("userId");

-- CreateIndex
CREATE INDEX "Winner_tier_idx" ON "Winner"("tier");

-- CreateIndex
CREATE INDEX "Winner_category_idx" ON "Winner"("category");

-- CreateIndex
CREATE INDEX "Winner_kycStatus_idx" ON "Winner"("kycStatus");

-- CreateIndex
CREATE INDEX "WinnerHistory_tier_idx" ON "WinnerHistory"("tier");

-- CreateIndex
CREATE INDEX "WinnerHistory_userId_idx" ON "WinnerHistory"("userId");
