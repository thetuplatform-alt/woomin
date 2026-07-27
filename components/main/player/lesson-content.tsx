/* eslint-disable @typescript-eslint/no-explicit-any */
// components/main/player/lesson-content.tsx
// 單元內容元件

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight, Download, ExternalLink, Maximize2, X } from "lucide-react";
import type { AdjacentLessons } from "@/lib/actions/lesson";
import { Streamdown } from "streamdown";
import React from "react";

/**
 * 遞迴取得 React Node 中的純文字內容
 */
const getTextContent = (node: any): string => {
  if (!node) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (node.props?.children) return getTextContent(node.props.children);
  return "";
};

/**
 * 統一的 Slugify 邏輯
 */
const slugify = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
};

interface LessonContentProps {
  lessonId: string;
  content: string | null;
  adjacentLessons: AdjacentLessons;
  courseSlug: string;
  onTimestampClick?: (seconds: number) => void;
  onComplete?: () => void;
}

type ContentSegment =
  | { type: "markdown"; content: string }
  | {
      type: "pdf";
      url: string;
      title: string;
      watermark: boolean;
      mediaId?: string;
    };

function parsePdfMeta(meta: string) {
  const values: Record<string, string> = {};
  for (const line of meta.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) values[key] = value;
  }

  if (!values.url) return null;

  return {
    url: values.url,
    title: values.title || "PDF 講義",
    watermark: values.watermark !== "false",
    mediaId: values.mediaId || values.id || undefined,
  };
}

function splitContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const pattern = /:::pdf\s*\n([\s\S]*?)\n:::/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "markdown",
        content: content.slice(lastIndex, match.index),
      });
    }

    const pdf = parsePdfMeta(match[1] ?? "");
    if (pdf) {
      segments.push({ type: "pdf", ...pdf });
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "markdown", content: content.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "markdown", content }];
}

