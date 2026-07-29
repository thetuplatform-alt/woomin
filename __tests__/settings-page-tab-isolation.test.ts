import {
  SETTINGS_SECTION_IDS,
  getSettingsSectionClass,
} from '@/lib/settings-page-tabs'

describe('設定頁分類隔離', () => {
  it('同一時間只有目前分類可見，其餘分類使用 hidden', () => {
    expect(SETTINGS_SECTION_IDS).toHaveLength(7)
    expect(SETTINGS_SECTION_IDS.filter((id) => getSettingsSectionClass('media', id) === '')).toEqual([
      'media',
    ])
    expect(getSettingsSectionClass('media', 'layout')).toBe('hidden')
  })

  it('切換分類只改變顯示 class，不要求卸載分類元件', () => {
    expect(getSettingsSectionClass('basic', 'basic')).toBe('')
    expect(getSettingsSectionClass('email', 'basic')).toBe('hidden')
  })
})
