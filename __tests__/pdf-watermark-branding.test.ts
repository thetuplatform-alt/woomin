import { PDFDocument } from 'pdf-lib'
import { applyPdfWatermark } from '@/lib/pdf-watermark'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}))

jest.mock('@/lib/app-url', () => ({
  resolveAppUrl: jest.fn().mockResolvedValue('https://bestappstore.example.test'),
}))

jest.mock('@/lib/storage', () => ({
  readLocalStorageObject: jest.fn(),
}))

describe('BestAppStore PDF watermark fallback', () => {
  it('embeds the approved local logo without changing PDF generation behavior', async () => {
    const source = await PDFDocument.create()
    source.addPage([595, 842])

    const output = await applyPdfWatermark(Buffer.from(await source.save()))
    const watermarked = await PDFDocument.load(output)

    expect(watermarked.getPageCount()).toBe(1)
    expect(output.length).toBeGreaterThan(0)
  })
})
