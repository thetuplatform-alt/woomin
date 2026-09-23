import { LUMI_SERIES_SEED, LUMI_TOOL_SEEDS } from '@/lib/lumi-seed-data'

describe('approved Lumi Series base data', () => {
  it('contains the approved series entitlement', () => {
    expect(LUMI_SERIES_SEED).toMatchObject({
      code: 'LUMI_SERIES',
      slug: 'lumi-series',
      requiredEntitlementCode: 'LUMI_SERIES',
    })
  })

  it('contains exactly seven Web Apps and three Skills', () => {
    expect(LUMI_TOOL_SEEDS).toHaveLength(10)
    expect(LUMI_TOOL_SEEDS.filter((tool) => tool.type === 'WEB_APP')).toHaveLength(7)
    expect(LUMI_TOOL_SEEDS.filter((tool) => tool.type === 'SKILL')).toHaveLength(3)
  })

  it('contains only the ten approved tools', () => {
    expect(LUMI_TOOL_SEEDS.map((tool) => tool.name)).toEqual([
      'Lumi～今天去哪玩？',
      'Lumi～今天煮什麼？',
      'Lumi 今天吃哪間？',
      '肉肉減脂餐點設計師',
      '幼兒園聯絡本小幫手',
      '幼教期末評語工具',
      'Q 萌大頭貼製作助手',
      'LINE 貼圖企劃製作助手',
      'AI 商品社群銷售工作室',
      'AI 商務訊息小助理',
    ])
  })

  it('does not invent a Skill runtime URL', () => {
    for (const tool of LUMI_TOOL_SEEDS.filter((item) => item.type === 'SKILL')) {
      expect(tool.runtimeType).toBe('SKILL_RUNTIME')
      expect(tool.launchUrl).toBeNull()
    }
  })
})
