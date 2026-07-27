/* eslint-disable @next/next/no-img-element */
// components/admin/media/video-card.tsx
// 影片卡片元件
// 顯示影片縮圖、狀態和操作按鈕

"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Play,
  Copy,
  Trash2,
  MoreVertical,
  Clock,
  Calendar,
  CheckCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  syncMediaInfo,
  renameMedia,
  checkMediaUsage,
} from "@/lib/actions/media";
import { cn } from "@/lib/utils";
import { normalizeVideoStatus, needsVideoSync } from "@/lib/video-source";
import type { Media } from "@prisma/client";

interface VideoCardProps {
  video: Media;
  onDelete?: (id: string) => void;
  onSelect?: (video: Media) => void;
  onSync?: (updatedVideo: Media) => void;
  selectable?: boolean;
  selected?: boolean;
  streamCustomerCode?: string;
}

type StreamDeleteMode = "remoteOnly" | "dbOnly" | "both";

const sourceTypeLabels: Record<string, string> = {
  MANUAL: "後台上傳",
  LESSON_CONTENT: "課程內容",
  ASSIGNMENT: "作業附件",
  COMMENT: "留言附件",
  PRIVATE_MESSAGE: "私人訊息",
  CLOUDFLARE_SYNC: "Cloudflare 同步",
};

