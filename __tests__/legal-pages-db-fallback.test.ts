import { Prisma } from '@prisma/client'
import TermsPage from '@/app/(main)/terms/page'
import PrivacyPage from '@/app/(main)/privacy/page'
import { findOptionalLegalSiteSetting } from '@/lib/legal-site-setting'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/components/main/legal', () => ({
  LegalPageLayout: jest.fn(),
  LegalMarkdownContent: jest.fn(),
}))

const mockedFindUnique = prisma.siteSetting.findUnique as jest.Mock

describe('public legal page database fallback', () => {
  it.each([
    ['terms', TermsPage],
    ['privacy', PrivacyPage],
  ])('renders custom content for %s when the database returns it', async (_name, renderPage) => {
    mockedFindUnique.mockResolvedValue({
      key: 'legal-content',
      value: '# WooMin Learning System\n\nWooMin · support@example.com',
      updatedAt: new Date('2026-09-10T00:00:00Z'),
    })

    const page = await renderPage()
    const content = page.props.children

    expect(content.props.content).toBe(
      '# BestAppStore\n\nBestAppStore · service@bestappstore.co.uk'
    )
  })

  it.each([
    ['terms', TermsPage, 'p'],
    ['privacy', PrivacyPage, 'h3'],
  ])('renders the existing static fallback for %s when no custom content exists', async (
    _name,
    renderPage,
    firstFallbackElement
  ) => {
    mockedFindUnique.mockResolvedValue(null)

    const page = await renderPage()
    const content = page.props.children

    expect(Array.isArray(content)).toBe(true)
    expect(content[0].type).toBe(firstFallbackElement)
  })

  it.each([
    ['terms', TermsPage, 'p', 'P1001'],
    ['privacy', PrivacyPage, 'h3', 'ECONNREFUSED'],
  ])('renders the existing static fallback for %s when the database is unavailable', async (
    _name,
    renderPage,
    firstFallbackElement,
    connectivityCode
  ) => {
    mockedFindUnique.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Database server is unreachable', {
        code: connectivityCode,
        clientVersion: '7.2.0',
      })
    )
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const page = await renderPage()
    const content = page.props.children

    expect(Array.isArray(content)).toBe(true)
    expect(content[0].type).toBe(firstFallbackElement)
    expect(errorSpy).toHaveBeenCalledWith(
      '[Legal pages] Database unavailable; using static legal content fallback.',
      expect.objectContaining({ code: connectivityCode })
    )
    expect(errorSpy.mock.calls[0]).not.toEqual(expect.arrayContaining([expect.stringContaining('DATABASE_URL')]))

    errorSpy.mockRestore()
  })

  it('rethrows non-connectivity Prisma errors', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Invalid query', {
      code: 'P2002',
      clientVersion: '7.2.0',
    })
    mockedFindUnique.mockRejectedValue(error)

    await expect(findOptionalLegalSiteSetting('legal-content')).rejects.toBe(error)
  })
})
