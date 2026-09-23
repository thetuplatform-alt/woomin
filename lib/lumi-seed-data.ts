export const LUMI_SERIES_SEED = {
  code: 'LUMI_SERIES',
  slug: 'lumi-series',
  name: 'Lumi Series',
  description: '陪你工作、創作，也陪你過生活。',
  requiredEntitlementCode: 'LUMI_SERIES',
} as const

type LumiToolSeed = {
  slug: string
  name: string
  category: 'life' | 'kids' | 'creator' | 'business'
  subCategory: string | null
  eyebrow: string | null
  type: 'WEB_APP' | 'SKILL'
  runtimeType: 'EXTERNAL_WEB_APP' | 'SKILL_RUNTIME'
  launchUrl: string | null
  shortDescription: string | null
  longDescription: string | null
  thumbnail: string | null
  status: 'ACTIVE' | 'DRAFT'
  isPublished: boolean
  isFeatured: boolean
  featuredOrder: number | null
  displayOrder: number
  requiresLogin: true
  pricingType: 'FREE' | 'INCLUDED'
  ctaLabel: string
  tags: string[]
  audience: string[]
  benefits: string[]
  features: Array<{ title: string; description: string }>
  usageSteps: string[]
}

const noExtendedCopy = {
  shortDescription: null,
  longDescription: null,
  thumbnail: null,
  tags: [],
  audience: [],
  benefits: [],
  features: [],
  usageSteps: [],
}

