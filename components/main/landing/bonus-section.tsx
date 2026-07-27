// components/main/landing/bonus-section.tsx
// 贈品區塊
// Design System - 獨家贈品

'use client'

import { motion } from 'framer-motion'
import { Shield, Lightbulb, Apple, BookOpen } from 'lucide-react'

const bonuses = [
  {
    icon: Shield,
    title: 'iOS 資安架構師 Prompt',
    description: '一鍵檢查你的程式碼有沒有安全漏洞，讓 AI 幫你守護 App 安全。',
  },
  {
    icon: Lightbulb,
    title: '產品靈感建築師 Prompt',
    description: '沒靈感？跟它聊聊，幫你把模糊的想法變成具體可執行的產品規格。',
  },
  {
    icon: Apple,
    title: 'App Store 審核委員 Prompt',
    description: '模擬蘋果官方審查，幫你揪出可能會被退件的隱藏地雷。',
  },
  {
    icon: BookOpen,
    title: '超詳細課程講義',
    description: '圖文並茂的操作手冊，是你開發路上的最強字典與最強助手。',
  },
]

export function BonusSection() {
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
            Exclusive Bonuses
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold text-heading sm:text-4xl"
          >
            不只教你做，還教你「安全做」
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-body"
          >
            AI 能寫程式，但也能寫出漏洞。我們將講師多年經驗濃縮成這些
            <span className="mx-1 font-bold text-heading">
              Prompt 提示詞包
            </span>
            ，這是專屬於學員的生存武器。
          </motion.p>
        </div>

        {/* 贈品卡片 */}
        <div className="mt-20 grid gap-6 sm:grid-cols-2">
          {bonuses.map((bonus, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 + 0.3 }}
              className="group flex gap-6 rounded-2xl border border-heading/5 bg-heading p-8 text-white transition-all hover:bg-[#1a1a1a]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cta transition-transform group-hover:scale-110">
                <bonus.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {bonus.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  {bonus.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
