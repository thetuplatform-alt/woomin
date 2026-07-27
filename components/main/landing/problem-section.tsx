// components/main/landing/problem-section.tsx
// 痛點 → 解決方案一體化區塊
// 每個痛點直接帶出解方，一個連續敘事

'use client'

import { motion } from 'framer-motion'
import { AlertCircle, Lightbulb, XCircle, CheckCircle2 } from 'lucide-react'

const problemSolutions = [
  {
    problem: {
      title: '不知道怎麼做出能裝進手機的 App？',
      description: '網路上滿滿的 AI 教學，照著貼卻只能做出零星的網頁小工具。不知道怎麼跨越「網頁」到「真實 iOS App」的那道牆。',
      image: '/images/landing/problem-overload-v2.png',
    },
    solution: {
      title: '專為 iOS 打造的 6 階段實戰地圖',
      description: '從觀念重塑到 App Store 上架，我們把流程拆解好。不再只是紙上談兵，而是真的帶你把 App 裝進你的 iPhone 裡。',
    },
  },
  {
    problem: {
      title: 'AI 突然吐出一堆紅字報錯，完全不知道怎麼救',
      description: '遇到錯誤丟給 AI，它卻回覆一堆看不懂的英文。只能盲目地複製貼上，結果 A 修好了 B 又壞了，最後卡在一個完全跑不動的畫面。',
      image: '/images/landing/problem-loop-v2.png',
    },
    solution: {
      title: '把 AI 當員工！學會 Vibe Coding 的專屬溝通訣竅',
      description: '你不需要理解程式碼的運作。教你透過 Vibe Coding 的專屬溝通訣竅，讓 AI 直接理解問題，乖乖幫你把 App 修到好。',
    },
  },
  {
    problem: {
      title: '好不容易做出版型，想加個按鈕卻全毀了',
      description: '勉強拼湊出會動的半成品，但只要想加一點新功能，整個畫面就崩潰，根本不敢再動它，更別提達到蘋果審核的標準。',
      image: '/images/landing/problem-quality-v2.png',
    },
    solution: {
      title: 'Vibe Coding 必須知道，掌握無痛的「存檔與避雷」指南',
      description: '教你非工程師也能秒懂的進度備份邏輯。就像玩遊戲一樣，寫壞了一鍵讀檔，讓你毫無壓力地擴充功能，順利上架開啟獲利。',
    },
  },
  {
    problem: {
      title: '想讓自己的 App 有 AI 賦能，卻不知道怎麼做？',
      description: '想做出能夠幫我工作、生活的 AI 助理，或者是讓 AI 功能加入進自己的 App 卻不知怎麼下手？',
      image: '/images/landing/problem-gap-v3.png',
    },
    solution: {
      title: '教你實際打造 AI 賦能的 App',
      description: '這堂課會教你打造出具備 AI 賦能的 App，讓你的 App 變成 AI 助理，做出過往一般 App 無法做到的事情。',
    },
  },
]

export function ProblemSection() {
  return (
    <section className="bg-white py-10 sm:py-14 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 標題 */}
        <div className="mx-auto max-w-3xl text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl font-bold tracking-tight text-heading sm:text-3xl lg:text-4xl"
          >
            用 AI 寫點小工具不難，
            <br className="hidden sm:block" />
            <span className="text-body">但想變成「裝進手機的 iOS App」卻毫無頭緒？</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-base leading-relaxed text-body"
          >
            網路上的教學大多都在 Vibe Coding 網頁<br />但卻沒有教如何搞定 iOS 開發的真實流程。
          </motion.p>
        </div>

        {/* 痛點 → 解方配對 */}
        <div className="mt-8 sm:mt-12 space-y-4 sm:space-y-6">
          {problemSolutions.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="rounded-2xl border border-divider bg-surface overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row">
                {/* 圖片 — 手機版隱藏 */}
                <div className="hidden sm:block sm:w-40 lg:w-48 shrink-0 bg-white">
                  <div className="relative h-full w-full min-h-[160px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.problem.image}
                      alt={item.problem.title}
                      className="object-contain p-4"
                    />
                  </div>
                </div>

                {/* 內容 */}
                <div className="flex-1 p-5 sm:p-6">
                  {/* 痛點 */}
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                    <div>
                      <h3 className="text-base font-bold text-heading">
                        {item.problem.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-body">
                        {item.problem.description}
                      </p>
                    </div>
                  </div>

                  {/* 分隔 → 解方 */}
                  <div className="my-4 h-px bg-divider" />

                  <div className="flex items-start gap-3">
                    <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-cta" />
                    <div>
                      <h4 className="text-base font-bold text-cta">
                        {item.solution.title}
                      </h4>
                      <p className="mt-1 text-sm leading-relaxed text-body">
                        {item.solution.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 轉折 Bridge Banner + CTA (升級外包對比版) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-12 sm:mt-16 rounded-2xl sm:rounded-[2rem] bg-heading p-6 sm:p-10 text-center text-white"
        >
          <div className="mx-auto max-w-4xl">
            <h3 className="text-xl font-bold sm:text-2xl text-white">
              「我也想做 App，但我不想花半年學 Swift...」
            </h3>
            <p className="mt-4 text-base text-neutral-400 max-w-2xl mx-auto leading-relaxed">
              在 AI 時代，任何人都可以做出自己的 App
              <br className="hidden sm:block" />
              我將教授一整套完整的 AI Coding；讓你成為<span className="mx-1 font-bold text-cta">老闆</span>，做出自己的 App。
              <br className="hidden sm:block" />
              不只如此，你還能學會如何上架 App Store，並開啟你的獲利之路。
            </p>

            {/* 視覺化對比卡片區塊 */}
            <div className="mt-8 mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 text-left">
              {/* 自學摸索 */}
              <div className="rounded-xl bg-white/5 p-5 border border-white/10 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-neutral-500" />
                  <span className="text-sm text-neutral-400 font-medium">傳統自學摸索</span>
                </div>
                <div className="text-xl font-bold text-white mb-1">6 個月以上</div>
                <div className="text-sm text-neutral-500">容易卡關中途放棄</div>
              </div>

              {/* 外包團隊 */}
              <div className="rounded-xl bg-white/5 p-5 border border-white/10 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-neutral-500" />
                  <span className="text-sm text-neutral-400 font-medium">尋找外包團隊</span>
                </div>
                <div className="text-xl font-bold text-white mb-1">NT$ 200,000+</div>
                <div className="text-sm text-neutral-500">溝通成本極高且週期極長</div>
              </div>

              {/* Vibe Coding (Highlight) */}
              <div className="rounded-xl bg-cta/10 p-5 border border-cta/50 relative overflow-hidden flex flex-col justify-center">
                <div className="absolute top-0 right-0 bg-cta text-heading text-xs font-bold px-3 py-1 rounded-bl-lg">
                  AI 時代最佳解
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-cta" />
                  <span className="text-sm text-cta font-medium">Vibe Coding 實戰課</span>
                </div>
                <div className="text-xl font-bold text-white mb-1">2.5 小時</div>
                <div className="text-sm text-cta/80">永久掌握 AI 協作力與上架能力</div>
              </div>
            </div>

          </div>
        </motion.div>
      </div>
    </section>
  )
}