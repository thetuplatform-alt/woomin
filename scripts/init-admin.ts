import 'dotenv/config'
import { prisma } from '../lib/prisma'

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()

  if (!email) {
    console.error('Usage: pnpm admin:init <email>')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  })

  if (!user) {
    console.error(`User not found: ${email}`)
    process.exit(1)
  }

  if (user.role === 'ADMIN') {
    console.log(`User is already ADMIN: ${email}`)
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'ADMIN' },
  })

  console.log(`Promoted to ADMIN: ${email}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
