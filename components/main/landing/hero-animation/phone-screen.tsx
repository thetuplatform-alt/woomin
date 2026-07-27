/* eslint-disable react-hooks/set-state-in-effect */
// components/main/landing/hero-animation/phone-screen.tsx
// 手機螢幕組件 - 包含 3D 旋轉和 App 展示

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { APP_SHOWCASES } from "./app-mockups";
import ShinyText from "./shiny-text";
import { Puzzle, RefreshCcw, Layout, Sparkles } from "lucide-react";

type AnimationPhase = "typing" | "showcase" | "transition";

interface PhoneScreenProps {
  currentAppIndex: number;
  phase: AnimationPhase;
  className?: string;
}

// iPhone 標準渲染尺寸
const RENDER_WIDTH = 360;
const RENDER_HEIGHT = (360) / 0.4960975609;

const PROCESS_ITEMS = [
  { id: 1, text: "AI 正在理解用戶的想法", icon: Puzzle, color: "bg-[#E1E7EF]", textColor: "text-[#4A5568]" },
  { id: 2, text: "AI 正在與用戶進行認知對齊", icon: RefreshCcw, color: "bg-[#EBE8F3]", textColor: "text-[#553C9A]" },
  { id: 3, text: "正在使用課程的方法論", icon: Layout, color: "bg-[#FBF3DB]", textColor: "text-[#975A16]" },
  { id: 4, text: "成果渲染中", icon: Sparkles, color: "bg-[#E6F4EA]", textColor: "text-[#22543D]" },
];

export function PhoneScreen({
  currentAppIndex,
  phase,
  className = "",
}: PhoneScreenProps) {
  const [isAppVisible, setIsAppVisible] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"in" | "out">("in");
  const [scale, setScale] = useState(0.2); // 預設縮放比例
  const screenRef = useRef<HTMLDivElement>(null);

  const CurrentApp = useMemo(() => {
    return APP_SHOWCASES[currentAppIndex]?.component;
  }, [currentAppIndex]);

  // 控制 App 顯示動畫與流程項目
  useEffect(() => {
    if (phase === "transition") {
      setSlideDirection("out");
      setTimeout(() => {
        setIsAppVisible(false);
      }, 500);
    } else if (phase === "typing") {
      setSlideDirection("in");
      setIsAppVisible(true);
    }
  }, [phase]);

  // 計算縮放比例
  useEffect(() => {
    const updateScale = () => {
      if (screenRef.current) {
        const containerWidth = screenRef.current.getBoundingClientRect().width;
        const newScale = containerWidth / RENDER_WIDTH;
        setScale(newScale);
      }
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div
      className={`relative ${className} scale-150`}
      style={{ transformOrigin: "center center" }}
    >
      {/* 背景圖片 - 手機外框 */}
      <Image
        src="/hero-iphone.png"
        alt="iPhone"
        width={1024}
        height={1024}
        className="h-full w-full object-contain"
        priority
      />

      {/* 手機螢幕容器 */}
      <div
        ref={screenRef}
        className="absolute overflow-hidden rounded-md lg:rounded-xl 2xl:rounded-xl"
        style={{
          left: "69.5%",
          top: "8.9%",
          width: "19.5%",
          height: "41.0%",
          transform:
            "perspective(1000px) rotateY(-24deg) rotateX(12deg) rotateZ(10deg)",
          transformOrigin: "center center",
        }}
      >
        {/* 螢幕背景 */}
        <div className="absolute inset-0 bg-white" />

        <AnimatePresence>
          {/* 打字階段 - 顯示微弱脈動的生成中背景 */}
          {phase === "typing" && (
            <motion.div
              key="typing-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center rounded-lg justify-center bg-white p-4"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50"
              >
                <RefreshCcw className="h-6 w-6 text-gray-300 animate-spin-slow" />
              </motion.div>
              <ShinyText className="text-[10px]" text="AI 正在對齊認知..." />
            </motion.div>
          )}
        </AnimatePresence>

        {/* App 內容 - 滑入動畫 */}
        {(
          phase === "showcase" ||
          phase === "transition") &&
          CurrentApp && (
            <div
              className={`absolute inset-0 overflow-hidden rounded-lg transition-all duration-700 ease-out ${isAppVisible && slideDirection === "in"
                ? "translate-x-0"
                : slideDirection === "out"
                  ? "opacity-0"
                  : "opacity-1"
                }`}
            >
              {/* 縮放容器：將 414x896 的內容縮小到螢幕大小 */}
              <div
                className="origin-top-left "
                style={{
                  width: RENDER_WIDTH,
                  height: RENDER_HEIGHT,
                  transform: `scale(${scale * 0.5})`,
                }}
              >
                <CurrentApp />
              </div>
            </div>
          )}
      </div>
    </div >
  );
}

