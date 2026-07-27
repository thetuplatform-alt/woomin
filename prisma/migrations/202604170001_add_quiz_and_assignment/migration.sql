-- 單元測驗與單元作業功能
-- 新增 Quiz、QuizQuestion、QuizAttempt、Assignment、AssignmentSubmission、AssignmentAttachment、AssignmentReview、AssignmentDraft models
-- 新增 7 個 enum types
-- 新增 AdminAction 的 7 個值

-- ==================== 新增 Enum Types ====================

CREATE TYPE "QuizQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_BLANK');

CREATE TYPE "ShowAnswersStrategy" AS ENUM ('IMMEDIATELY', 'AFTER_PASS', 'NEVER');

CREATE TYPE "AssignmentSubmissionType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'MIXED');

CREATE TYPE "AssignmentEditorMode" AS ENUM ('PLAIN', 'MARKDOWN');

CREATE TYPE "AssignmentGradingType" AS ENUM ('PASS_FAIL', 'PERCENTAGE', 'LETTER_GRADE');

CREATE TYPE "AssignmentSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'NEEDS_REVISION', 'REJECTED');

CREATE TYPE "AssignmentReviewStatus" AS ENUM ('APPROVED', 'NEEDS_REVISION', 'REJECTED');

CREATE TYPE "AssignmentAttachmentType" AS ENUM ('IMAGE', 'FILE');

-- ==================== 建立 Table: Quiz ====================

CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "passingScore" INTEGER NOT NULL DEFAULT 60,
    "timeLimitMinutes" INTEGER,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
    "showAnswers" "ShowAnswersStrategy" NOT NULL DEFAULT 'IMMEDIATELY',
    "blockNextLesson" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Quiz_lessonId_key" ON "Quiz"("lessonId");

ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ==================== 建立 Table: QuizQuestion ====================

CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "type" "QuizQuestionType" NOT NULL,
    "content" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswer" JSONB NOT NULL,
    "explanation" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuizQuestion_quizId_order_idx" ON "QuizQuestion"("quizId", "order");

ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey"
  FOREIGN KEY ("quizId") REFERENCES "Quiz"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ==================== 建立 Table: QuizAttempt ====================
-- 注意：quizId 為 nullable，使用 SetNull 以保留作答紀錄
-- 即使 Quiz 被刪除，學員的作答歷史仍可查閱

CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT,
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "timeTakenSeconds" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuizAttempt_quizId_userId_idx" ON "QuizAttempt"("quizId", "userId");
CREATE INDEX "QuizAttempt_userId_quizId_idx" ON "QuizAttempt"("userId", "quizId");

ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey"
  FOREIGN KEY ("quizId") REFERENCES "Quiz"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ==================== 建立 Table: Assignment ====================

CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "submissionType" "AssignmentSubmissionType" NOT NULL,
    "editorMode" "AssignmentEditorMode" NOT NULL DEFAULT 'MARKDOWN',
    "minWords" INTEGER,
    "maxWords" INTEGER,
    "maxImages" INTEGER DEFAULT 10,
    "maxImageSize" INTEGER DEFAULT 10485760,
    "maxFiles" INTEGER DEFAULT 5,
    "maxFileSize" INTEGER DEFAULT 20971520,
    "allowedExtensions" JSONB,
    "gradingType" "AssignmentGradingType" NOT NULL DEFAULT 'PASS_FAIL',
    "passingScore" INTEGER DEFAULT 60,
    "deadline" TIMESTAMP(3),
    "allowLateSubmission" BOOLEAN NOT NULL DEFAULT false,
    "allowResubmission" BOOLEAN NOT NULL DEFAULT true,
    "autoCleanupDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Assignment_lessonId_key" ON "Assignment"("lessonId");

ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ==================== 建立 Table: AssignmentSubmission ====================

CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT,
    "contentFormat" "AssignmentEditorMode",
    "wordCount" INTEGER,
    "status" "AssignmentSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssignmentSubmission_assignmentId_userId_idx" ON "AssignmentSubmission"("assignmentId", "userId");
CREATE INDEX "AssignmentSubmission_assignmentId_status_idx" ON "AssignmentSubmission"("assignmentId", "status");
CREATE INDEX "AssignmentSubmission_userId_idx" ON "AssignmentSubmission"("userId");

ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ==================== 建立 Table: AssignmentAttachment ====================

CREATE TABLE "AssignmentAttachment" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageDriver" TEXT NOT NULL,
    "type" "AssignmentAttachmentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssignmentAttachment_submissionId_idx" ON "AssignmentAttachment"("submissionId");

ALTER TABLE "AssignmentAttachment" ADD CONSTRAINT "AssignmentAttachment_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ==================== 建立 Table: AssignmentReview ====================

CREATE TABLE "AssignmentReview" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "AssignmentReviewStatus" NOT NULL,
    "feedback" TEXT,
    "score" INTEGER,
    "letterGrade" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssignmentReview_submissionId_idx" ON "AssignmentReview"("submissionId");
CREATE INDEX "AssignmentReview_reviewerId_idx" ON "AssignmentReview"("reviewerId");

ALTER TABLE "AssignmentReview" ADD CONSTRAINT "AssignmentReview_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssignmentReview" ADD CONSTRAINT "AssignmentReview_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==================== 建立 Table: AssignmentDraft ====================

CREATE TABLE "AssignmentDraft" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT,
    "contentFormat" "AssignmentEditorMode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssignmentDraft_userId_idx" ON "AssignmentDraft"("userId");
CREATE UNIQUE INDEX "AssignmentDraft_assignmentId_userId_key" ON "AssignmentDraft"("assignmentId", "userId");

ALTER TABLE "AssignmentDraft" ADD CONSTRAINT "AssignmentDraft_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssignmentDraft" ADD CONSTRAINT "AssignmentDraft_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
