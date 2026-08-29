export const lumiCategoryIds = [
  'all',
  'life',
  'kids',
  'creator',
  'business',
  'skills',
] as const

export type LumiCategoryId = (typeof lumiCategoryIds)[number]
export type LumiProductCategory = Exclude<LumiCategoryId, 'all' | 'skills'>
export type LumiPricingType = 'free' | 'free_trial' | 'paid' | 'coming_soon'
export type LumiProductStatus = 'available' | 'coming_soon'

export type LumiProduct = {
  id: string
  slug: string
  name: string
  eyebrow?: string
  type: 'Web App' | 'AI Skill'
  category: LumiProductCategory
  subCategory?: string
  shortDescription: string
  longDescription: string
  tags: string[]
  thumbnail: string
  pricingType: LumiPricingType
  price: number | null
  currency: 'USD' | 'TWD' | null
  trialDays: number | null
  status: LumiProductStatus
  ctaLabel: string
  ctaUrl: string
  featured: boolean
  sortOrder: number
  audience: string[]
  benefits: string[]
  features: { title: string; description: string }[]
  usageSteps: string[]
}

export const lumiCategories: Record<
  Exclude<LumiCategoryId, 'all'>,
  { name: string; label: string; description: string }
> = {
  life: {
    name: 'Lumi Life',
    label: '生活應用',
    description: '把每天反覆出現的小選擇，整理成更輕鬆的下一步。',
  },
  kids: {
    name: 'Lumi Kids',
    label: '兒童／幼教',
    description: '讓幼教現場的觀察與溝通，多一點從容，也保留每個孩子的不同。',
  },
  creator: {
    name: 'Lumi Creator',
    label: '創作工具',
    description: '從靈感到可使用的內容，把創作流程拆成清楚好走的步驟。',
  },
  business: {
    name: 'Lumi Business',
    label: '商業應用',
    description: '把零散營運工作整理好，留更多時間給真正重要的顧客與商品。',
  },
  skills: {
    name: 'Lumi Skills',
    label: 'AI 技能',
    description: '不用先學 Prompt，跟著整理好的工作流程完成眼前任務。',
  },
}

const sharedTrial = {
  pricingType: 'free_trial' as const,
  price: 9.99,
  currency: 'USD' as const,
  trialDays: 7,
  status: 'available' as const,
}

const sharedFree = {
  pricingType: 'free' as const,
  price: null,
  currency: null,
  trialDays: null,
  status: 'available' as const,
}

