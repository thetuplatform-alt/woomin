// components/main/landing/instructor-section.tsx
// 講師介紹 + 信任元素合併區塊
// 合併原 Service / Toolkit / Bonus 的核心信任元素

"use client";

import { motion } from "framer-motion";
import { Code, BookOpen, Rocket, Users, HeartHandshake, Sparkles, Shield, BookMarked, BadgeDollarSign } from "lucide-react";
import Image from "next/image";
import { CoursePreviewVideo } from "./course-preview-video";

const credentials = [
  {
    icon: Code,
    title: "8 年深度開發經驗",
    description: "休學創業至今，擁有從底層架構到全端實作的完整歷練。",
  },
  {
    icon: BookOpen,
    title: "AI 技術暢銷書作者",
    description: "著有《從零開始，打造一個生成式AI平台》，曾榮登博客來與天龍書局當日暢銷榜。",
  },
  {
    icon: Rocket,
    title: "SaaS 產品創辦人",
    description: "Redia LLC 創辦人，有著上千用戶的 SaaS 產品，將 AI Coding 融入商業核心。",
  },
];

const trustItems = [
  {
    icon: Users,
    title: "專屬校友開發社群",
    description: "與各行各業的創業家、創作者交流點子，在開發路上互相激盪不孤單",
  },
  {
    icon: HeartHandshake,
    title: "15 分鐘技術急診室",
    description: "購課 30 日內實作若遇卡關，提供截圖即可預約講師親自線上除錯健檢。",
  },
  {
    icon: Shield,
    title: "完整核心 Prompt 提示詞包",
    description: "涵蓋企劃、開發、除錯與金流。直接複製貼上，讓 AI 瞬間變成資深工程師。",
  },
  {
    icon: BookMarked,
    title: "超詳細圖文講義",
    description: "將複雜步驟拆解成白話文與實機截圖，照著點擊絕對不迷路，可隨時翻閱。",
  },
  {
    icon: BadgeDollarSign,
    title: "蘋果審核與變現避雷",
    description: "獨家整理 App Store 上架規範與 IAP 內購教學，確保你的心血能成功獲利。",
  },
];

export function InstructorSection() {
  return (
    <section className="bg-white py-10 sm:py-14 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 標題 */}
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-sm font-bold tracking-widest text-cta uppercase"
          >
            Your Instructor
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-2xl font-bold text-heading sm:text-3xl lg:text-4xl"
          >
            嗨！我是老魚 Fish
          </motion.h2>
        </div>

        {/* 講師主卡片 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-8 sm:mt-10 overflow-hidden rounded-2xl sm:rounded-[2rem] border border-divider bg-surface"
        >
          <div className="flex flex-col lg:flex-row">
            {/* 左側：人物 */}
            <div className="flex flex-col items-center justify-center border-b border-divider bg-white p-8 sm:p-10 lg:w-1/3 lg:border-b-0 lg:border-r">
              <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-full border-4 border-surface bg-heading flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/fish.png"
                  alt="Fish（余啟彰）- iOS Vibe Coding 課程講師，《第一次當網紅就上手》作者"
                  width={160}
                  height={160}
                  className="h-full w-full object-cover object-[0_-12px]"
                />
              </div>
              <h3 className="mt-5 text-xl font-bold text-heading sm:text-2xl">
                Fish（余啟彰）
              </h3>
              <p className="mt-2 text-center text-sm font-medium text-body">
                核流有限公司負責人 / 《第一次當網紅就上手》作者 / AI・網路系統・銷售自動化教學
              </p>
            </div>

            {/* 右側：語錄與經歷 */}
            <div className="flex-1 p-6 sm:p-8 lg:p-10">
              <div className="relative">
                <span className="absolute -left-3 -top-4 text-6xl font-serif text-divider/50">
                  &ldquo;
                </span>
                <blockquote className="relative z-10 text-lg font-medium leading-relaxed text-heading italic sm:text-xl">
                  我不只教程式，我更用 AI 打造具備商業價值產品。
                  <br />
                  在這個 Vibe Coding
                  的時代，我要帶你從「使用者」徹底進化為「創造者」。
                </blockquote>
              </div>

              {/* 精選 3 個經歷 */}
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {credentials.map((item, index) => (
                  <div key={index} className="group">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-heading border border-divider group-hover:bg-cta group-hover:text-white transition-colors">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <h4 className="mt-3 font-bold text-heading text-sm">
                      {item.title}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-body">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* 講師承諾影片 — 雙欄佈局 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="mt-10 sm:mt-14"
        >
          <CoursePreviewVideo />
        </motion.div>

        {/* 信任元素 — 水平滑動卡片 */}
        <div className="mt-10 sm:mt-14">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide sm:grid sm:grid-cols-5 sm:overflow-visible">
            {trustItems.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="flex shrink-0 w-[200px] sm:w-auto flex-col items-center rounded-xl border border-divider bg-surface p-4 text-center transition-all hover:border-cta/40"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-heading text-white">
                  <item.icon className="h-4 w-4" />
                </div>
                <h4 className="mt-3 text-sm font-bold text-heading">
                  {item.title}
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-body">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