function PdfEmbed({
  lessonId,
  url,
  title,
  watermark,
  mediaId,
}: {
  lessonId: string;
  url: string;
  title: string;
  watermark: boolean;
  mediaId?: string;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [pdfState, setPdfState] = React.useState<{
    loading: boolean;
    error: string | null;
    allowDownload: boolean;
    dynamicWatermarkEnabled: boolean;
  }>({
    loading: true,
    error: null,
    allowDownload: false,
    dynamicWatermarkEnabled: false,
  });

  const protectedPdfUrl = React.useMemo(() => {
    const params = new URLSearchParams({ lessonId });
    if (mediaId) {
      params.set("mediaId", mediaId);
    } else {
      params.set("url", url);
    }
    return `/api/lesson/pdf?${params.toString()}`;
  }, [lessonId, mediaId, url]);

  const inlineUrl = `${protectedPdfUrl}&inline=1`;
  const downloadUrl = `${protectedPdfUrl}&download=1`;

  React.useEffect(() => {
    if (!isExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadMetadata() {
      setPdfState((current) => ({ ...current, loading: true, error: null }));
      try {
        const response = await fetch(`${protectedPdfUrl}&metadata=1`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (cancelled) return;

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || "PDF 講義目前無法載入");
        }

        setPdfState({
          loading: false,
          error: null,
          allowDownload: Boolean(payload.media?.allowDownload),
          dynamicWatermarkEnabled: Boolean(payload.media?.dynamicWatermarkEnabled),
        });
      } catch (error) {
        if (cancelled) return;
        setPdfState({
          loading: false,
          error: error instanceof Error ? error.message : "PDF 講義目前無法載入",
          allowDownload: false,
          dynamicWatermarkEnabled: false,
        });
      }
    }

    void loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [protectedPdfUrl]);

  const pdfFrame = (
    <iframe
      src={inlineUrl}
      title={title}
      className="h-full w-full border-0"
    />
  );

  return (
    <section className="my-10 not-prose overflow-hidden rounded-lg border border-divider bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-heading">{title}</p>
          <p className="text-xs text-caption">
            PDF 講義 ·{" "}
            {pdfState.dynamicWatermarkEnabled
              ? "動態學員浮水印"
              : watermark
                ? "已後製浮水印"
                : "受保護閱讀"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-divider text-xs"
            disabled={pdfState.loading || Boolean(pdfState.error)}
            onClick={() => setIsExpanded(true)}
          >
            <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
            全螢幕
          </Button>
          {pdfState.allowDownload && !pdfState.error && (
            <>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-divider text-xs"
              >
                <a href={inlineUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  新分頁
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-divider text-xs"
              >
                <a href={downloadUrl}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  下載
                </a>
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="relative h-[78vh] min-h-[620px] bg-surface">
        {pdfState.loading ? (
          <div className="flex h-full items-center justify-center text-sm text-caption">
            載入 PDF 權限中...
          </div>
        ) : pdfState.error ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-caption">
            {pdfState.error}
          </div>
        ) : (
          pdfFrame
        )}
      </div>

      {isExpanded && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-white">
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-divider px-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-heading">
                {title}
              </p>
              <p className="text-xs text-caption">
                PDF 講義 ·{" "}
                {pdfState.dynamicWatermarkEnabled
                  ? "動態學員浮水印"
                  : watermark
                    ? "已後製浮水印"
                    : "受保護閱讀"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {pdfState.allowDownload && (
                <>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full border-divider text-xs"
                  >
                    <a href={inlineUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      新分頁
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full border-divider text-xs"
                  >
                    <a href={downloadUrl}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      下載
                    </a>
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-divider text-xs"
                onClick={() => setIsExpanded(false)}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                關閉
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 bg-surface">{pdfFrame}</div>
        </div>
      )}
    </section>
  );
}

export function LessonContent({
  lessonId,
  content,
  adjacentLessons,
  courseSlug,
  onTimestampClick,
  onComplete,
}: LessonContentProps) {
  // 沒有內容時顯示提示
  if (!content) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-[#EBEBF5]/60">此單元尚無文字內容</p>
      </div>
    );
  }

  const segments = splitContent(content);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 lg:px-8">
      <article className="prose prose-neutral max-w-none prose-headings:text-heading prose-h1:text-4xl prose-h1:font-bold prose-h2:text-2xl prose-h2:font-bold prose-h2:border-b prose-h2:border-divider prose-h2:pb-4 prose-h3:text-xl prose-h3:font-semibold prose-p:text-body prose-p:leading-relaxed prose-a:text-cta prose-a:no-underline hover:prose-a:underline prose-strong:text-heading prose-code:text-cta prose-code:bg-surface-hover prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-surface prose-pre:border prose-pre:border-divider prose-blockquote:border-l-cta prose-blockquote:text-body/80 prose-li:text-body prose-li:marker:text-caption prose-hr:border-divider prose-img:rounded-2xl prose-table:text-body prose-th:text-heading prose-th:border-divider prose-td:border-divider">
        {segments.map((segment, index) => {
          if (segment.type === "pdf") {
            return <PdfEmbed key={index} lessonId={lessonId} {...segment} />;
          }

          return (
            <Streamdown
              key={index}
              components={{
                a({ href, children }) {
                  if (href?.startsWith("#t=")) {
                    const seconds = parseInt(href.replace("#t=", ""), 10);
                    if (!isNaN(seconds)) {
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            onTimestampClick?.(seconds);
                          }}
                          className="inline-flex mx-2 items-center gap-0.5 rounded-full border-2 border-solid border-neutral-700 px-2.5 py-0.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-[#2A2A2A] hover:text-white cursor-pointer"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          <span>{children}</span>
                        </button>
                      );
                    }
                  }
                  if (href?.startsWith("http")) {
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    );
                  }
                  return <a href={href}>{children}</a>;
                },
                h1({ children }) {
                  const text = getTextContent(children);
                  const id = slugify(text);
                  return <h1 id={id}>{children}</h1>;
                },
                h2({ children }) {
                  const text = getTextContent(children);
                  const id = slugify(text);
                  return <h2 id={id}>{children}</h2>;
                },
                h3({ children }) {
                  const text = getTextContent(children);
                  const id = slugify(text);
                  return <h3 id={id}>{children}</h3>;
                },
              }}
            >
              {segment.content}
            </Streamdown>
          );
        })}
      </article>

      {/* 底部導覽：完成並前往下一章節 */}
      {adjacentLessons.next && (
        <div className="mt-16 border-t border-divider pt-12">
          <Link
            href={`/courses/${courseSlug}/lessons/${adjacentLessons.next.id}`}
            onClick={() => onComplete?.()}
          >
            <Button
              size="lg"
              className="w-full rounded-full bg-cta py-8 text-lg font-bold text-white shadow-lg shadow-cta/10 transition-all hover:bg-cta-hover hover:scale-[1.01]"
            >
              <span>完成並前往下一章節：{adjacentLessons.next.title}</span>
              <ChevronRight className="ml-2 h-6 w-6" />
            </Button>
          </Link>
        </div>
      )}

      {/* 課程完成提示 */}
      {!adjacentLessons.next && (
        <div className="mt-16 rounded-2xl border-2 border-cta bg-white p-12 text-center shadow-xl shadow-cta/5">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#FEF3C7]">
            <ChevronRight className="h-10 w-10 rotate-[-90deg] text-cta" />
          </div>
          <h3 className="text-2xl font-bold text-heading">
            恭喜完成本課程！
          </h3>
          <p className="mt-4 text-lg text-body">
            你已經完成了所有的單元內容，太棒了！
          </p>
          <Link href={`/courses/${courseSlug}`}>
            <Button className="mt-8 rounded-full border-divider bg-transparent border px-10 py-6 text-heading hover:bg-surface">
              返回課程總覽
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
