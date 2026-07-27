import { prisma } from '@/lib/prisma'
import { readLocalStorageObject } from '@/lib/storage'
import { createPublicUploadImageHandler } from '@/lib/public-upload-image-route'

export const runtime = 'nodejs'

export const GET = createPublicUploadImageHandler({
  readLocalStorageObject,
  findMediaByFilename: async (key: string) => {
    const media = await prisma.media.findFirst({
      where: { filename: key },
      orderBy: { createdAt: 'desc' },
      select: { mimeType: true, type: true, originalName: true },
    })
    if (media) return media

    const attachment = await prisma.assignmentAttachment.findFirst({
      where: { storageKey: key },
      orderBy: { createdAt: 'desc' },
      select: { mimeType: true, type: true, filename: true },
    })
    if (!attachment) return null

    return {
      mimeType: attachment.mimeType,
      type: 'ATTACHMENT',
      originalName: attachment.filename,
    }
  },
})
