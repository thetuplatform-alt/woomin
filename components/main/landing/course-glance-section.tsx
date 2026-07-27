// components/main/landing/course-glance-section.tsx
// 課程資訊橫幅 — Course At a Glance
// 參考知識衛星風格：圓底 icon + 標題 + 說明，兩欄排列

import {
  Clapperboard,
  Timer,
  BookOpenText,
  Infinity,
  type LucideIcon,
  Users,
} from "lucide-react";

interface GlanceItem {
  icon: LucideIcon;
  label: string;
  desc: string;
}
const glanceItems: GlanceItem[] = [
  {
    icon: Clapperboard, // 或是 MonitorPlay
    label: "課程架構",
    desc: "21 個核心單元，涵蓋從觀念重塑到 App Store 上架的完整開發流",
  },
  {
    icon: Timer,
    label: "核心時長",
    desc: "2.5 小時去蕪存菁的實戰精華，讓你用最有效率的方法學習",
  },
  {
    icon: BookOpenText,
    label: "教材規格",
    desc: "100% 完整中文字幕，搭配實機操作錄影與詳盡圖文手冊",
  },
  {
    icon: Infinity,
    label: "存取權限",
    desc: "買斷制永久觀看，技術演進的未來課程更新皆可免費獲取",
  },
  {
    icon: Users,
    label: "參與規模",
    desc: "超過 450 位跨領域學員見證，附帶專屬校友交流社群",
  },
];

function GlanceCard({ item }: { item: GlanceItem }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cta">
        <item.icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-bold text-heading">{item.label}</span>
        <span className="text-xs text-caption">{item.desc}</span>
      </div>
    </div>
  );
}

export function CourseGlanceSection() {
  return (
    <section className="border-y border-divider bg-surface py-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-heading sm:text-xl">
          <span className="inline-block h-5 w-1 rounded-full bg-cta" />
          課程資訊
        </h2>

        <div className="grid px-4 sm:px-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {glanceItems.map((item) => (
            <GlanceCard key={item.label} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
