import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getDefaultPostLoginPath } from '@/lib/entitlements'

export default async function PostLoginPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  redirect(await getDefaultPostLoginPath(session.user.id))
}
