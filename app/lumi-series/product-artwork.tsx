import {
  BookHeart,
  Camera,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Heart,
  MapPinned,
  MessageCircleHeart,
  MessagesSquare,
  Palette,
  PenTool,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import styles from './lumi-series.module.css'

const artworkMap = {
  'day-trip': { Icon: MapPinned, accent: 'sky', label: '週末小旅行' },
  'home-cooking': { Icon: ChefHat, accent: 'peach', label: '今天的餐桌' },
  restaurant: { Icon: UtensilsCrossed, accent: 'rose', label: '今晚吃什麼' },
  'contact-book': { Icon: BookHeart, accent: 'sage', label: '溫暖的日常紀錄' },
  'term-comments': { Icon: PenTool, accent: 'lavender', label: '看見每個成長' },
  'line-sticker': { Icon: MessageCircleHeart, accent: 'butter', label: '40 張貼圖企劃' },
  'social-content': { Icon: MessagesSquare, accent: 'sky', label: '一題多平台' },
  'product-scene': { Icon: Camera, accent: 'peach', label: '把賣點變成畫面' },
  character: { Icon: Palette, accent: 'rose', label: '角色從這裡長大' },
  'group-copy': { Icon: ShoppingBag, accent: 'lavender', label: '好讀的團購內容' },
  operations: { Icon: ClipboardList, accent: 'sage', label: '每天都有下一步' },
} as const

export function ProductArtwork({ thumbnail, name }: { thumbnail: string; name: string }) {
  const item = artworkMap[thumbnail as keyof typeof artworkMap] ?? {
    Icon: Sparkles,
    accent: 'sage',
    label: 'Lumi 工具',
  }
  const Icon = item.Icon

  return (
    <div className={`${styles.productArtwork} ${styles[`artwork_${item.accent}`]}`} role="img" aria-label={`${name} 示意圖`}>
      <span className={styles.artworkSun} aria-hidden="true" />
      <span className={styles.artworkLeaf} aria-hidden="true" />
      <div className={styles.artworkWindow} aria-hidden="true">
        <span className={styles.artworkDots}><i /><i /><i /></span>
        <div className={styles.artworkContent}>
          <span className={styles.artworkIcon}><Icon size={31} /></span>
          <span className={styles.artworkLines}><i /><i /><i /></span>
        </div>
        <span className={styles.artworkSuccess}><CheckCircle2 size={13} /> ready</span>
      </div>
      <span className={styles.artworkCaption}><Heart size={12} fill="currentColor" /> {item.label}</span>
    </div>
  )
}
