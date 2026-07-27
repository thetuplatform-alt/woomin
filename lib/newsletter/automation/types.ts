import type { Prisma } from '@prisma/client'

export type CoursePurchasedForAutomationInput = {
  userId: string
  courseId: string
  orderId: string
  paidAt: Date
}

export type NewsletterAutomationDeliveryForSending =
  Prisma.NewsletterAutomationDeliveryGetPayload<{
    include: {
      enrollment: {
        include: {
          user: {
            select: {
              email: true
              name: true
            }
          }
          automation: {
            include: {
              course: {
                select: {
                  id: true
                  title: true
                  slug: true
                }
              }
            }
          }
        }
      }
      step: true
    }
  }>

export type AutomationDeliveryProcessOutcome =
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'unclaimed'
  | 'not_found'

export interface AutomationDeliveryProcessCounts {
  selected: number
  claimed: number
  sent: number
  failed: number
  skipped: number
  unclaimed: number
}
