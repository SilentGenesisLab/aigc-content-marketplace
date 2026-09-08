CREATE TYPE "SmsPurpose" AS ENUM ('REGISTER', 'LOGIN');

CREATE TABLE "SmsVerification" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "SmsPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SmsVerification_phone_purpose_createdAt_idx"
ON "SmsVerification"("phone", "purpose", "createdAt");

CREATE INDEX "SmsVerification_expiresAt_idx"
ON "SmsVerification"("expiresAt");
