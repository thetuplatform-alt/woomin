// components/main/player/floating-lesson-menu.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { List } from "lucide-react";

interface TOCItem {
  id: string;
  text: string;
  timestamp?: string; // 時間戳顯示文字，例如 "00:60"
  seconds?: number; // 時間戳秒數，用於跳轉影片
}

interface FloatingLessonMenuProps {
  content: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTimestampClick?: (seconds: number) => void;
  /** 是否正在閱讀文章（showMiniPlayer 模式） */
  isReadingArticle?: boolean;
  /** 當前影片播放時間（秒） */
  currentVideoTime?: number;
}

export function FloatingLessonMenu({
  content,
  open,
  onOpenChange,
  onTimestampClick,
  isReadingArticle = false,
  currentVideoTime = 0,
}: FloatingLessonMenuProps) {
  const [headings, setHeadings] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!content) {
      setHeadings([]);
      return;
    }

    // 更新 Regex，確保正確捕捉一級標題，並手動生成與渲染器一致的 ID
    const headingRegex = /^#\s+(.+)$/gm;
    const items: TOCItem[] = [];
    const usedIds = new Set<string>();
    let match;

    // 與 lesson-content.tsx 的 slugify 保持一致
    const slugify = (text: string) => {
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
    };

    // 移除 markdown 連結語法，模擬渲染後的純文字
    // 例如 [00:60](#t=60) -> 00:60
    const removeMarkdownLinks = (text: string) => {
      return text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    };

    // 提取時間戳連結的顯示文字和秒數
    // 例如從 [00:60](#t=60) 提取 { display: "00:60", seconds: 60 }
    const extractTimestamp = (
      text: string
    ): { display: string; seconds: number } | undefined => {
      const timestampMatch = text.match(/\[([^\]]*)\]\(#t=(\d+)\)/);
      if (timestampMatch) {
        return {
          display: timestampMatch[1],
          seconds: parseInt(timestampMatch[2], 10),
        };
      }
      return undefined;
    };

    while ((match = headingRegex.exec(content)) !== null) {
      const rawText = match[1].trim();

      // 提取時間戳（如果有的話）
      const timestampData = extractTimestamp(rawText);

      // 先移除 markdown 連結語法，取得渲染後的純文字
      const textForId = removeMarkdownLinks(rawText);
      const id = slugify(textForId);

      // 顯示文字也移除連結語法，保持乾淨
      const displayText = removeMarkdownLinks(rawText);

      // 處理重複 ID
      let finalId = id;
      let counter = 1;
      while (usedIds.has(finalId)) {
        finalId = `${id}-${counter++}`;
      }
      usedIds.add(finalId);

      items.push({
        id: finalId,
        text: displayText,
        timestamp: timestampData?.display,
        seconds: timestampData?.seconds,
      });
    }

    setHeadings(items);
  }, [content]);

  // 根據影片時間計算 activeId（影片模式）
  useEffect(() => {
    if (isReadingArticle || headings.length === 0) return;

    // 找到最後一個時間戳小於等於當前影片時間的標題
    let currentId = "";
    for (const item of headings) {
      if (item.seconds !== undefined && item.seconds <= currentVideoTime) {
        currentId = item.id;
      } else if (item.seconds !== undefined && item.seconds > currentVideoTime) {
        break;
      }
    }

    // 如果沒有找到（可能還沒到第一個時間戳），使用第一個標題
    if (!currentId && headings.length > 0) {
      currentId = headings[0].id;
    }

    if (currentId && currentId !== activeId) {
      setActiveId(currentId);
    }
  }, [headings, currentVideoTime, isReadingArticle, activeId]);

  // 根據文章捲動計算 activeId（文章模式）
  useEffect(() => {
    if (!isReadingArticle || headings.length === 0) return;

    const handleScroll = () => {
      // 增加偏移量，確保標題通過影片區塊後才觸發
      const scrollPosition = window.scrollY + 150;

      let currentId = "";
      for (const item of headings) {
        const element = document.getElementById(item.id);
        if (element) {
          if (element.offsetTop <= scrollPosition) {
            currentId = item.id;
          } else {
            break;
          }
        }
      }

      if (currentId && currentId !== activeId) {
        setActiveId(currentId);
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [headings, isReadingArticle, activeId]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    console.log('Searching for element with ID:', id, 'Found:', !!element);
    
    if (element) {
      const isMobile = window.innerWidth < 768;
      // 找到 sticky 影片容器（如果有的話）
      const videoElement = document.querySelector('section.sticky');
      const videoHeight = videoElement ? videoElement.getBoundingClientRect().height : 0;
      
      // 計算最終捲動位置
      const offset = isMobile ? videoHeight + 20 : 100;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      onOpenChange(false);
    } else {
      // 如果找不到，嘗試使用更通用的選擇器（預防 ID 生成微差）
      const allHeadings = Array.from(document.querySelectorAll('h1'));
      const target = allHeadings.find(h => h.id === id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        onOpenChange(false);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-[55]"
          />

          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-[88px] right-6 z-[60] w-[calc(100vw-48px)] max-w-[400px] overflow-hidden rounded-[24px] bg-[#1A1A1A] text-white shadow-2xl border border-white/5"
          >
            <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5 bg-white/5">
              <List className="h-4 w-4 text-cta" />
              <span className="text-sm font-bold">目錄</span>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-3 custom-scrollbar">
              <div className="space-y-0.5">
                {headings.map((item, index) => {
                  const isActive = activeId === item.id;

                  return (
                    <div
                      key={`${item.id}-${index}`}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-all",
                        isActive
                          ? "text-white font-bold bg-white/10"
                          : "text-white/40 hover:text-white/60"
                      )}
                    >
                      {/* 左側圓點指示器 */}
                      <div className="flex items-center justify-center w-4 shrink-0">
                        {isActive ? (
                          <div className="h-1.5 w-1.5 rounded-full bg-cta shadow-[0_0_8px_rgba(245,165,36,0.4)]" />
                        ) : (
                          <div className="h-1 w-1 rounded-full bg-white/10" />
                        )}
                      </div>

                      {/* 標題文字 - 點擊跳轉頁面 */}
                      <button
                        onClick={() => scrollToHeading(item.id)}
                        className="flex-1 text-sm font-bold truncate text-left"
                      >
                        {item.text}
                      </button>

                      {/* 時間按鈕 - 點擊跳轉影片時間 */}
                      {item.timestamp && item.seconds !== undefined && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTimestampClick?.(item.seconds!);
                          }}
                          className="shrink-0 inline-flex items-center gap-0.5 rounded-full border border-white/20 px-2 py-0.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white hover:border-white/40 opacity-0 group-hover:opacity-100"
                        >
                          <svg
                            className="h-3 w-3"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          <span>{item.timestamp}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
                {headings.length === 0 && (
                  <div className="py-8 text-center text-white/20 text-sm">
                    此章節尚未建立目錄
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
