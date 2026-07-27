import { processPendingAutomationDeliveries } from '@/lib/newsletter/automation/delivery-service'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'

  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processPendingAutomationDeliveries()
  return Response.json(result)
}
