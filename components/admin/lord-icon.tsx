// components/admin/lord-icon.tsx
// Lordicon PoC 包裝元件：把 Lottie 動畫 icon 接進後台側邊欄
// - hover 時播放動畫（trigger）
// - colorize 跟隨 active / hover / 預設 三種狀態，且深色模式自動切換
//
// 注意：後台深色模式是把 .admin-dark 套在「包裹 div」上（見 admin-layout-client.tsx），
// 不是套在 <html>。因此顏色必須從本元件「自己的 DOM 節點」讀（位於 .admin-dark scope 內），
// 從 document.documentElement 讀會永遠拿到淺色值。

"use client";

import { useEffect, useRef, useState } from "react";
import { Player } from "@lordicon/react";

type LordIconProps = {
  // 已 parse 的 Lottie JSON（從 public/lordicon/*.json import 進來）
  icon: object;
  size?: number;
  active?: boolean; // 啟用中（位於 primary 背景上）
  hovered?: boolean; // 整列 hover
  // 傳入目前主題，切換深淺色時觸發顏色重算
  theme?: string;
};

// 對應 nav 列的文字配色（active / hover → 文字主色；預設 → 輔助灰）。
// active 已改為淡灰底＋foreground 文字，所以 icon 也用 foreground，不再用白色。
// 從 el 所在 scope 解析 CSS 變數，才能正確吃到 .admin-dark 的深色覆寫。
function resolveColor(
  el: HTMLElement | null,
  active?: boolean,
  hovered?: boolean
) {
  // active：位於深灰底上 → icon 反白
  if (active) return "#ffffff";
  const fallback = hovered ? "#0f172a" : "#64748b";
  if (!el) return fallback;
  const varName = hovered ? "--foreground" : "--muted-foreground";
  const v = getComputedStyle(el).getPropertyValue(varName).trim();
  return v || fallback;
}

export function LordIcon({
  icon,
  size = 20,
  active,
  hovered,
  theme,
}: LordIconProps) {
  const playerRef = useRef<Player>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [color, setColor] = useState("#64748b");

  // lottie-web 需要 DOM，掛載後才渲染，避免 SSR / hydration 問題
  useEffect(() => setMounted(true), []);

  // 依 active / hover / theme 變化重算顏色（從本節點讀，含 .admin-dark 深色）
  useEffect(() => {
    setColor(resolveColor(wrapRef.current, active, hovered));
  }, [active, hovered, theme, mounted]);

  // 多數 Lordicon 動畫的起始幀是「空的」（從無到有畫出來），靜止狀態會看不到圖。
  // 關鍵：必須等動畫「載入完成」(onReady) 後才能 goToLastFrame，否則會 no-op（先前的 bug）。
  // 就緒後：未 hover → 停在最後一幀（顯示完整 icon）；hover → 從頭重畫一次。
  // color 放進相依，是因為換色會讓 Player 重繪，需要重新停回完整幀。
  useEffect(() => {
    if (!ready) return;
    if (hovered) playerRef.current?.playFromBeginning();
    else playerRef.current?.goToLastFrame();
  }, [ready, hovered, color]);

  // 用等尺寸的 wrapper 佔位，避免掛載前後版面跳動（pop-in 也限制在這個方框內）
  return (
    <span
      ref={wrapRef}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        // Lordicon 的 Lottie 內容偏上，往下推約 15% 高度，與文字視覺對齊
        transform: "translateY(15%)",
      }}
    >
      {mounted && (
        <Player
          ref={playerRef}
          icon={icon}
          size={size}
          colorize={color}
          onReady={() => setReady(true)}
        />
      )}
    </span>
  );
}
