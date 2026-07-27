// components/main/landing/toolkit-section.tsx
// 工具鏈介紹區塊
// Design System - The Toolkit

'use client'

import { motion } from 'framer-motion'
import { Sparkles, Palette, Code } from 'lucide-react'

const tools = [
  {
    icon: Sparkles,
    name: 'Google AI Studio (Gemini API)',
    description: '讓你的 App 擁有大腦，免費額度超大方，是目前最頂尖的 AI 模型之一。',
  },
  {
    icon: Palette,
    name: 'Google Stitch',
    description: '截圖轉 Code 的神器。把手繪草稿直接轉成程式碼，再也不怕設計難關。',
  },
  {
    icon: Code,
    name: 'Antigravity (AI Editor)',
    description: '專為 Vibe Coding 設計的編輯器，讓 AI 幫你寫程式，你只需要負責審核。',
  },
]

export function ToolkitSection() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 標題系統 */}
        <div className="text-center">
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-sm font-bold tracking-widest text-cta uppercase"
          >
            開發工具
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold text-heading sm:text-4xl"
          >
            強大的武器，不需要昂貴的代價
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-body"
          >
            課程中，我們精選了目前最強大的 AI 開發工具鏈，而且它們大多都有
            <span className="mx-1 font-bold text-cta">免費方案</span>
            ，讓你能無負擔開始。
          </motion.p>
        </div>

        {/* 工具卡片 */}
        <div className="mt-20 grid gap-8 md:grid-cols-3">
          {tools.map((tool, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 + 0.3 }}
              className="group rounded-2xl border border-divider bg-white p-10 transition-all hover:bg-surface"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-heading group-hover:bg-cta transition-colors">
                <tool.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mt-8 text-xl font-bold text-heading">
                {tool.name}
              </h3>
              <p className="mt-4 text-base leading-relaxed text-body">
                {tool.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* 底部提示 */}
        <motion.p 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-16 text-center text-sm font-medium text-caption"
        >
          你不需要先買昂貴的軟體，只需要準備好你的 Mac 和一顆想創造的心。
        </motion.p>
      </div>
    </section>
  )
}