export function VideoCard({
  video,
  onDelete,
  onSelect,
  onSync,
  selectable = false,
  selected = false,
  streamCustomerCode,
}: VideoCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [deleteMode, setDeleteMode] = useState<StreamDeleteMode>("both");
  const [confirmStreamId, setConfirmStreamId] = useState("");
  const [currentVideo, setCurrentVideo] = useState(video);
  const [usages, setUsages] = useState<
    { lessonTitle: string; chapterTitle: string; courseTitle: string }[]
  >([]);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    setCurrentVideo(video);
    pollCountRef.current = 0;
  }, [video]);

  // 根據 cfStreamId 動態生成縮圖 URL
  const getThumbnailUrl = () => {
    if (currentVideo.cfStreamId && streamCustomerCode) {
      return `https://customer-${streamCustomerCode}.cloudflarestream.com/${currentVideo.cfStreamId}/thumbnails/thumbnail.jpg?height=270`;
    }
    return currentVideo.thumbnail;
  };

  // 格式化時長
  const formatDuration = (seconds: number | null) => {
    if (seconds === null || seconds === undefined || seconds < 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes || bytes <= 0) return "未知大小";
    const units = ["B", "KB", "MB", "GB"];
    const unitIndex = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );
    return `${(bytes / Math.pow(1024, unitIndex)).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const getNormalizedStatus = () =>
    normalizeVideoStatus(currentVideo.bunnyStatus, currentVideo.cfStatus);

  // 同步影片資訊（Bunny 影片查即時狀態 API，Cloudflare 影片走既有 server action）
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      if (currentVideo.bunnyVideoId) {
        const response = await fetch(`/api/admin/media/${currentVideo.id}/status`);
        const data = await response.json();
        if (data.success && data.media) {
          const nextVideo = {
            ...currentVideo,
            duration: data.media.duration ?? currentVideo.duration,
            bunnyStatus: data.media.bunnyStatus || currentVideo.bunnyStatus,
            thumbnail: data.media.thumbnail ?? currentVideo.thumbnail,
            sourceLabel: data.media.sourceLabel ?? currentVideo.sourceLabel,
          };
          setCurrentVideo(nextVideo);
          onSync?.(nextVideo);
          toast.success("影片資訊已同步");
        } else {
          toast.error(data.error || "同步失敗");
        }
        return;
      }

      const result = await syncMediaInfo(currentVideo.id);
      if (result.success && result.media) {
        setCurrentVideo(result.media);
        onSync?.(result.media);
        toast.success("影片資訊已同步");
      } else {
        toast.error(result.error || "同步失敗");
      }
    } catch {
      toast.error("同步時發生錯誤");
    } finally {
      setIsSyncing(false);
    }
  };

  const needsSync = needsVideoSync(currentVideo);

  useEffect(() => {
    if (!needsSync || (!currentVideo.cfStreamId && !currentVideo.bunnyVideoId)) return;

    const maxPolls = 60; // 最多輪詢 60 次（5 分鐘）

    const poll = async () => {
      if (pollCountRef.current >= maxPolls) return;
      pollCountRef.current++;

      try {
        const response = await fetch(`/api/admin/media/${currentVideo.id}/status`);
        const data = await response.json();

        if (data.success && data.media) {
          const nextVideo = {
            ...currentVideo,
            duration: data.media.duration ?? currentVideo.duration,
            cfStatus: data.media.cfStatus || currentVideo.cfStatus,
            bunnyStatus: data.media.bunnyStatus || currentVideo.bunnyStatus,
            thumbnail: data.media.thumbnail ?? currentVideo.thumbnail,
            sourceLabel: data.media.sourceLabel ?? currentVideo.sourceLabel,
          };

          setCurrentVideo((prev) => ({
            ...prev,
            duration: nextVideo.duration,
            cfStatus: nextVideo.cfStatus,
            bunnyStatus: nextVideo.bunnyStatus,
            thumbnail: nextVideo.thumbnail,
            sourceLabel: nextVideo.sourceLabel,
          }));
          onSync?.(nextVideo);

          if (data.media.ready || data.media.cfStatus === "ready" || data.media.bunnyStatus === "ready" || data.media.bunnyStatus === "failed") {
            return; // Cloudflare 已完成處理，停止輪詢
          }
        }
      } catch {
        // 輪詢失敗，靜默繼續
      }

      // 繼續輪詢
      pollTimerRef.current = setTimeout(poll, 5000);
    };

    // 延遲 3 秒後開始第一次輪詢（給影片處理一些時間）
    pollTimerRef.current = setTimeout(poll, 3000);

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [needsSync, currentVideo.cfStreamId, currentVideo.bunnyVideoId, currentVideo.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 格式化日期
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // 取得狀態標籤
  const getStatusBadge = () => {
    switch (getNormalizedStatus()) {
      case "ready":
        return (
          <Badge className="bg-green-50 text-green-600 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            就緒
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-cta/10 text-cta border-cta/30">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            處理中
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-50 text-red-600 border-red-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            錯誤
          </Badge>
        );
      case "deleted":
        return (
          <Badge className="bg-surface text-body border-divider">
            <AlertCircle className="w-3 h-3 mr-1" />
            遠端已刪
          </Badge>
        );
      default:
        return (
          <Badge
            variant="secondary"
            className="bg-surface text-body border-divider"
          >
            未知
          </Badge>
        );
    }
  };

  // 複製 Video ID
  const handleCopyId = () => {
    if (currentVideo.cfStreamId) {
      navigator.clipboard.writeText(currentVideo.cfStreamId);
      toast.success("已複製 Video ID");
    }
  };

  // 點擊刪除按鈕時，先檢查使用情況
  const handleDeleteClick = async () => {
    setConfirmStreamId("");
    setDeleteMode("both");
    setIsCheckingUsage(true);
    try {
      const result = await checkMediaUsage(currentVideo.id);
      if (result.success) {
        setUsages(result.usages ?? []);
      } else {
        setUsages([]);
      }
    } catch {
      setUsages([]);
    } finally {
      setIsCheckingUsage(false);
      setShowDeleteDialog(true);
    }
  };

  // 刪除影片
  const handleDelete = async () => {
    if (currentVideo.bunnyVideoId) {
      if (confirmStreamId !== currentVideo.bunnyVideoId) {
        toast.error("請輸入完整 Bunny Video ID 以確認刪除");
        return;
      }

      setIsDeleting(true);
      try {
        const response = await fetch(
          `/api/admin/media/${currentVideo.id}/delete-bunny-stream`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirmBunnyVideoId: currentVideo.bunnyVideoId }),
          }
        );
        const result = await response.json();
        if (!result.success) {
          toast.error(result.error || "刪除失敗");
          return;
        }
        toast.success("Bunny 影片與本地記錄已刪除");
        onDelete?.(currentVideo.id);
        setShowDeleteDialog(false);
      } catch {
        toast.error("刪除時發生錯誤");
      } finally {
        setIsDeleting(false);
      }
      return;
    }

    if (!currentVideo.cfStreamId) {
      toast.error("此影片沒有 Cloudflare Stream ID，無法使用此刪除流程");
      return;
    }
    if (confirmStreamId !== currentVideo.cfStreamId) {
      toast.error("請輸入完整 Cloudflare Stream ID 以確認刪除");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/media/${currentVideo.id}/delete-stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: deleteMode,
            confirmCfStreamId: currentVideo.cfStreamId,
          }),
        }
      );
      const result = await response.json();
      if (result.success) {
        if (deleteMode === "remoteOnly") {
          const updatedVideo = {
            ...currentVideo,
            cfStatus: "deleted",
            sourceLabel: "Cloudflare 遠端影片已刪除，本地記錄保留",
          };
          setCurrentVideo(updatedVideo);
          onSync?.(updatedVideo);
          toast.success("已刪除 Cloudflare 遠端影片，本地記錄已保留");
        } else {
          toast.success(
            deleteMode === "dbOnly"
              ? "已刪除本地媒體記錄，Cloudflare 遠端影片未刪除"
              : "影片與 Cloudflare 遠端檔案已刪除"
          );
          onDelete?.(currentVideo.id);
        }
        setShowDeleteDialog(false);
      } else {
        toast.error(result.error || "刪除失敗");
      }
    } catch {
      toast.error("刪除時發生錯誤");
    } finally {
      setIsDeleting(false);
    }
  };

  // 重新命名影片
  const handleRename = async () => {
    if (!renameName.trim()) return;
    setIsRenaming(true);
    try {
      const result = await renameMedia(currentVideo.id, renameName.trim());
      if (result.success && result.media) {
        setCurrentVideo(result.media);
        toast.success("影片已重新命名");
        setShowRenameDialog(false);
      } else {
        toast.error(result.error || "重新命名失敗");
      }
    } catch {
      toast.error("重新命名時發生錯誤");
    } finally {
      setIsRenaming(false);
    }
  };

  // 處理點擊（選擇模式）
  const handleClick = () => {
    if (selectable) {
      onSelect?.(video);
    }
  };

  return (
    <>
      <Card
        className={cn(
          "overflow-hidden bg-white border-divider rounded-xl transition-all",
          selectable && "cursor-pointer hover:border-cta",
          selected && "ring-2 ring-cta border-cta"
        )}
        onClick={handleClick}
      >
        {/* 縮圖 */}
        <div className="aspect-video relative bg-surface">
          {getThumbnailUrl() ? (
            <img
              src={getThumbnailUrl()!}
              alt={currentVideo.originalName}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Play className="w-12 h-12 text-caption" />
            </div>
          )}

          {/* 狀態標籤 */}
          <div className="absolute top-2 left-2">{getStatusBadge()}</div>

          {/* 時長 */}
          {currentVideo.duration && currentVideo.duration > 0 && (
            <div className="absolute bottom-2 right-2 bg-heading/70 rounded-lg px-2 py-1">
              <span className="text-white text-xs font-medium">
                {formatDuration(currentVideo.duration)}
              </span>
            </div>
          )}

          {/* 同步按鈕（當需要同步時顯示） */}
          {needsSync && !selectable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleSync();
              }}
              disabled={isSyncing}
              className="absolute bottom-2 left-2 bg-heading/70 hover:bg-heading/90 text-white text-xs h-7 px-2 rounded-lg"
            >
              {isSyncing ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              同步
            </Button>
          )}

          {/* 選中標記 */}
          {selectable && selected && (
            <div className="absolute top-2 right-2">
              <div className="w-6 h-6 rounded-full bg-cta flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* 資訊 */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-heading font-medium truncate">
                {currentVideo.originalName}
              </h3>
              <div className="flex items-center gap-4 mt-2 text-caption text-sm">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(currentVideo.duration)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(currentVideo.createdAt)}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-xs text-caption">
                <div className="flex items-center justify-between gap-2">
                  <span>大小</span>
                  <span className="font-medium text-body">
                    {formatFileSize(currentVideo.size)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>來源</span>
                  <span className="font-medium text-body">
                    {sourceTypeLabels[currentVideo.sourceType] ??
                      currentVideo.sourceType}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>狀態</span>
                  <span className="font-medium text-body">
                    {currentVideo.bunnyStatus || currentVideo.cfStatus || "unknown"}
                  </span>
                </div>
                {currentVideo.sourceLabel && (
                  <p className="line-clamp-2 rounded-md bg-surface px-2 py-1 text-caption">
                    {currentVideo.sourceLabel}
                  </p>
                )}
              </div>
            </div>

            {/* 操作選單 */}
            {!selectable && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-body hover:text-heading hover:bg-surface"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-white border-divider rounded-lg"
                >
                  <DropdownMenuItem
                    onClick={() => {
                      setRenameName(currentVideo.originalName);
                      setShowRenameDialog(true);
                    }}
                    className="text-body hover:text-heading hover:bg-surface"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    重新命名
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleCopyId}
                    className="text-body hover:text-heading hover:bg-surface"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    複製 Video ID
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="text-body hover:text-heading hover:bg-surface"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {isSyncing ? "同步中..." : "查看狀態 / 重新同步"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600 hover:bg-red-50"
                    onClick={handleDeleteClick}
                    disabled={isCheckingUsage}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isCheckingUsage ? "檢查中..." : "刪除影片"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </Card>

      {/* 重新命名對話框 */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="bg-white border-divider rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-heading">重新命名影片</DialogTitle>
            <DialogDescription className="text-body">
              輸入新的影片名稱
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            placeholder="輸入影片名稱"
            className="bg-white border-divider text-heading placeholder:text-caption"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              disabled={isRenaming}
              className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
            >
              取消
            </Button>
            <Button
              onClick={handleRename}
              disabled={isRenaming || !renameName.trim()}
              className="bg-cta hover:bg-cta-hover text-white rounded-lg"
            >
              {isRenaming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  儲存中...
                </>
              ) : (
                "確認"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-white border-divider rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-heading">確認刪除影片</DialogTitle>
            <DialogDescription className="text-body">
              {currentVideo.bunnyVideoId
                ? "刪除 Bunny 遠端影片會同時刪除本地媒體記錄。"
                : "請選擇刪除範圍。刪除 Cloudflare 遠端影片會影響所有使用同一個 Stream ID 的課程單元。"}
            </DialogDescription>
          </DialogHeader>
          {!currentVideo.bunnyVideoId && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="mr-1 inline h-4 w-4 -mt-0.5" />
            這裡連到正式 Cloudflare Stream 資料。請確認這是你要刪除的單支影片，系統不會批次刪除遠端影片。
          </div>}

          {!currentVideo.bunnyVideoId && <div className="space-y-3">
            <Label className="text-heading">刪除範圍</Label>
            <div className="grid gap-2">
              {[
                {
                  value: "both" as const,
                  title: "刪除 Cloudflare 遠端影片與本地記錄",
                  description: "最完整的刪除；若 Cloudflare 刪除失敗，本地記錄不會被刪除。",
                },
                {
                  value: "remoteOnly" as const,
                  title: "只刪除 Cloudflare 遠端影片",
                  description: "保留本地記錄並標示遠端已刪，適合先處理遠端空間。",
                },
                {
                  value: "dbOnly" as const,
                  title: "只刪除本地記錄",
                  description: "不碰 Cloudflare 遠端影片，適合同步錯亂或本地重建索引。",
                },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDeleteMode(option.value)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    deleteMode === option.value
                      ? "border-cta bg-cta/10"
                      : "border-divider bg-white hover:bg-surface"
                  )}
                >
                  <span className="block text-sm font-medium text-heading">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-xs text-caption">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </div>}

          <div className="space-y-2">
            <Label htmlFor={`confirm-${currentVideo.id}`} className="text-heading">
              輸入 {currentVideo.bunnyVideoId ? "Bunny Video ID" : "Cloudflare Stream ID"} 確認
            </Label>
            <Input
              id={`confirm-${currentVideo.id}`}
              value={confirmStreamId}
              onChange={(event) => setConfirmStreamId(event.target.value)}
              placeholder={currentVideo.bunnyVideoId || currentVideo.cfStreamId || "此影片沒有 Stream ID"}
              className="bg-white border-divider text-heading placeholder:text-caption"
            />
            <p className="break-all text-xs text-caption">
              需要完全相符：{currentVideo.bunnyVideoId || currentVideo.cfStreamId || "無影片 ID"}
            </p>
          </div>

          {usages.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-medium text-amber-800">
                <AlertCircle className="w-4 h-4 inline mr-1 -mt-0.5" />
                此影片正被 {usages.length} 個單元使用中
              </p>
              <ul className="text-xs text-amber-700 space-y-1 ml-5 list-disc">
                {usages.map((u, i) => (
                  <li key={i}>
                    {u.courseTitle} &gt; {u.chapterTitle} &gt; {u.lessonTitle}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-600">
                刪除後，這些單元的影片將無法播放。
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="border-divider text-body hover:bg-surface hover:text-heading rounded-lg"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                isDeleting ||
                !(currentVideo.bunnyVideoId || currentVideo.cfStreamId) ||
                confirmStreamId !== (currentVideo.bunnyVideoId || currentVideo.cfStreamId)
              }
              className="rounded-lg"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  刪除中...
                </>
              ) : (
                deleteMode === "dbOnly" ? "確認刪除本地記錄" : "確認刪除"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
