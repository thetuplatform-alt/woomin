export type LumiUsageExample = {
  input: string
  result: string
  variant?: 'comparison' | 'list' | 'before-after' | 'prompt-breakdown' | 'mini-cards'
  items?: {
    label?: string
    title: string
    description?: string
  }[]
}

const lumiUsageExamples: Record<string, LumiUsageExample> = {
  'today-where-to-go': {
    input: '台北出發｜親子｜半日｜室內優先',
    result: '整理 3 組北台灣半日行程方向，方便比較不同節奏並再依需要調整。',
    variant: 'comparison',
    items: [
      { label: '方案 01', title: '城市室內型', description: '展覽與室內景點為主，移動較少。' },
      { label: '方案 02', title: '親子放電型', description: '安排可活動的空間，中間保留休息。' },
      { label: '方案 03', title: '輕鬆散步型', description: '室內為主、短距離散步為輔。' },
    ],
  },
  'what-to-cook': {
    input: '雞胸肉、雞蛋｜2 人｜30 分鐘',
    result: '依現有食材、份量與時間，整理今天實際做得到的菜單方向。',
    variant: 'mini-cards',
    items: [
      { label: '主食', title: '雞胸滑蛋蓋飯', description: '同鍋完成，適合 30 分鐘內上桌。' },
      { label: '快炒', title: '雞胸蛋炒飯', description: '利用現有食材，份量容易調整。' },
      { label: '輕食', title: '香煎雞胸配嫩蛋', description: '拆成兩道簡單料理，口感更有變化。' },
    ],
  },
  'where-to-eat': {
    input: '台北車站｜2 人｜平價｜想吃熱食',
    result: '依地點、預算與用餐偏好縮小選擇，提供更容易決定的餐廳方向。',
  },
  'kindergarten-contact-book': {
    input: '戶外活動｜主動幫助同學｜提醒補水',
    result: '把活動、孩子表現與提醒事項整理成自然、有溫度的聯絡本內容。',
    variant: 'before-after',
    items: [
      { label: '原始筆記', title: '戶外活動，主動幫同學，要提醒補水。' },
      { label: '整理後示例', title: '今天戶外活動時，孩子會主動關心並幫助同學。', description: '活動量較大，回家後也請陪他多補充水分。' },
    ],
  },
  'kindergarten-term-comments': {
    input: '樂於分享｜精細動作進步｜需要更多表達鼓勵',
    result: '依觀察重點整理成個別化、不重複且適合期末使用的評語草稿。',
    variant: 'before-after',
    items: [
      { label: '觀察重點', title: '樂於分享，精細動作進步，需要更多表達鼓勵。' },
      { label: '評語草稿示例', title: '這學期樂於與同伴分享，精細動作也有明顯進步。', description: '期待下學期繼續鼓勵他說出自己的想法。' },
    ],
  },
  'line-sticker-planner': {
    input: '怕生但溫柔的橘貓｜日常聊天｜可愛幽默',
    result: '整理角色設定、40 張貼圖內容方向，以及後續製作可使用的 Prompt。',
    variant: 'prompt-breakdown',
    items: [
      { label: '角色', title: '怕生但溫柔的橘貓', description: '圓潤、微慢熟，表情含蓄。' },
      { label: '內容組', title: '問候・回應・情緒・貼心提醒', description: '規劃 40 張貼圖的使用情境。' },
      { label: 'Prompt', title: '角色特徵＋動作＋表情＋留白', description: '整理成可繼續調整的製作結構。' },
    ],
  },
  'social-content-helper': {
    input: '新品上市｜溫暖自然｜LINE、Instagram、Threads',
    result: '保留同一核心訊息，整理成符合不同社群閱讀節奏的內容版本。',
  },
  'product-scene-planner': {
    input: '手作香氛蠟燭｜居家放鬆｜米白暖色',
    result: '整理使用情境、構圖方向與可繼續調整的商品情境圖生成 Prompt。',
    variant: 'prompt-breakdown',
    items: [
      { label: '情境', title: '居家放鬆', description: '將蜡燭放在真實可想像的使用空間。' },
      { label: '視覺', title: '米白暖色・自然側光', description: '搭配木質桌面與少量織品道具。' },
      { label: 'Prompt', title: '商品主體＋空間＋光線＋道具', description: '形成可再編輯的生成描述骨架。' },
    ],
  },
  'cute-character-creator': {
    input: '活潑的米克斯犬｜陪伴系角色｜圓潤可愛',
    result: '建立角色外型、個性與視覺規則，作為後續延伸創作的共同基礎。',
  },
  'group-buying-copywriter': {
    input: '常溫點心｜家庭分享｜LINE 團購',
    result: '從商品資料整理出自然、好讀，並適合指定社群平台的團購文案。',
  },
  'group-buying-operations': {
    input: '本週 3 個商品｜週五結單｜每天 1 則社群內容',
    result: '整理開團順序、內容節奏與每日可執行的營運重點清單。',
  },
}

export function getLumiUsageExample(slug: string): LumiUsageExample | null {
  return lumiUsageExamples[slug] ?? null
}
