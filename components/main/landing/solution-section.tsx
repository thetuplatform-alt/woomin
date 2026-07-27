// components/main/landing/solution-section.tsx
// 解決方案區塊
// Design System - Vibe Coding 開發法

'use client'

import { motion } from 'framer-motion'
import { Gamepad2, Ship, Palette } from 'lucide-react'

const solutions = [
  {
    icon: Gamepad2,
    title: 'Git 版本控制？',
    subtitle: '那就像是「馬力歐的存檔點」',
    description:
      '寫壞了？沒關係，讀檔重來就好。在 Vibe Coding 的世界裡，沒有失敗，只有不斷的存檔與重讀。',
  },
  {
    icon: Ship,
    title: '什麼是 API？',
    subtitle: '那是島嶼之間的「貿易協定」',
    description:
      '我們教你怎麼讓你的 App 島嶼，去跟 Google 或 OpenAI 島嶼交換數據貿易，讓功能無限延伸。',
  },
  {
    icon: Palette,
    title: '沒有設計美感？',
    subtitle: '醜醜的草圖也能變精美 UI',
    description:
      '丟進 AI 視覺模型，草碼瞬間變成符合 iOS 規範的精美介面。你的審美，由 AI 來補全。',
  },
]

export function SolutionSection() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 標題 */}
        <div className="text-center">
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-sm font-bold tracking-widest text-cta uppercase"
          >
            Vibe Coding 開發法
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold text-heading sm:text-4xl"
          >
            聽不懂程式術語？沒關係，我們說人話。
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-body"
          >
            講師將用最生活化的比喻，帶你跨越技術的高牆，讓你在不知不覺中掌握核心邏輯。
          </motion.p>
        </div>

        {/* 解決方案卡片 */}
        <div className="mt-20 grid gap-8 lg:grid-cols-3">
          {solutions.map((solution, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 + 0.3 }}
              className="group rounded-2xl border border-divider bg-white p-10 transition-all hover:border-cta/40 hover:bg-surface"
            >
              {/* 圖標 */}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-heading transition-colors group-hover:bg-cta">
                <solution.icon className="h-6 w-6 text-white" />
              </div>

              {/* 標題和描述 */}
              <h3 className="mt-8 text-xl font-bold text-heading">
                {solution.title}
              </h3>
              <p className="mt-2 text-sm font-semibold text-cta">
                {solution.subtitle}
              </p>
              <p className="mt-4 text-base leading-relaxed text-body">
                {solution.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
