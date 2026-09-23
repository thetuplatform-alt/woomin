import {
  BookHeart,
  Camera,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Heart,
  MapPin,
  MapPinned,
  MessageCircleHeart,
  MessagesSquare,
  PackageCheck,
  Palette,
  PenTool,
  Route,
  Send,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import styles from './lumi-series.module.css'

type ArtworkVariant = {
  kind: 'app' | 'skill'
  accent: 'sky' | 'peach' | 'rose' | 'sage' | 'lavender' | 'butter'
  Icon: typeof Sparkles
  label: string
  primary: string
  secondary: string
  tertiary: string
}

const visualSystemV2: Record<string, ArtworkVariant> = {
  'day-trip': { kind: 'app', accent: 'sky', Icon: MapPinned, label: '行程即時整理', primary: '北台灣半日', secondary: '室內優先', tertiary: '3 組提案' },
  'home-cooking': { kind: 'app', accent: 'peach', Icon: ChefHat, label: '把冰箱變晚餐', primary: '現有食材', secondary: '30 分鐘', tertiary: '今晚菜單' },
  restaurant: { kind: 'app', accent: 'rose', Icon: UtensilsCrossed, label: '快速縮小選擇', primary: '所在位置', secondary: '同行對象', tertiary: '餐廳方向' },
  'contact-book': { kind: 'app', accent: 'sage', Icon: BookHeart, label: '保留觀察溫度', primary: '今日活動', secondary: '孩子表現', tertiary: '聯絡簿內容' },
  'term-comments': { kind: 'app', accent: 'lavender', Icon: PenTool, label: '看見每個孩子', primary: '學期觀察', secondary: '成長亮點', tertiary: '個別評語' },
  'line-sticker': { kind: 'skill', accent: 'butter', Icon: MessageCircleHeart, label: '角色到 40 張規劃', primary: '角色設定', secondary: '情境矩陣', tertiary: '創作 Prompt' },
  'social-content': { kind: 'skill', accent: 'sky', Icon: MessagesSquare, label: '一個主題多種語氣', primary: '核心主題', secondary: '平台拆解', tertiary: '多版本文案' },
  'product-scene': { kind: 'skill', accent: 'peach', Icon: Camera, label: '把賣點變成畫面', primary: '產品賣點', secondary: '場景構圖', tertiary: '生成 Prompt' },
  character: { kind: 'skill', accent: 'rose', Icon: Palette, label: '建立角色規則', primary: '角色個性', secondary: '造型語彙', tertiary: '延伸設定' },
  'group-copy': { kind: 'skill', accent: 'lavender', Icon: ShoppingBag, label: '商品資訊變好讀', primary: '商品資料', secondary: '購買理由', tertiary: '平台文案' },
  operations: { kind: 'skill', accent: 'sage', Icon: ClipboardList, label: '每天都知道下一步', primary: '檔期任務', secondary: '優先順序', tertiary: '行動清單' },
}

function WebAppArtwork({ item }: { item: ArtworkVariant }) {
  const Icon = item.Icon
  return (
    <div className={styles.appScene} aria-hidden="true">
      <span className={styles.sceneFloor} />
      <div className={styles.appDevice}>
        <div className={styles.appToolbar}><i /><i /><i /><span>WEB APP</span></div>
        <div className={styles.appWorkspace}>
          <span className={styles.appIcon}><Icon size={27} /></span>
          <div className={styles.appInputs}><i /><i /></div>
          <div className={styles.appResults}>
            <span><small>INPUT</small><b>{item.primary}</b></span>
            <span><small>CONTEXT</small><b>{item.secondary}</b></span>
            <span><small>RESULT</small><b>{item.tertiary}</b></span>
          </div>
        </div>
      </div>
      <span className={styles.appAction}><CheckCircle2 size={13} /> 即時完成</span>
    </div>
  )
}

function AiSkillArtwork({ item }: { item: ArtworkVariant }) {
  const Icon = item.Icon
  return (
    <div className={styles.skillScene} aria-hidden="true">
      <span className={styles.sceneFloor} />
      <div className={styles.skillPrompt}>
        <span className={styles.skillIcon}><Icon size={25} /></span>
        <small>PROMPT</small>
        <b>{item.primary}</b>
        <i /><i />
      </div>
      <span className={styles.skillConnector}><Sparkles size={15} /></span>
      <div className={styles.skillOutputs}>
        <span><small>STRUCTURE</small><b>{item.secondary}</b></span>
        <span><small>OUTPUT</small><b>{item.tertiary}</b></span>
      </div>
      <span className={styles.skillNote}>Lumi 協作整理</span>
    </div>
  )
}

function TripPlannerArtwork() {
  return (
    <div className={styles.tripPlannerScene} aria-hidden="true">
      <span className={styles.sceneFloor} />
      <div className={styles.tripMapBoard}>
        <header><MapPinned size={17} /><b>TRIP PLANNER</b><span>北台灣</span></header>
        <div className={styles.tripMap}>
          <i className={styles.tripRoute} />
          <span className={styles.tripPinOne}><MapPin size={13} /></span>
          <span className={styles.tripPinTwo}><MapPin size={13} /></span>
          <span className={styles.tripPinThree}><MapPin size={13} /></span>
          <small>親子・半日</small>
        </div>
      </div>
      <div className={styles.tripItinerary}>
        <small>今日行程</small>
        <span><i>1</i><b>室內景點</b></span>
        <span><i>2</i><b>附近午餐</b></span>
        <span><i>3</i><b>親子散步</b></span>
      </div>
      <span className={styles.tripReady}><Route size={13} /> 3 組路線</span>
    </div>
  )
}

function StickerPlannerArtwork() {
  return (
    <div className={styles.stickerPlannerScene} aria-hidden="true">
      <span className={styles.sceneFloor} />
      <div className={styles.stickerBrief}>
        <span><MessageCircleHeart size={19} /></span>
        <small>CHARACTER BRIEF</small>
        <b>角色語氣與表情</b>
        <i /><i />
      </div>
      <span className={styles.stickerSpark}><Sparkles size={14} /></span>
      <div className={styles.stickerGrid}>
        {['早安', '收到', '加油', '謝謝'].map((label, index) => (
          <span key={label} data-expression={index + 1}>
            <i className={styles.stickerFace}><b /><b /><em /></i>
            <small>{label}</small>
          </span>
        ))}
      </div>
      <div className={styles.stickerFlow}><b>角色設定</b><i /><b>40 格企劃</b><i /><b>生成 Prompt</b></div>
    </div>
  )
}

function GroupCopyArtwork() {
  return (
    <div className={styles.groupCopyScene} aria-hidden="true">
      <span className={styles.sceneFloor} />
      <div className={styles.productBrief}>
        <span className={styles.productPackage}><ShoppingBag size={22} /></span>
        <small>PRODUCT BRIEF</small>
        <b>商品亮點</b>
        <i /><i />
      </div>
      <span className={styles.copySpark}><Sparkles size={14} /></span>
      <div className={styles.copyOutput}>
        <header><PackageCheck size={15} /><b>團購貼文</b><i /><i /></header>
        <strong>把商品特色說得自然又好懂</strong>
        <span /><span /><span />
        <footer><small>#限時團購</small><Send size={12} /></footer>
      </div>
      <div className={styles.copyChannels}><span>LINE</span><span>FB</span><span>IG</span></div>
    </div>
  )
}

const representativeArtwork = {
  'day-trip': TripPlannerArtwork,
  'line-sticker': StickerPlannerArtwork,
  'group-copy': GroupCopyArtwork,
} as const

export function ProductArtwork({ thumbnail, name }: { thumbnail: string; name: string }) {
  const isUploadedImage = /^https:\/\//i.test(thumbnail) || /^\/(?!\/)/.test(thumbnail)
  if (isUploadedImage) {
    return (
      <div className={styles.productArtwork} role="img" aria-label={`${name} 工具圖片`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" className="absolute inset-0 h-full w-full object-cover" src={thumbnail} />
      </div>
    )
  }

  const item = visualSystemV2[thumbnail] ?? {
    kind: 'skill', accent: 'sage', Icon: Sparkles, label: 'Lumi 工具',
    primary: '你的需求', secondary: '清楚結構', tertiary: '可用成果',
  }
  const RepresentativeArtwork = representativeArtwork[thumbnail as keyof typeof representativeArtwork]

  return (
    <div
      className={`${styles.productArtwork} ${styles.visualV2} ${styles[`artwork_${item.accent}`]} ${styles[item.kind === 'app' ? 'visualApp' : 'visualSkill']}`}
      data-scene={thumbnail}
      role="img"
      aria-label={`${name} 功能情境示意圖`}
    >
      <span className={styles.visualGlow} aria-hidden="true" />
      {RepresentativeArtwork ? (
        <RepresentativeArtwork />
      ) : item.kind === 'app' ? (
        <WebAppArtwork item={item} />
      ) : (
        <AiSkillArtwork item={item} />
      )}
      <span className={styles.visualCaption}><Heart size={12} fill="currentColor" /> {item.label}</span>
    </div>
  )
}
