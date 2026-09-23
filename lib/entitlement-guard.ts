import 'server-only'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveSafeReturnTo } from '@/lib/auth-return-to'
import { hasActiveEntitlement } from '@/lib/entitlements'

export async function requireSeriesEntitlement(code: string, requestedReturnTo: string) {
  const returnTo = resolveSafeReturnTo(requestedReturnTo) ?? '/my-services'
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`)
  }

  if (!(await hasActiveEntitlement(session.user.id, code))) {
    redirect('/my-services?access=denied&service=lumi-series')
  }

  return session.user
}
