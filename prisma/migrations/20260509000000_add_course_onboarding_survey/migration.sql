-- Add one-time course onboarding survey responses.

CREATE TYPE "CourseOnboardingSurveyStatus" AS ENUM ('SUBMITTED', 'SKIPPED');

CREATE TABLE "CourseOnboardingSurveyResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "CourseOnboardingSurveyStatus" NOT NULL,
    "goals" TEXT[] NOT NULL,
    "purchaseFactors" TEXT[] NOT NULL,
    "hesitation" TEXT,
    "alternatives" TEXT,
    "discoverySource" TEXT,
    "discoverySourceOther" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseOnboardingSurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseOnboardingSurveyResponse_userId_courseId_key"
    ON "CourseOnboardingSurveyResponse"("userId", "courseId");

CREATE INDEX "CourseOnboardingSurveyResponse_courseId_idx"
    ON "CourseOnboardingSurveyResponse"("courseId");

CREATE INDEX "CourseOnboardingSurveyResponse_status_idx"
    ON "CourseOnboardingSurveyResponse"("status");

ALTER TABLE "CourseOnboardingSurveyResponse"
    ADD CONSTRAINT "CourseOnboardingSurveyResponse_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseOnboardingSurveyResponse"
    ADD CONSTRAINT "CourseOnboardingSurveyResponse_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
