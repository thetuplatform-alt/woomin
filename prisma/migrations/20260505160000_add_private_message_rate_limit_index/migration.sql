-- Add composite index used by the private-message rate limiter
-- (userId, isFromTeacher, createdAt DESC) avoids a full-table scan on every POST.
CREATE INDEX "LessonPrivateMessage_userId_isFromTeacher_createdAt_idx"
ON "LessonPrivateMessage"("userId", "isFromTeacher", "createdAt");
