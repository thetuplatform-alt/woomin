import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { issuePasswordResetToken, buildPasswordResetUrl } from '../lib/password-reset'

async function main() {
  const emails = ['v180-student@example.test', 'v180-guest@example.test', 'v180-google@example.test']
  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      console.log(email, '-> NOT FOUND')
      continue
    }
    const { token, expiresAt } = await issuePasswordResetToken(user.id)
    const url = await buildPasswordResetUrl(token)
    console.log(JSON.stringify({ email, url, expiresAt }))
  }
}

main().finally(() => prisma.$disconnect())
