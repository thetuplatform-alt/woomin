// components/main/player/curriculum-list.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  CheckCircle2,
  Play,
  ChevronRight,
  Lock,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CourseCurriculumForPlayer } from "@/lib/actions/lesson";
import type { CourseDetail } from "@/lib/actions/public-courses";
import { Button } from "@/components/ui/button";

interface CurriculumListProps {
  curriculum: CourseCurriculumForPlayer;
  currentLessonId: string;
  completedLessons: string[];
  courseSlug: string;
  courseProgress?: {
    totalLessons: number;
    completedLessons: number;
    progressPercentage: number;
  };
  onItemClick?: () => void;
  onToggleComplete?: (lessonId: string, completed: boolean) => void;
  blockedLessonIds?: string[];
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined || seconds <= 0) return "";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function getChapterCompletedCount(
  lessons: { id: string }[],
  completedLessons: string[]
): number {
  return lessons.filter((lesson) => completedLessons.includes(lesson.id))
    .length;
}

export function CurriculumList({
  curriculum,
  currentLessonId,
  completedLessons,
  courseSlug,
  courseProgress,
  onItemClick,
  onToggleComplete,
  blockedLessonIds = [],
}: CurriculumListProps) {
  const router = useRouter();
  const currentChapterId = curriculum.chapters.find((chapter) =>
    chapter.lessons.some((lesson) => lesson.id === currentLessonId)
  )?.id;

  /**
   * 處理圓點點擊事件（切換完成狀態）
   */
  const handleToggleComplete = (
    e: React.MouseEvent,
    lessonId: string,
    isCurrentlyCompleted: boolean
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleComplete?.(lessonId, !isCurrentlyCompleted);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 章節列表 */}
      <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {curriculum.chapters.map((chapter) => {
          const chapterCompletedCount = getChapterCompletedCount(
            chapter.lessons,
            completedLessons
          );
          const isChapterCompleted =
            chapterCompletedCount === chapter.lessons.length &&
            chapter.lessons.length > 0;

          return (
            <Collapsible
              key={chapter.id}
              defaultOpen={chapter.id === currentChapterId}
              className="mb-3"
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left text-sm font-bold text-gray-900 hover:bg-gray-50 transition-colors group">
                <span className="flex flex-1 items-center gap-3">
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border text-[10px]",
                      isChapterCompleted
                        ? "bg-cta/10 border-cta text-cta"
                        : "border-gray-200 text-gray-400 group-hover:border-gray-300"
                    )}
                  >
                    {isChapterCompleted ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      chapter.order + 1
                    )}
                  </div>
                  <span className={cn(isChapterCompleted && "text-cta")}>
                    {chapter.title}
                  </span>
                </span>
                <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {chapterCompletedCount}/{chapter.lessons.length}
                </span>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <ul className="ml-7 mt-1.5 space-y-1 border-l-2 border-gray-50 py-1">
                  {chapter.lessons.map((lesson) => {
                    const isCurrentLesson = lesson.id === currentLessonId;
                    const isCompleted = completedLessons.includes(lesson.id);
                    const isComingSoon = lesson.status === "COMING_SOON";
                    const isBlocked = blockedLessonIds.includes(lesson.id);

                    return (
                      <li key={lesson.id}>
                        <div
                          className={cn(
                            "flex items-center gap-3 py-3 pl-5 pr-3 text-sm transition-all relative",
                            isBlocked
                              ? "text-gray-300 cursor-not-allowed rounded-r-xl"
                              : isComingSoon
                                ? "text-gray-400 hover:bg-gray-50 rounded-r-xl cursor-pointer"
                                : isCurrentLesson
                                  ? "bg-[#FEF3C7]/50 font-bold text-cta rounded-r-xl before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-cta cursor-pointer"
                                  : isCompleted
                                    ? "text-gray-500 hover:bg-gray-50 rounded-r-xl cursor-pointer"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-r-xl cursor-pointer"
                          )}
                          onClick={() => {
                            if (isBlocked) return;
                            onItemClick?.();
                            router.push(
                              `/courses/${courseSlug}/lessons/${lesson.id}`
                            );
                          }}
                        >
                          {/* 可點擊的進度圓點按鈕 */}
                          <button
                            type="button"
                            onClick={(e) =>
                              handleToggleComplete(e, lesson.id, isCompleted)
                            }
                            disabled={isComingSoon || isBlocked}
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all",
                              isBlocked
                                ? "border-2 border-gray-200 cursor-not-allowed"
                                : isComingSoon
                                  ? "border-2 border-gray-200 cursor-not-allowed"
                                  : isCompleted
                                    ? "bg-cta hover:bg-cta-hover"
                                    : isCurrentLesson
                                      ? "border-2 border-cta hover:bg-cta/10"
                                      : "border-2 border-gray-200 hover:border-cta hover:bg-cta/10"
                            )}
                            title={
                              isBlocked
                                ? "請先通過前一單元的測驗"
                                : isComingSoon
                                  ? "製作中"
                                  : isCompleted
                                    ? "點擊取消完成"
                                    : "點擊標記完成"
                            }
                          >
                            {isBlocked ? (
                              <Lock className="h-2.5 w-2.5 text-gray-300" />
                            ) : isComingSoon ? (
                              <Clock className="h-2.5 w-2.5 text-gray-300" />
                            ) : isCompleted ? (
                              <Check className="h-2.5 w-2.5 text-white" />
                            ) : isCurrentLesson ? (
                              <div className="h-2 w-2 rounded-full bg-cta animate-pulse" />
                            ) : null}
                          </button>

                          <span className="flex-1 truncate">
                            {lesson.title}
                          </span>

                          <div className="flex shrink-0 items-center gap-2">
                            {/* 製作中標籤優先顯示 */}
                            {isComingSoon ? (
                              <Badge className="bg-gray-100 text-gray-400 text-[10px] border-none font-medium">
                                製作中
                              </Badge>
                            ) : (
                              <>
                                {lesson.videoDuration && (
                                  <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                                    <Clock className="h-3 w-3" />
                                    {formatDuration(lesson.videoDuration)}
                                  </span>
                                )}
                                {lesson.isFree && !isCompleted && (
                                  <Badge className="bg-cta/10 text-cta text-[10px] border-none font-bold">
                                    試看
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * 已購買用戶的課程大綱列表
 * 用於銷售頁面顯示可點擊進入的課程列表
 */
interface PurchasedCurriculumListProps {
  course: CourseDetail;
  firstLessonId: string | null;
}

export function PurchasedCurriculumList({
  course,
  firstLessonId,
}: PurchasedCurriculumListProps) {
  return (
    <section className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* 標題 */}
        <div className="mb-8 flex flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-sm font-semibold text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              已購買課程
            </div>
            <h2 className="mt-4 text-2xl font-bold text-heading sm:text-3xl">
              課程大綱
            </h2>
            <p className="mt-2 text-body">
              共 {course.chapters.length} 個章節，{course.lessonCount} 個單元
            </p>
          </div>

          {firstLessonId && (
            <Button
              asChild
              size="lg"
              className="mt-6 rounded-full bg-cta px-8 text-base font-semibold text-white hover:bg-cta-hover sm:mt-0"
            >
              <Link href={`/courses/${course.slug}/lessons/${firstLessonId}`}>
                <Play className="mr-2 h-4 w-4" />
                進入課程
              </Link>
            </Button>
          )}
        </div>

        {/* 章節列表 */}
        <div className="space-y-4">
          {course.chapters.map((chapter, chapterIndex) => (
            <Collapsible
              key={chapter.id}
              defaultOpen={chapterIndex === 0}
              className="overflow-hidden rounded-2xl border border-divider bg-white"
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cta/10 text-sm font-bold text-cta">
                    {chapterIndex + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-heading">
                      {chapter.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-caption">
                      {chapter.lessons.length} 個單元
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-caption transition-transform ui-open:rotate-90" />
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t border-divider px-6 py-2">
                  <ul className="divide-y divide-divider">
                    {chapter.lessons.map((lesson) => {
                      const isComingSoon = lesson.status === "COMING_SOON";

                      return (
                        <li key={lesson.id}>
                          <Link
                            href={`/courses/${course.slug}/lessons/${lesson.id}`}
                            className={cn(
                              "flex items-center gap-4 py-4 transition-colors hover:bg-gray-50",
                              isComingSoon && "opacity-60"
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                isComingSoon
                                  ? "bg-gray-100 text-gray-400"
                                  : "bg-surface text-cta"
                              )}
                            >
                              {isComingSoon ? (
                                <Clock className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <span
                              className={cn(
                                "flex-1",
                                isComingSoon
                                  ? "text-gray-400"
                                  : "text-body"
                              )}
                            >
                              {lesson.title}
                            </span>
                            <div className="flex items-center gap-3">
                              {isComingSoon ? (
                                <Badge className="border-none bg-gray-100 text-xs font-medium text-gray-400">
                                  製作中
                                </Badge>
                              ) : (
                                <>
                                  {lesson.videoDuration && (
                                    <span className="flex items-center gap-1 text-sm text-caption">
                                      <Clock className="h-3.5 w-3.5" />
                                      {formatDuration(lesson.videoDuration)}
                                    </span>
                                  )}
                                  {lesson.isFree && (
                                    <Badge className="border-none bg-cta/10 text-xs font-bold text-cta">
                                      試看
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </div>
    </section>
  );
}
