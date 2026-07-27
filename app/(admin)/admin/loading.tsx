// app/(admin)/admin/loading.tsx
// 後台 route-level loading 邊界
// 單檔即為整個後台子樹建立 Suspense fallback：切換分頁時，側邊欄保留、
// 內容區立即顯示載入中（而非 force-dynamic 下整頁凍住、無任何回饋）。

import { Loader2 } from 'lucide-react'

export default function AdminLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
    </div>
  )
}
