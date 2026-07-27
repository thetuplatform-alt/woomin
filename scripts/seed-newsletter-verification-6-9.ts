import { prisma } from '../lib/prisma'

async function main() {
  const c = await prisma.newsletterCampaign.upsert({
    where: { id: 'cmrw000000000000000006-9' },
    update: {},
    create: {
      id: 'cmrw000000000000000006-9',
      type: 'GENERAL',
      name: '6.9 驗收測試電子報',
      subject: '測試主旨',
      contentJson: { blocks: [] },
      status: 'DRAFT',
      createdBy: { connect: { email: 'v180-admin@example.test' } },
    },
  })
  console.log(c.id)
}

main().finally(() => prisma.$disconnect())
