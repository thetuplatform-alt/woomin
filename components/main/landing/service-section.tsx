// components/main/landing/service-section.tsx
// 社群支援區塊
// Design System - 終身校友社群 + 技術支援

'use client'

import { motion } from 'framer-motion'
import { Users, HeartHandshake } from 'lucide-react'

export function ServiceSection() {
  return (
    <section className="bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 標題系統 */}
        <div className="text-center">
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-sm font-bold tracking-widest text-cta uppercase"
          >
            Learning Community
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold text-heading sm:text-4xl"
          >
            你不只買了一堂課，還加入了一個圈子
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-body"
          >
            學習不只是觀看影片，更是持續的交流與成長。
          </motion.p>
        </div>

        {/* 兩張卡片 */}
        <div className="mt-20 grid gap-8 md:grid-cols-2">
          {/* 終身校友社群 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="group rounded-2xl border border-divider bg-white p-10 transition-all hover:border-cta/40"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-heading text-white transition-colors group-hover:bg-cta">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-8 text-xl font-bold text-heading">
              終身校友社群
            </h3>
            <p className="mt-4 text-base leading-relaxed text-body">
              不用擔心上完課就變孤兒。加入學員專屬社群，與各行各業的人才交流心得、分享作品。
            </p>
            <p className="mt-4 text-base leading-relaxed text-body">
              這裡有創意人、創業者、設計師，你的下一個合作夥伴可能就在這裡。
            </p>
          </motion.div>

          {/* 講師親自支援 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="group rounded-2xl border border-divider bg-white p-10 transition-all hover:border-cta/40"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-heading text-white transition-colors group-hover:bg-cta">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <h3 className="mt-8 text-xl font-bold text-heading">
              講師親自支援
            </h3>
            <p className="mt-2 text-sm font-semibold text-cta">
              7 日技術急診室
            </p>
            <p className="mt-4 text-base leading-relaxed text-body">
              課後 7 天內，遇到任何安裝失敗、紅字報錯的問題，都可以在社群直接提問。
            </p>
            <p className="mt-4 text-base leading-relaxed text-body">
              講師將親自為你解答，確保你不會卡在開發的起跑點上。
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
