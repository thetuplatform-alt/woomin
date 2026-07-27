"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  buildVideoWatermarkLines,
  type VideoWatermarkPayload,
} from "@/lib/video-watermark";

// client 端用 useLayoutEffect 在 paint 前定位（避免閃爍）；SSR 退回 useEffect 避免警告
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface VideoWatermarkOverlayProps {
  watermark?: VideoWatermarkPayload;
  /** 浮水印 DOM 所在的定位父層（通常是播放器最外層容器，可能是全螢幕的 fixed 容器） */
  containerRef: RefObject<HTMLElement | null>;
  /**
   * 影片實際渲染的 16:9 方框（letterbox-aware）。
   * 全螢幕直向時外層容器是整個視窗、影片被上下黑邊夾住，
   * 浮水印必須相對「影片方框」定位才不會飄到黑邊或衝出畫面。
   * 未提供時退回 containerRef。
   */
  videoFrameRef?: RefObject<HTMLElement | null>;
  onTamper?: (reason: string) => void;
}

type NormalizedTarget = {
  fx: number;
  fy: number;
};

const TAMPER_CHECK_INTERVAL_MS = 2000;
// 浮水印一律被 clamp 在影片方框內，穩態交集比例應 ~1.0；
// 低於此值代表被惡意 CSS 推出畫面，才視為竄改。
const MIN_VISIBLE_RATIO = 0.5;
const TAMPER_GRACE_PERIOD_MS = 5000;
const ARM_GRACE_PERIOD_MS = 1500;
const MUTATION_CHECK_DEBOUNCE_MS = 250;
const DEFAULT_TARGET: NormalizedTarget = { fx: 0.12, fy: 0.12 };

type WatermarkCheckLog = {
  status: "missing" | "detached" | "hidden" | "armed";
  reason?: string;
  invisibleForMs?: number;
  intersectionRatio?: number;
  opacity?: number;
  zIndex?: string;
};

function getFontClass(textSize: VideoWatermarkPayload["textSize"]): string {
  if (textSize === "SM") return "text-[9px] sm:text-xs";
  if (textSize === "LG") return "text-xs sm:text-base";
  return "text-[10px] sm:text-sm";
}

function getIntersectionRatio(overlayRect: DOMRect, frameRect: DOMRect): number {
  const overlapWidth =
    Math.min(overlayRect.right, frameRect.right) -
    Math.max(overlayRect.left, frameRect.left);
  const overlapHeight =
    Math.min(overlayRect.bottom, frameRect.bottom) -
    Math.max(overlayRect.top, frameRect.top);

  if (overlapWidth <= 0 || overlapHeight <= 0) {
    return 0;
  }

  const overlapArea = overlapWidth * overlapHeight;
  const overlayArea = overlayRect.width * overlayRect.height;

  if (overlayArea <= 0) {
    return 0;
  }

  return overlapArea / overlayArea;
}

/** 在 [0,1] 內挑下一個落點。會避開正中央，讓浮水印巡迴四處而非黏在同一區。 */
function nextTarget(previous: NormalizedTarget): NormalizedTarget {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const fx = Math.random();
    const fy = Math.random();
    const movedEnough =
      Math.abs(fx - previous.fx) > 0.28 || Math.abs(fy - previous.fy) > 0.28;
    if (movedEnough) {
      return { fx, fy };
    }
  }
  return { fx: Math.random(), fy: Math.random() };
}