export const LUMI_TOOL_SEEDS: readonly LumiToolSeed[] = [
  {
    slug: 'today-where-to-go',
    name: 'Lumi～今天去哪玩？',
    category: 'life',
    subCategory: null,
    eyebrow: '北台灣一日／半日遊行程規劃',
    type: 'WEB_APP',
    runtimeType: 'EXTERNAL_WEB_APP',
    launchUrl: 'https://lumi-north-travel.yangchingyuan.chatgpt.site/',
    shortDescription: '輸入出發地、時間、同行者與偏好，整理 3 組北台灣一日／半日遊行程。',
    longDescription: '不用在十幾個分頁之間來回比較。告訴 Lumi 這次從哪裡出發、和誰一起、想要什麼步調，就能得到三組好安排也好調整的行程方向。',
    thumbnail: 'day-trip',
    status: 'ACTIVE', isPublished: true, isFeatured: false, featuredOrder: null, displayOrder: 10,
    requiresLogin: true, pricingType: 'FREE', ctaLabel: '開始規劃',
    tags: ['Web App', 'Lumi Life', '北台灣', '一日遊'],
    audience: ['想快速安排週末的人', '親子與家庭出遊', '不想花時間交叉比對景點的人'],
    benefits: ['依條件縮小選擇', '一次比較三種行程', '保留可彈性調整的安排'],
    features: [
      { title: '從你的條件開始', description: '以出發地、時間、同行者與偏好作為規劃基礎。' },
      { title: '三組方向好比較', description: '用不同節奏整理行程，選擇不再只剩一個答案。' },
      { title: '資訊清楚可執行', description: '把順序與重點整理好，減少出發前的反覆搜尋。' },
    ],
    usageSteps: ['填入出發地、可用時間與同行者', '選擇今天偏好的活動與步調', '查看並挑選適合的行程方向'],
  },
  {
    slug: 'what-to-cook', name: 'Lumi～今天煮什麼？', category: 'life', subCategory: null, eyebrow: null,
    type: 'WEB_APP', runtimeType: 'EXTERNAL_WEB_APP', launchUrl: 'https://lumi-kitchen.yangchingyuan.chatgpt.site/',
    shortDescription: '從冰箱現有食材、料理時間與人數開始，整理今天真的煮得出來的一餐。',
    longDescription: '不用先想菜名。從手邊有什麼、今天有多少時間開始，Lumi 幫你把材料與做法整理成一頓真正能端上桌的料理。',
    thumbnail: 'home-cooking', status: 'ACTIVE', isPublished: true, isFeatured: false, featuredOrder: null, displayOrder: 20,
    requiresLogin: true, pricingType: 'FREE', ctaLabel: '幫我想菜單', tags: ['Web App', 'Lumi Life', '料理', '家庭'],
    audience: ['每天都在想菜單的人', '想清冰箱食材的家庭', '料理時間有限的上班族'], benefits: ['從現有食材開始', '依時間與人數調整', '減少臨時採買與浪費'],
    features: [
      { title: '看冰箱再決定', description: '先用已有食材規劃，不從複雜食譜清單開始。' },
      { title: '配合今天的時間', description: '依可用時間調整料理複雜度與步驟。' },
      { title: '份量更剛好', description: '把用餐人數納入建議，讓準備更貼近日常。' },
    ], usageSteps: ['輸入現有食材', '補充人數與可用時間', '選一份今天做得到的菜單'],
  },
  {
    slug: 'where-to-eat', name: 'Lumi 今天吃哪間？', category: 'life', subCategory: null, eyebrow: null,
    type: 'WEB_APP', runtimeType: 'EXTERNAL_WEB_APP', launchUrl: 'https://lumi-restaurant.ai.studio/',
    shortDescription: '依地點、預算、同行者與今天想吃的感覺，幫你把餐廳選擇縮小。',
    longDescription: '選餐廳不需要再靠無止盡滑動。Lumi 從今天的地點、預算、同行者與口味出發，幫你留下更適合此刻的選擇。',
    thumbnail: 'restaurant', status: 'ACTIVE', isPublished: true, isFeatured: false, featuredOrder: null, displayOrder: 30,
    requiresLogin: true, pricingType: 'FREE', ctaLabel: '幫我選餐廳', tags: ['Web App', 'Lumi Life', '外食', '餐廳'],
    audience: ['總是選不出餐廳的人', '朋友與家庭聚餐', '想控制預算又不想隨便吃的人'], benefits: ['快速縮小選項', '兼顧同行者需求', '讓選擇符合今天的心情'],
    features: [
      { title: '情境式選擇', description: '地點、預算、對象與口味一起納入考量。' },
      { title: '選項不過量', description: '留下少量較適合的方向，降低選擇疲勞。' },
      { title: '適合一起討論', description: '整理清楚的理由，讓同行者更容易做決定。' },
    ], usageSteps: ['告訴 Lumi 你在哪裡', '設定預算、同行者與想吃的感覺', '從整理後的選擇中決定一間'],
  },
  {
    ...noExtendedCopy, slug: 'rourou-fit-meal', name: '肉肉減脂餐點設計師', category: 'life', subCategory: null, eyebrow: null,
    type: 'WEB_APP', runtimeType: 'EXTERNAL_WEB_APP', launchUrl: 'https://rourou-fit-meal.ai.studio/',
    status: 'ACTIVE', isPublished: true, isFeatured: false, featuredOrder: null, displayOrder: 40,
    requiresLogin: true, pricingType: 'FREE', ctaLabel: '開始使用',
  },
  {
    slug: 'kindergarten-contact-book', name: '幼兒園聯絡本小幫手', category: 'kids', subCategory: '教師工具', eyebrow: null,
    type: 'WEB_APP', runtimeType: 'EXTERNAL_WEB_APP', launchUrl: 'https://preschool-contact-helper.yangchingyuan.chatgpt.site/',
    shortDescription: '把每天的活動、孩子表現與提醒事項，整理成自然、清楚又有溫度的聯絡本內容。',
    longDescription: '保留老師真實的觀察與語氣，再把零散紀錄整理成家長容易理解的聯絡本內容，減少每天重複書寫的負擔。',
    thumbnail: 'contact-book', status: 'ACTIVE', isPublished: true, isFeatured: false, featuredOrder: null, displayOrder: 50,
    requiresLogin: true, pricingType: 'FREE', ctaLabel: '開始使用', tags: ['Web App', 'Lumi Kids', '教師工具', '聯絡本'],
    audience: ['幼兒園教師', '需要撰寫每日紀錄的教保人員', '重視親師溝通品質的園所'], benefits: ['保留每個孩子的差異', '讓文字自然有溫度', '縮短每日整理時間'],
    features: [
      { title: '從觀察紀錄開始', description: '把活動、表現與提醒分開整理，重點不遺漏。' },
      { title: '自然親切的語氣', description: '避免制式套句，保留老師與家長之間的溫度。' },
      { title: '內容清楚好閱讀', description: '讓家長快速理解孩子今天的學習與生活。' },
    ], usageSteps: ['填入今天的活動與孩子表現', '補上個別提醒或想分享的小事', '確認並調整整理後的聯絡本內容'],
  },
  {
    slug: 'kindergarten-term-comments', name: '幼教期末評語工具', category: 'kids', subCategory: '教師工具', eyebrow: null,
    type: 'WEB_APP', runtimeType: 'EXTERNAL_WEB_APP', launchUrl: 'https://preschool-term-comment-helper.yangchingyuan.chatgpt.site/',
    shortDescription: '把一學期的觀察重點整理成自然、不重複、符合孩子個別狀況的期末評語。',
    longDescription: '把一學期累積的重點變成有層次的文字，兼顧孩子的特質、成長與下一步，不再為了每一則評語從空白開始。',
    thumbnail: 'term-comments', status: 'ACTIVE', isPublished: true, isFeatured: false, featuredOrder: null, displayOrder: 60,
    requiresLogin: true, pricingType: 'FREE', ctaLabel: '開始使用', tags: ['Web App', 'Lumi Kids', '教師工具', '期末評語'],
    audience: ['幼兒園教師', '需要大量撰寫評語的教保人員', '希望評語更貼近孩子的園所'], benefits: ['整理整學期觀察', '降低重複句型', '保留個別成長脈絡'],
    features: [
      { title: '重點有脈絡', description: '將不同時期的觀察整理成完整而連續的敘述。' },
      { title: '每位孩子不同', description: '依個別特質調整內容，不用同一套模板反覆套用。' },
      { title: '語氣自然正向', description: '具體描述成長，也溫和帶出未來可以練習的方向。' },
    ], usageSteps: ['整理孩子本學期的觀察重點', '選擇希望呈現的成長面向', '檢視並微調完成的期末評語'],
  },
  {
    ...noExtendedCopy, slug: 'qmeng-avatar', name: 'Q 萌大頭貼製作助手', category: 'creator', subCategory: null, eyebrow: null,
    type: 'WEB_APP', runtimeType: 'EXTERNAL_WEB_APP', launchUrl: 'https://qmeng-avatar.yangchingyuan.chatgpt.site/',
    status: 'DRAFT', isPublished: false, isFeatured: false, featuredOrder: null, displayOrder: 70,
    requiresLogin: true, pricingType: 'INCLUDED', ctaLabel: '狀態確認中',
  },
  {
    slug: 'line-sticker-planner', name: 'LINE 貼圖企劃製作助手', category: 'creator', subCategory: null, eyebrow: null,
    type: 'SKILL', runtimeType: 'SKILL_RUNTIME', launchUrl: null,
    shortDescription: '從角色設定、40 張內容規劃，到名稱、介紹與生成 Prompt，一步步完成整套 LINE 貼圖企劃。',
    longDescription: '把角色想法整理成可持續製作的貼圖企劃，從角色個性、常用情境到完整張數規劃，讓創作不再卡在第一張。',
    thumbnail: 'line-sticker', status: 'ACTIVE', isPublished: true, isFeatured: true, featuredOrder: 10, displayOrder: 80,
    requiresLogin: true, pricingType: 'INCLUDED', ctaLabel: '開始使用', tags: ['AI Skill', 'Lumi Creator', 'LINE 貼圖', 'IP 創作'],
    audience: ['第一次製作 LINE 貼圖的人', '插畫與角色創作者', '想發展個人 IP 的品牌'], benefits: ['建立角色設定', '一次規劃 40 張內容', '整理生成與上架文案'],
    features: [
      { title: '角色先站穩', description: '先整理外型、個性與說話方式，維持整套貼圖一致。' },
      { title: '內容不再重複', description: '從日常使用情境規劃 40 張有差異也實用的內容。' },
      { title: '企劃一路到生成', description: '名稱、介紹與 Prompt 一起整理，減少工具之間的斷點。' },
    ], usageSteps: ['描述你的角色或初步想法', '選擇語氣、情境與使用對象', '取得整套貼圖企劃與製作 Prompt'],
  },
  {
    ...noExtendedCopy, slug: 'ai-product-social-sales-studio', name: 'AI 商品社群銷售工作室', category: 'business', subCategory: null, eyebrow: null,
    type: 'SKILL', runtimeType: 'SKILL_RUNTIME', launchUrl: null,
    status: 'ACTIVE', isPublished: true, isFeatured: false, featuredOrder: null, displayOrder: 90,
    requiresLogin: true, pricingType: 'INCLUDED', ctaLabel: '開始使用',
  },
  {
    ...noExtendedCopy, slug: 'ai-business-message-assistant', name: 'AI 商務訊息小助理', category: 'business', subCategory: null, eyebrow: null,
    type: 'SKILL', runtimeType: 'SKILL_RUNTIME', launchUrl: null,
    status: 'ACTIVE', isPublished: true, isFeatured: false, featuredOrder: null, displayOrder: 100,
    requiresLogin: true, pricingType: 'INCLUDED', ctaLabel: '開始使用',
  },
]
