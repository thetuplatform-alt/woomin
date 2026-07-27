// components/main/landing/faq-section.tsx
// 常見問題區塊 — 精簡為 4 題（最影響購買決策的問題）

'use client'

import { motion } from 'framer-motion'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { courseFAQs } from '@/lib/constants/faq'

export function FAQSection() {
  return (
    <section className="bg-surface py-10 sm:py-14 lg:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* 標題 */}
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-sm font-bold tracking-widest text-cta uppercase"
          >
            F.A.Q
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-2xl font-bold text-heading sm:text-3xl lg:text-4xl"
          >
            你可能想問的問題
          </motion.h2>
        </div>

        {/* FAQ 手風琴 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-8 sm:mt-10"
        >
          <Accordion type="single" collapsible className="space-y-3">
            {courseFAQs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="overflow-hidden rounded-2xl border border-divider bg-white px-0"
              >
                <AccordionTrigger className="px-5 py-4 text-left hover:no-underline hover:text-cta data-[state=open]:text-cta transition-colors">
                  <span className="text-sm font-bold text-heading sm:text-base">
                    {faq.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 text-sm leading-relaxed text-body sm:text-base">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* 底部聯繫 */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center"
        >
          <p className="text-sm text-caption">
            還有其他問題？
            <a
              href="mailto:fish@fishot.com"
              className="ml-1.5 font-bold text-heading underline decoration-cta decoration-2 underline-offset-4 hover:text-cta transition-colors"
            >
              聯繫我們
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