export const lumiProducts: LumiProduct[] = [
  {
    id: 'lumi-life-trip',
    slug: 'today-where-to-go',
    name: 'Lumi～今天去哪玩？',
    eyebrow: '北台灣一日／半日遊行程規劃',
    type: 'Web App',
    category: 'life',
    shortDescription: '輸入出發地、時間、同行者與偏好，整理 3 組北台灣一日／半日遊行程。',
    longDescription: '不用在十幾個分頁之間來回比較。告訴 Lumi 這次從哪裡出發、和誰一起、想要什麼步調，就能得到三組好安排也好調整的行程方向。',
    tags: ['Web App', 'Lumi Life', '北台灣', '一日遊'],
    thumbnail: 'day-trip',
    ...sharedFree,
    ctaLabel: '開始規劃',
    ctaUrl: '/login',
    featured: true,
    sortOrder: 10,
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
    id: 'lumi-life-cook',
    slug: 'what-to-cook',
    name: 'Lumi 今天煮什麼？',
    type: 'Web App',
    category: 'life',
    shortDescription: '從冰箱現有食材、料理時間與人數開始，整理今天真的煮得出來的一餐。',
    longDescription: '不用先想菜名。從手邊有什麼、今天有多少時間開始，Lumi 幫你把材料與做法整理成一頓真正能端上桌的料理。',
    tags: ['Web App', 'Lumi Life', '料理', '家庭'],
    thumbnail: 'home-cooking',
    ...sharedFree,
    ctaLabel: '幫我想菜單',
    ctaUrl: '/login',
    featured: false,
    sortOrder: 20,
    audience: ['每天都在想菜單的人', '想清冰箱食材的家庭', '料理時間有限的上班族'],
    benefits: ['從現有食材開始', '依時間與人數調整', '減少臨時採買與浪費'],
    features: [
      { title: '看冰箱再決定', description: '先用已有食材規劃，不從複雜食譜清單開始。' },
      { title: '配合今天的時間', description: '依可用時間調整料理複雜度與步驟。' },
      { title: '份量更剛好', description: '把用餐人數納入建議，讓準備更貼近日常。' },
    ],
    usageSteps: ['輸入現有食材', '補充人數與可用時間', '選一份今天做得到的菜單'],
  },
  {
    id: 'lumi-life-eat',
    slug: 'where-to-eat',
    name: 'Lumi 今天吃哪間？',
    type: 'Web App',
    category: 'life',
    shortDescription: '依地點、預算、同行者與今天想吃的感覺，幫你把餐廳選擇縮小。',
    longDescription: '選餐廳不需要再靠無止盡滑動。Lumi 從今天的地點、預算、同行者與口味出發，幫你留下更適合此刻的選擇。',
    tags: ['Web App', 'Lumi Life', '外食', '餐廳'],
    thumbnail: 'restaurant',
    ...sharedFree,
    ctaLabel: '幫我選餐廳',
    ctaUrl: '/login',
    featured: false,
    sortOrder: 30,
    audience: ['總是選不出餐廳的人', '朋友與家庭聚餐', '想控制預算又不想隨便吃的人'],
    benefits: ['快速縮小選項', '兼顧同行者需求', '讓選擇符合今天的心情'],
    features: [
      { title: '情境式選擇', description: '地點、預算、對象與口味一起納入考量。' },
      { title: '選項不過量', description: '留下少量較適合的方向，降低選擇疲勞。' },
      { title: '適合一起討論', description: '整理清楚的理由，讓同行者更容易做決定。' },
    ],
    usageSteps: ['告訴 Lumi 你在哪裡', '設定預算、同行者與想吃的感覺', '從整理後的選擇中決定一間'],
  },
  {
    id: 'lumi-kids-contact-book',
    slug: 'kindergarten-contact-book',
    name: '幼兒園聯絡本小幫手',
    type: 'Web App',
    category: 'kids',
    subCategory: '教師工具',
    shortDescription: '把每天的活動、孩子表現與提醒事項，整理成自然、清楚又有溫度的聯絡本內容。',
    longDescription: '保留老師真實的觀察與語氣，再把零散紀錄整理成家長容易理解的聯絡本內容，減少每天重複書寫的負擔。',
    tags: ['Web App', 'Lumi Kids', '教師工具', '聯絡本'],
    thumbnail: 'contact-book',
    ...sharedFree,
    ctaLabel: '開始使用',
    ctaUrl: '/login',
    featured: true,
    sortOrder: 40,
    audience: ['幼兒園教師', '需要撰寫每日紀錄的教保人員', '重視親師溝通品質的園所'],
    benefits: ['保留每個孩子的差異', '讓文字自然有溫度', '縮短每日整理時間'],
    features: [
      { title: '從觀察紀錄開始', description: '把活動、表現與提醒分開整理，重點不遺漏。' },
      { title: '自然親切的語氣', description: '避免制式套句，保留老師與家長之間的溫度。' },
      { title: '內容清楚好閱讀', description: '讓家長快速理解孩子今天的學習與生活。' },
    ],
    usageSteps: ['填入今天的活動與孩子表現', '補上個別提醒或想分享的小事', '確認並調整整理後的聯絡本內容'],
  },
  {
    id: 'lumi-kids-comments',
    slug: 'kindergarten-term-comments',
    name: '幼教期末評語工具',
    type: 'Web App',
    category: 'kids',
    subCategory: '教師工具',
    shortDescription: '把一學期的觀察重點整理成自然、不重複、符合孩子個別狀況的期末評語。',
    longDescription: '把一學期累積的重點變成有層次的文字，兼顧孩子的特質、成長與下一步，不再為了每一則評語從空白開始。',
    tags: ['Web App', 'Lumi Kids', '教師工具', '期末評語'],
    thumbnail: 'term-comments',
    ...sharedFree,
    ctaLabel: '開始使用',
    ctaUrl: '/login',
    featured: false,
    sortOrder: 50,
    audience: ['幼兒園教師', '需要大量撰寫評語的教保人員', '希望評語更貼近孩子的園所'],
    benefits: ['整理整學期觀察', '降低重複句型', '保留個別成長脈絡'],
    features: [
      { title: '重點有脈絡', description: '將不同時期的觀察整理成完整而連續的敘述。' },
      { title: '每位孩子不同', description: '依個別特質調整內容，不用同一套模板反覆套用。' },
      { title: '語氣自然正向', description: '具體描述成長，也溫和帶出未來可以練習的方向。' },
    ],
    usageSteps: ['整理孩子本學期的觀察重點', '選擇希望呈現的成長面向', '檢視並微調完成的期末評語'],
  },
  {
    id: 'lumi-creator-line-sticker',
    slug: 'line-sticker-planner',
    name: 'LINE 貼圖企劃製作助手',
    type: 'AI Skill',
    category: 'creator',
    shortDescription: '從角色設定、40 張內容規劃，到名稱、介紹與生成 Prompt，一步步完成整套 LINE 貼圖企劃。',
    longDescription: '把角色想法整理成可持續製作的貼圖企劃，從角色個性、常用情境到完整張數規劃，讓創作不再卡在第一張。',
    tags: ['AI Skill', 'Lumi Creator', 'LINE 貼圖', 'IP 創作'],
    thumbnail: 'line-sticker',
    ...sharedTrial,
    ctaLabel: '開始試用',
    ctaUrl: '/login',
    featured: true,
    sortOrder: 60,
    audience: ['第一次製作 LINE 貼圖的人', '插畫與角色創作者', '想發展個人 IP 的品牌'],
    benefits: ['建立角色設定', '一次規劃 40 張內容', '整理生成與上架文案'],
    features: [
      { title: '角色先站穩', description: '先整理外型、個性與說話方式，維持整套貼圖一致。' },
      { title: '內容不再重複', description: '從日常使用情境規劃 40 張有差異也實用的內容。' },
      { title: '企劃一路到生成', description: '名稱、介紹與 Prompt 一起整理，減少工具之間的斷點。' },
    ],
    usageSteps: ['描述你的角色或初步想法', '選擇語氣、情境與使用對象', '取得整套貼圖企劃與製作 Prompt'],
  },
  {
    id: 'lumi-creator-social',
    slug: 'social-content-helper',
    name: '社群內容助手',
    type: 'AI Skill',
    category: 'creator',
    shortDescription: '同一個主題，整理成適合 LINE、Facebook、Instagram、Threads 的不同版本。',
    longDescription: '不必把同一段文案硬貼到每個平台。Lumi 依各平台的閱讀習慣與互動方式，保留核心訊息並調整成更自然的版本。',
    tags: ['AI Skill', 'Lumi Creator', '社群內容', '多平台'],
    thumbnail: 'social-content',
    ...sharedTrial,
    ctaLabel: '開始試用',
    ctaUrl: '/login',
    featured: false,
    sortOrder: 70,
    audience: ['個人品牌經營者', '小型商家與內容團隊', '同時經營多平台的人'],
    benefits: ['一次整理多平台版本', '保留一致核心訊息', '減少重複改寫時間'],
    features: [
      { title: '一個主題多種語氣', description: '依平台調整篇幅、節奏與互動方式。' },
      { title: '品牌重點不走樣', description: '所有版本保留相同主軸，內容更一致。' },
      { title: '可以直接再編修', description: '提供清楚初稿，方便加入個人語氣與即時資訊。' },
    ],
    usageSteps: ['貼上主題、活動或原始資料', '選擇要使用的社群平台', '取得各平台版本並做最後調整'],
  },
  {
    id: 'lumi-creator-product-scene',
    slug: 'product-scene-planner',
    name: '商品情境圖企劃助手',
    type: 'AI Skill',
    category: 'creator',
    shortDescription: '從賣點、使用情境到構圖與生成 Prompt，整理適合社群銷售的商品視覺方向。',
    longDescription: '先想清楚商品要被誰、在什麼情境下看見，再整理構圖、光線、道具與生成 Prompt，讓畫面不只好看，也能說出賣點。',
    tags: ['AI Skill', 'Lumi Creator', '商品圖', 'AI 圖像'],
    thumbnail: 'product-scene',
    ...sharedTrial,
    ctaLabel: '開始試用',
    ctaUrl: '/login',
    featured: false,
    sortOrder: 80,
    audience: ['社群賣家與團購主', '小型品牌', '需要規劃商品視覺的內容創作者'],
    benefits: ['把賣點轉成畫面', '建立一致視覺方向', '取得可執行生成 Prompt'],
    features: [
      { title: '從商品賣點開始', description: '視覺回到產品用途與受眾，不只追求漂亮。' },
      { title: '情境與構圖一起想', description: '整理場景、角度、光線與道具之間的關係。' },
      { title: '生成指令更完整', description: '把企劃轉成結構清楚、可繼續調整的 Prompt。' },
    ],
    usageSteps: ['輸入商品資料與主要賣點', '選擇受眾與想呈現的使用情境', '取得視覺企劃與圖片生成 Prompt'],
  },
  {
    id: 'lumi-creator-character',
    slug: 'cute-character-creator',
    name: 'Q萌角色／IP 創作助手',
    type: 'AI Skill',
    category: 'creator',
    shortDescription: '從人物、寵物或想法開始，建立可以持續延伸的角色外型、個性與視覺規則。',
    longDescription: '把一個喜歡的形象發展成可持續創作的角色，整理外型、比例、表情、個性與世界觀，讓下一張作品仍然看得出是同一位主角。',
    tags: ['AI Skill', 'Lumi Creator', 'Q萌角色', 'IP 創作'],
    thumbnail: 'character',
    ...sharedTrial,
    ctaLabel: '開始試用',
    ctaUrl: '/login',
    featured: false,
    sortOrder: 90,
    audience: ['想把寵物變成角色的人', '插畫與貼圖創作者', '正在建立品牌 IP 的團隊'],
    benefits: ['釐清角色個性', '建立外型規則', '方便延伸不同場景與作品'],
    features: [
      { title: '從熟悉的人事物開始', description: '人物、寵物或一個抽象想法，都能整理成角色起點。' },
      { title: '外型有一致規則', description: '建立比例、色彩與辨識特徵，讓角色容易被記住。' },
      { title: '可以持續長大', description: '預留表情、動作與故事延伸方向，不停在單張圖。' },
    ],
    usageSteps: ['描述人物、寵物或角色概念', '選擇個性、風格與主要用途', '取得角色設定與後續創作規則'],
  },
  {
    id: 'lumi-business-copy',
    slug: 'group-buying-copywriter',
    name: 'AI 團購文案助手',
    type: 'AI Skill',
    category: 'business',
    shortDescription: '把零散商品資料整理成自然、好讀，適合 LINE、Facebook、Instagram 的團購文案。',
    longDescription: '從原始商品資料中找出消費者真正想知道的重點，再依不同社群情境整理成自然、好讀、不過度推銷的團購文案。',
    tags: ['AI Skill', 'Lumi Business', '團購', '社群銷售'],
    thumbnail: 'group-copy',
    ...sharedTrial,
    ctaLabel: '開始試用',
    ctaUrl: '/login',
    featured: false,
    sortOrder: 100,
    audience: ['團購主與社群賣家', '小型電商品牌', '需要快速整理商品內容的人'],
    benefits: ['整理零散商品資料', '依平台調整文案', '讓賣點自然不生硬'],
    features: [
      { title: '先整理再寫', description: '先釐清規格、賣點與受眾，避免內容東一塊西一塊。' },
      { title: '保留真實語氣', description: '以好讀、可信任的方式介紹商品，不堆疊空泛形容詞。' },
      { title: '多平台都能用', description: '依 LINE、Facebook 與 Instagram 調整呈現方式。' },
    ],
    usageSteps: ['貼上商品資訊、價格與活動內容', '設定受眾、平台與說話語氣', '取得可再編輯的團購文案版本'],
  },
  {
    id: 'lumi-business-operations',
    slug: 'group-buying-operations',
    name: '團購主營運助手',
    type: 'AI Skill',
    category: 'business',
    shortDescription: '協助整理商品、開團順序、社群內容與每日營運重點，把零散工作變成可執行清單。',
    longDescription: '把商品、檔期、內容與每天要處理的事項放回同一條營運脈絡，找出優先順序，讓開團不再靠腦中記憶與臨時反應。',
    tags: ['AI Skill', 'Lumi Business', '團購營運', '工作效率'],
    thumbnail: 'operations',
    ...sharedTrial,
    ctaLabel: '開始試用',
    ctaUrl: '/login',
    featured: false,
    sortOrder: 110,
    audience: ['個人團購主', '小型社群銷售團隊', '同時管理多個商品檔期的人'],
    benefits: ['整理開團優先順序', '串起內容與營運節奏', '把工作變成每日清單'],
    features: [
      { title: '商品檔期有全貌', description: '一起查看商品、活動與內容需求，減少時間衝突。' },
      { title: '每天知道先做什麼', description: '依時程與重要性整理可以逐項完成的行動。' },
      { title: '營運資訊不再散落', description: '將重點放回同一個工作流程，降低來回搜尋。' },
    ],
    usageSteps: ['輸入目前商品、檔期與待辦事項', '設定這段時間的優先目標', '取得每日可執行的營運清單'],
  },
]

export function getLumiProduct(slug: string) {
  return lumiProducts.find((product) => product.slug === slug)
}

export function formatLumiPricing(product: LumiProduct) {
  if (product.pricingType === 'free') return '免費使用'
  if (product.pricingType === 'coming_soon') return '即將推出'
  if (product.pricingType === 'paid' && product.price && product.currency) {
    return `${product.currency === 'USD' ? 'US$' : 'NT$'}${product.price}`
  }
  if (product.pricingType === 'free_trial' && product.trialDays && product.price) {
    return `${product.trialDays} 天免費試用 · US$${product.price}`
  }
  return '方案準備中'
}