export function VideoWatermarkOverlay({
  watermark,
  containerRef,
  videoFrameRef,
  onTamper,
}: VideoWatermarkOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [timestamp, setTimestamp] = useState(() => new Date());
  const [target, setTarget] = useState<NormalizedTarget>(DEFAULT_TARGET);
  const targetRef = useRef<NormalizedTarget>(DEFAULT_TARGET);
  const [placed, setPlaced] = useState(false);
  const hasPlacedOnceRef = useRef(false);

  const tamperTriggeredRef = useRef(false);
  const invisibleSinceRef = useRef<number | null>(null);
  const protectionArmedRef = useRef(false);
  const overlayPresenceSinceRef = useRef<number | null>(null);

  const enabled = !!watermark?.enabled;
  const movementMode = watermark?.movementMode ?? "STANDARD";
  const isAggressive = movementMode === "AGGRESSIVE";
  const moveIntervalSec = watermark?.moveIntervalSec ?? 12;
  const transitionSec = isAggressive ? 1.4 : 1.8;

  // 每秒更新時間戳
  useEffect(() => {
    if (!enabled || !watermark?.showTimestamp) {
      return;
    }

    const interval = window.setInterval(() => {
      setTimestamp(new Date());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, watermark?.showTimestamp]);

  // 週期性挑選新落點（隨機巡迴，較難被裁切固定區域避開）
  useEffect(() => {
    if (!enabled) {
      setTarget(DEFAULT_TARGET);
      return;
    }

    setTarget((prev) => nextTarget(prev));

    const baseInterval = Math.max(isAggressive ? 5 : 8, moveIntervalSec);
    const interval = window.setInterval(() => {
      setTarget((prev) => nextTarget(prev));
    }, baseInterval * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, isAggressive, moveIntervalSec]);

  // 量測影片方框與容器，把浮水印 clamp 在影片內，直接寫入 DOM transform。
  // animate=true：週期性漂移用平滑過場；false：佈局變化（旋轉/全螢幕/resize）即時貼齊，避免滑過黑邊。
  const measureAndPlace = useCallback(
    (animate = false) => {
      const overlay = overlayRef.current;
      const container = containerRef.current;
      const frame = videoFrameRef?.current ?? containerRef.current;
      if (!overlay || !container || !frame) {
        return;
      }

      const frameRect = frame.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (frameRect.width <= 0 || frameRect.height <= 0) {
        return;
      }

      const pad = Math.max(8, Math.round(frameRect.width * 0.035));
      // 限制浮水印寬度，保證「框 + 留白」一定塞得進影片寬度，且留有移動空間。
      const maxBox = Math.max(
        60,
        Math.min(frameRect.width - pad * 2, Math.round(frameRect.width * 0.72))
      );
      // 先把新的 maxWidth 寫進 DOM，下一行量到的高度才會反映新寬度下的換行，
      // 避免「用新寬度算位置、卻用舊寬度量高度」導致框短暫下移蓋住控制列。
      overlay.style.maxWidth = `${maxBox}px`;

      const overlayRect = overlay.getBoundingClientRect();
      const boxWidth = Math.min(overlayRect.width || maxBox, maxBox);
      const boxHeight = overlayRect.height || 0;

      // 預留底部給控制列，避免長時間蓋住播放控制
      const bottomReserve = Math.round(frameRect.height * 0.06);
      const availW = Math.max(0, frameRect.width - boxWidth - pad * 2);
      const availH = Math.max(
        0,
        frameRect.height - boxHeight - pad * 2 - bottomReserve
      );

      const { fx, fy } = targetRef.current;
      const xInFrame = pad + availW * fx;
      const yInFrame = pad + availH * fy;

      const offsetX = frameRect.left - containerRect.left;
      const offsetY = frameRect.top - containerRect.top;
      const x = Math.round(offsetX + xInFrame);
      const y = Math.round(offsetY + yInFrame);

      // 首次定位一律不過場，避免從 (0,0) 滑入
      const useTransition = animate && hasPlacedOnceRef.current;
      overlay.style.transition = useTransition
        ? `transform ${transitionSec}s ease-in-out`
        : "none";
      overlay.style.transform = `translate3d(${x}px, ${y}px, 0)`;

      hasPlacedOnceRef.current = true;
      setPlaced(true);
    },
    [containerRef, videoFrameRef, transitionSec]
  );

  // 目標改變時平滑漂移到新落點
  useIsomorphicLayoutEffect(() => {
    targetRef.current = target;
    measureAndPlace(true);
  }, [target, measureAndPlace]);

  // 監聽尺寸變化：全螢幕切換、旋轉、視窗縮放、文字行數變化都會觸發重算
  useIsomorphicLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    measureAndPlace(false);

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measureAndPlace(false))
        : null;

    if (observer) {
      if (containerRef.current) observer.observe(containerRef.current);
      if (videoFrameRef?.current) observer.observe(videoFrameRef.current);
      if (overlayRef.current) observer.observe(overlayRef.current);
    }

    const handleViewportChange = () => measureAndPlace(false);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    // 全螢幕進出時容器類別瞬間切換，下一個 frame 再量一次確保命中最終佈局
    const rafId = window.requestAnimationFrame(() => measureAndPlace(false));

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
      window.cancelAnimationFrame(rafId);
    };
  }, [enabled, measureAndPlace, containerRef, videoFrameRef]);

  // 重置防竄改狀態
  useEffect(() => {
    tamperTriggeredRef.current = false;
    invisibleSinceRef.current = null;
    protectionArmedRef.current = false;
    overlayPresenceSinceRef.current = null;
  }, [enabled, watermark?.tamperPauseEnabled]);

  // 防竄改偵測：偵測浮水印被移除/隱藏/推出影片，連續逾時才觸發 onTamper
  useEffect(() => {
    if (!enabled || !watermark?.tamperPauseEnabled) {
      return;
    }

    const logIssue = (payload: WatermarkCheckLog) => {
      console.info("[watermark-check]", {
        ...payload,
        checkedAt: new Date().toISOString(),
      });
    };

    const confirmTamperIfNeeded = (reason: string) => {
      const now = Date.now();

      if (invisibleSinceRef.current === null) {
        invisibleSinceRef.current = now;
        return;
      }

      if (now - invisibleSinceRef.current < TAMPER_GRACE_PERIOD_MS) {
        return;
      }

      tamperTriggeredRef.current = true;
      onTamper?.(reason);
    };

    const resetTamperWindow = () => {
      invisibleSinceRef.current = null;
    };

    const confirmProtectionArmedIfNeeded = () => {
      const now = Date.now();

      if (protectionArmedRef.current) {
        return true;
      }

      if (overlayPresenceSinceRef.current === null) {
        overlayPresenceSinceRef.current = now;
        return false;
      }

      if (now - overlayPresenceSinceRef.current < ARM_GRACE_PERIOD_MS) {
        return false;
      }

      protectionArmedRef.current = true;
      return true;
    };

    const resetProtectionPresence = () => {
      overlayPresenceSinceRef.current = null;
    };

    const checkTamper = () => {
      if (tamperTriggeredRef.current) return;

      const overlay = overlayRef.current;
      const container = containerRef.current;
      const frame = videoFrameRef?.current ?? container;
      const invisibleForMs =
        invisibleSinceRef.current === null
          ? 0
          : Math.max(0, Date.now() - invisibleSinceRef.current);

      if (!overlay || !container || !frame) {
        resetProtectionPresence();
        if (!protectionArmedRef.current) return;
        logIssue({ status: "missing", reason: "overlay_missing", invisibleForMs });
        confirmTamperIfNeeded("overlay_missing");
        return;
      }

      if (!overlay.isConnected || !container.contains(overlay)) {
        resetProtectionPresence();
        if (!protectionArmedRef.current) return;
        logIssue({ status: "detached", reason: "overlay_detached", invisibleForMs });
        confirmTamperIfNeeded("overlay_detached");
        return;
      }

      confirmProtectionArmedIfNeeded();

      const style = window.getComputedStyle(overlay);
      const rect = overlay.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const intersectionRatio = getIntersectionRatio(rect, frameRect);
      // 只攔截「縮到不可見」的惡意 transform；正常的 translate 會是 matrix(1,...)，不誤判
      const hasInvisibleTransform =
        style.transform.includes("matrix(0") ||
        style.transform.includes("scale(0");
      const hasConcealingEffects =
        style.clipPath !== "none" ||
        style.maskImage !== "none" ||
        style.filter.includes("opacity(0") ||
        style.filter.includes("brightness(0") ||
        style.mixBlendMode !== "normal";

      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) < 0.01 ||
        style.contentVisibility === "hidden" ||
        style.clip === "rect(0px, 0px, 0px, 0px)" ||
        Number(style.zIndex) < 20 ||
        rect.width < 16 ||
        rect.height < 8 ||
        intersectionRatio < MIN_VISIBLE_RATIO ||
        hasInvisibleTransform ||
        hasConcealingEffects
      ) {
        if (!protectionArmedRef.current) {
          return;
        }
        logIssue({
          status: "hidden",
          reason: "overlay_hidden",
          invisibleForMs,
          intersectionRatio: Number(intersectionRatio.toFixed(3)),
          opacity: Number(style.opacity),
          zIndex: style.zIndex,
        });
        confirmTamperIfNeeded("overlay_hidden");
        return;
      }

      resetTamperWindow();
    };

    let mutationCheckTimer: number | null = null;
    const scheduleMutationCheck = () => {
      if (mutationCheckTimer !== null) {
        return;
      }

      mutationCheckTimer = window.setTimeout(() => {
        mutationCheckTimer = null;
        checkTamper();
      }, MUTATION_CHECK_DEBOUNCE_MS);
    };

    const observer = new MutationObserver(() => {
      scheduleMutationCheck();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    const interval = window.setInterval(checkTamper, TAMPER_CHECK_INTERVAL_MS);

    return () => {
      observer.disconnect();
      if (mutationCheckTimer !== null) {
        window.clearTimeout(mutationCheckTimer);
      }
      window.clearInterval(interval);
    };
  }, [
    containerRef,
    videoFrameRef,
    onTamper,
    enabled,
    watermark?.tamperPauseEnabled,
  ]);

  if (!enabled || !watermark) {
    return null;
  }

  const lines = buildVideoWatermarkLines(watermark, timestamp);

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none absolute left-0 top-0 z-30 rounded-lg border border-white/10 bg-black/35 px-2.5 py-1.5 text-white shadow-2xl backdrop-blur-sm sm:rounded-xl sm:px-4 sm:py-2"
      style={{
        maxWidth: "72%",
        opacity: placed ? watermark.opacityPercent / 100 : 0,
        willChange: "transform",
      }}
      aria-hidden="true"
    >
      {lines.map((line, index) => (
        <div
          key={`${index}-${line}`}
          className={`${getFontClass(watermark.textSize)} break-words font-medium uppercase leading-tight tracking-[0.1em] text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.45)]`}
        >
          {line}
        </div>
      ))}
    </div>
  );
}
