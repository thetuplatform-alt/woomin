// components/main/player/lesson-complete-modal.tsx
// 單元完成 Modal
// 影片播放完成後顯示，提供前往下一單元的按鈕，並帶有煙花慶祝特效

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ReviewModal } from "@/components/main/landing/review-modal";
import type { AdjacentLessons } from "@/lib/actions/lesson";
import type { CourseProgressStats } from "@/lib/validations/progress";
import posthog from "posthog-js";

interface LessonCompleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adjacentLessons: AdjacentLessons;
  courseSlug: string;
  courseProgress?: CourseProgressStats;
  courseId?: string;
  hasReview?: boolean;
  showReviews?: boolean;
}

/**
 * 煙花粒子介面
 */
interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  shape: "circle" | "square" | "triangle";
}

/**
 * 煙花特效組件
 */
function Confetti({ isActive }: { isActive: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  const createParticles = useCallback(() => {
    const colors = [
      "#F5A524", // 橘色（強調色）
      "#FCD34D", // 金黃色
      "#FB923C", // 淺橘色
      "#F97316", // 深橘色
      "#FBBF24", // 琥珀色
      "#FDE68A", // 淺黃色
    ];
    const shapes: ("circle" | "square" | "triangle")[] = ["circle", "square", "triangle"];
    const newParticles: Particle[] = [];

    // 從多個發射點發射粒子
    const emitPoints = [
      { x: 20, y: 100 },  // 左側
      { x: 80, y: 100 },  // 右側
      { x: 50, y: 100 },  // 中間
    ];

    emitPoints.forEach((point) => {
      for (let i = 0; i < 25; i++) {
        newParticles.push({
          id: Math.random(),
          x: point.x + (Math.random() - 0.5) * 20,
          y: point.y,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 8 + 4,
          velocityX: (Math.random() - 0.5) * 15,
          velocityY: -(Math.random() * 20 + 10),
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 20,
          opacity: 1,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
        });
      }
    });

    setParticles(newParticles);
  }, []);

  useEffect(() => {
    if (isActive) {
      createParticles();
      // 多波次發射
      const timer1 = setTimeout(createParticles, 200);
      const timer2 = setTimeout(createParticles, 400);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      setParticles([]);
    }
  }, [isActive, createParticles]);

  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.velocityX * 0.1,
            y: p.y + p.velocityY * 0.1,
            velocityY: p.velocityY + 0.5, // 重力
            rotation: p.rotation + p.rotationSpeed,
            opacity: p.opacity - 0.015,
          }))
          .filter((p) => p.opacity > 0)
      );
    }, 16);

    return () => clearInterval(interval);
  }, [particles.length]);

  if (!isActive && particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[102] overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            opacity: particle.opacity,
            transform: `rotate(${particle.rotation}deg)`,
          }}
        >
          {particle.shape === "circle" && (
            <div
              className="rounded-full"
              style={{
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
              }}
            />
          )}
          {particle.shape === "square" && (
            <div
              style={{
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
              }}
            />
          )}
          {particle.shape === "triangle" && (
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: `${particle.size / 2}px solid transparent`,
                borderRight: `${particle.size / 2}px solid transparent`,
                borderBottom: `${particle.size}px solid ${particle.color}`,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function LessonCompleteModal({
  open,
  onOpenChange,
  adjacentLessons,
  courseSlug,
  courseProgress,
  courseId,
  hasReview,
  showReviews,
}: LessonCompleteModalProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const isCourseComplete =
    courseProgress && courseProgress.progressPercentage === 100;
  const showReviewPrompt = isCourseComplete && !hasReview && !!courseId && showReviews;

  // 當 Modal 開啟時觸發煙花
  useEffect(() => {
    if (open) {
      setShowConfetti(true);
      // 3 秒後停止產生新煙花
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // 處理前往下一單元
  const handleNextLesson = () => {
    if (adjacentLessons.next) {
      setIsNavigating(true);
      router.push(`/courses/${courseSlug}/lessons/${adjacentLessons.next.id}`);
      onOpenChange(false);
    }
  };

  // 處理繼續留在本頁
  const handleStayOnPage = () => {
    onOpenChange(false);
  };

  // ESC 鍵關閉
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  return (
    <>
      {/* 煙花特效層 - z-index 要高於 Modal */}
      <Confetti isActive={showConfetti} />

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] bg-black/40"
              onClick={handleStayOnPage}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed left-1/2 top-1/2 z-[101] w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2"
            >
              <div className="relative overflow-hidden rounded-2xl bg-white p-8 shadow-2xl border border-divider">
                {/* 關閉按鈕 */}
                <button
                  onClick={handleStayOnPage}
                  className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-caption transition-colors hover:bg-divider hover:text-body"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* 標題區域 */}
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-heading">
                    單元完成
                  </h2>
                </div>

                {/* 進度區域 */}
                {courseProgress && courseProgress.totalLessons > 0 && (
                  <div className="mt-8">
                    {/* 進度指示器 */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cta">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                      <Progress
                        value={courseProgress.progressPercentage}
                        className="flex-1 h-2 bg-surface-hover [&>div]:bg-cta"
                      />
                      <span className="text-sm font-bold text-cta">
                        {courseProgress.progressPercentage}%
                      </span>
                    </div>
                  </div>
                )}

                {/* 操作按鈕區域 */}
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button
                    variant="ghost"
                    onClick={handleStayOnPage}
                    className="rounded-full border border-divider bg-transparent px-6 py-5 text-sm font-medium text-body hover:bg-surface hover:text-heading"
                  >
                    留在本頁
                  </Button>

                  {adjacentLessons.next ? (
                    <Button
                      onClick={handleNextLesson}
                      disabled={isNavigating}
                      className="rounded-full bg-cta px-6 py-5 text-sm font-bold text-white hover:bg-cta-hover"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      下一單元
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        // PostHog: Track course completion when user clicks "完成課程"
                        posthog.capture("course_completed", {
                          course_slug: courseSlug,
                          total_lessons: courseProgress?.totalLessons,
                          completed_lessons: courseProgress?.completedLessons,
                          progress_percentage: courseProgress?.progressPercentage,
                        });
                        router.push(`/courses/${courseSlug}`);
                      }}
                      className="rounded-full bg-cta px-6 py-5 text-sm font-bold text-white hover:bg-cta-hover"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      完成課程
                    </Button>
                  )}
                </div>

                {/* 完課評價提示 */}
                {showReviewPrompt && (
                  <div className="mt-4 flex justify-center border-t border-divider pt-4">
                    <button
                      onClick={() => setShowReviewModal(true)}
                      className="flex items-center gap-2 text-sm font-medium text-cta transition-colors hover:text-cta-hover"
                    >
                      <Star className="h-4 w-4" />
                      課程已完成！來分享你的學習心得吧
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Review Modal */}
      {courseId && (
        <ReviewModal
          open={showReviewModal}
          onOpenChange={setShowReviewModal}
          courseId={courseId}
        />
      )}
    </>
  );
}
