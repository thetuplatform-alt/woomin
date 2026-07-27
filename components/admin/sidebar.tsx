// components/admin/sidebar.tsx
// 後台側邊導覽列元件
// 支援折疊模式與 hover 展開功能，含深色模式切換按鈕

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/lib/contexts/sidebar-context";
import { useAdminTheme } from "@/lib/contexts/admin-theme-context";
import { getUnreadPrivateMessageCountForAdmin } from "@/lib/actions/private-messages-admin";
import { ADMIN_PRIVATE_MESSAGE_UNREAD_CHANGED_EVENT } from "@/lib/private-message-events";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  BookOpen,
  Image as ImageIcon,
  Users,
  GraduationCap,
  ShoppingCart,
  CreditCard,
  Package,
  Ticket,
  Repeat,
  BarChart3,
  Settings,
  MessageCircle,
  Mail,
  Shield,
  FileText,
  Sun,
  Moon,
  ArrowLeft,
  LogOut,
  User,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// 側邊欄導覽項目（依功能分組）
// 第一組 label 為 null：儀表板維持在最上方、不顯示分組標題
const sidebarGroups = [
  {
    label: null,
    items: [
      { title: "儀表板", href: "/admin", icon: LayoutDashboard, adminOnly: false },
    ],
  },
  {
    label: "課程內容",
    items: [
      { title: "課程管理", href: "/admin/courses", icon: BookOpen, adminOnly: false },
      { title: "課程組合包", href: "/admin/bundles", icon: Package, adminOnly: true },
      { title: "媒體中心", href: "/admin/media", icon: ImageIcon, adminOnly: false },
    ],
  },
  {
    label: "學員與互動",
    items: [
      { title: "學員管理", href: "/admin/users", icon: Users, adminOnly: false },
      { title: "課程留言", href: "/admin/comments", icon: MessageCircle, adminOnly: false },
      { title: "老師私訊", href: "/admin/messages", icon: Mail, adminOnly: false },
    ],
  },
  {
    label: "銷售與金流",
    items: [
      { title: "訂單管理", href: "/admin/orders", icon: ShoppingCart, adminOnly: false },
      { title: "訂閱管理", href: "/admin/subscriptions", icon: Repeat, adminOnly: true },
      { title: "優惠券", href: "/admin/coupons", icon: Ticket, adminOnly: false },
      { title: "電子報", href: "/admin/newsletters", icon: Mail, adminOnly: false },
      { title: "銷售分析", href: "/admin/analytics", icon: BarChart3, adminOnly: true },
      { title: "金流收款", href: "/admin/payments", icon: CreditCard, adminOnly: true },
    ],
  },
  {
    label: "系統與法律",
    items: [
      { title: "講師管理", href: "/admin/instructors", icon: GraduationCap, adminOnly: true },
      { title: "一般設定", href: "/admin/settings", icon: Settings, adminOnly: true },
      { title: "隱私權政策", href: "/admin/privacy", icon: Shield, adminOnly: true },
      { title: "服務條款", href: "/admin/terms", icon: FileText, adminOnly: true },
    ],
  },
];

// 攤平後的扁平清單（給行動版等需要單層結構的地方使用）
const sidebarItems = sidebarGroups.flatMap((group) => group.items);

interface SidebarProps {
  className?: string;
  userRole?: string;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
}

export function Sidebar({ className, userRole, user }: SidebarProps) {
  const pathname = usePathname();
  const { isCollapsed, isHoverExpanded, setHoverExpanded } = useSidebar();
  const { theme, toggleTheme } = useAdminTheme();
  const [mounted, setMounted] = useState(false);

  // 帳號頭像備用首字母
  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ??
    user?.email?.[0]?.toUpperCase() ??
    "U";
  const roleText = user?.role === "ADMIN" ? "管理員" : "編輯者";

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.assign("/login");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // 老師私訊未讀總數（學員傳來、老師未讀），用於側邊欄徽章
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const refreshUnreadMessages = () => {
      getUnreadPrivateMessageCountForAdmin()
        .then((count) => {
          if (!cancelled) setUnreadMessages(count);
        })
        .catch(() => undefined);
    };

    refreshUnreadMessages();
    window.addEventListener(
      ADMIN_PRIVATE_MESSAGE_UNREAD_CHANGED_EVENT,
      refreshUnreadMessages
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        ADMIN_PRIVATE_MESSAGE_UNREAD_CHANGED_EVENT,
        refreshUnreadMessages
      );
    };
    // pathname 變更與私訊已讀事件都會重新計算，避免側邊欄徽章卡住
  }, [pathname]);

  // 計算實際顯示狀態：折疊且未 hover 時才真正折疊
  const isActuallyCollapsed = isCollapsed && !isHoverExpanded;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        data-platform-version="1.7.3"
        className={cn(
          "relative flex flex-col bg-[var(--admin-shell)] transition-all duration-300 ease-in-out",
          isActuallyCollapsed ? "w-16" : "w-64",
          className
        )}
        onMouseEnter={() => {
          if (isCollapsed) {
            setHoverExpanded(true);
          }
        }}
        onMouseLeave={() => {
          if (isCollapsed) {
            setHoverExpanded(false);
          }
        }}
      >
        {/* Hover 展開時的 overlay 背景 */}
        {isCollapsed && isHoverExpanded && (
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setHoverExpanded(false)}
          />
        )}

        {/* Sidebar 內容 - hover 時使用 fixed positioning */}
        <div
          className={cn(
            "flex flex-col h-full bg-[var(--admin-shell)]",
            isCollapsed && isHoverExpanded
              ? "fixed left-0 top-0 w-64 z-50 shadow-xl"
              : ""
          )}
        >
          {/* 標題：icon + 線上課程後台（無下框線，貼近選單） */}
          <div
            className={cn(
              "flex items-center py-2 transition-all duration-300",
              isActuallyCollapsed ? "px-3 justify-center" : "px-4"
            )}
          >
            <div
              className={cn(
                "flex items-center",
                isActuallyCollapsed ? "justify-center" : "gap-3 px-1 pt-2"
              )}
            >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl">
                <Image
                  src="/icon-nobackground.png"
                  alt="Logo"
                  width={28}
                  height={28}
                  className="h-full w-full object-cover"
                />
              </span>
              <span
                className={cn(
                  "font-semibold text-foreground transition-all duration-300 whitespace-nowrap",
                  isActuallyCollapsed
                    ? "opacity-0 w-0 overflow-hidden"
                    : "opacity-70"
                )}
              >
                WooMin
              </span>
            </div>
          </div>

          {/* 導覽選單（依分組渲染） */}
          <nav className="flex-1 px-3 pt-2 pb-4 space-y-1 overflow-y-auto scrollbar-hide">
            {sidebarGroups.map((group, groupIndex) => {
              const visibleItems = group.items.filter(
                (item) => !item.adminOnly || userRole === "ADMIN"
              );

              // 整組項目都被權限濾掉時，連分組標題一起隱藏
              if (visibleItems.length === 0) return null;

              return (
                <div
                  key={group.label ?? `group-${groupIndex}`}
                  className="space-y-1"
                >
                  {/* 分組標題：展開時顯示文字小標，折疊成 icon 列時改為分隔線 */}
                  {group.label &&
                    (isActuallyCollapsed ? (
                      <div className="mx-auto my-2 h-px w-8 bg-border" />
                    ) : (
                      <p className="px-3 pb-1 pt-3 text-[11px] font-medium tracking-wide text-muted-foreground/70">
                        {group.label}
                      </p>
                    ))}

                  {visibleItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/admin" &&
                        pathname.startsWith(item.href));

                    // 「老師私訊」顯示未讀徽章
                    const unreadBadge =
                      item.href === "/admin/messages" ? unreadMessages : 0;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200",
                          isActuallyCollapsed
                            ? "px-2.5 py-2.5 justify-center"
                            : "px-3 py-1.5",
                          isActive
                            ? "admin-nav-active font-semibold"
                            : "text-muted-foreground/80 hover:bg-secondary/60 hover:text-foreground"
                        )}
                      >
                        <span className="relative flex-shrink-0">
                          <item.icon className="h-5 w-5" />
                          {/* 折疊時以小紅點表示有未讀 */}
                          {unreadBadge > 0 && isActuallyCollapsed && (
                            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[var(--admin-shell)]" />
                          )}
                        </span>
                        {!isActuallyCollapsed && (
                          <span className="flex flex-1 items-center justify-between gap-2 whitespace-nowrap overflow-hidden">
                            <span>{item.title}</span>
                            {unreadBadge > 0 && (
                              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {unreadBadge > 99 ? "99+" : unreadBadge}
                              </span>
                            )}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* 底部：頭像（帳號）/ 返回前台 / 深色切換 */}
          <div
            className={cn(
              "py-3 transition-all duration-300",
              isActuallyCollapsed ? "px-2" : "px-3"
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2",
                isActuallyCollapsed && "flex-col"
              )}
            >
              {/* 頭像 + 下拉（個人資料 / 登出） */}
              {mounted ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex-shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="帳號"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage
                          src={user?.image ?? undefined}
                          alt={user?.name ?? ""}
                        />
                        <AvatarFallback className="bg-secondary text-muted-foreground border border-border text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="start"
                    className="w-56 bg-card border-border rounded-xl"
                  >
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {user?.name ?? "用戶"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user?.email}
                        </p>
                        <p className="text-xs text-primary">{roleText}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem className="text-muted-foreground focus:bg-secondary focus:text-foreground cursor-pointer rounded-lg">
                      <User className="mr-2 h-4 w-4" />
                      <span>個人資料</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem
                      onClick={() => void handleSignOut()}
                      className="text-destructive focus:bg-secondary focus:text-destructive cursor-pointer rounded-lg"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>登出</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="flex-shrink-0 rounded-full">
                  <button
                    className="flex-shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="帳號"
                    type="button"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage
                        src={user?.image ?? undefined}
                        alt={user?.name ?? ""}
                      />
                      <AvatarFallback className="bg-secondary text-muted-foreground border border-border text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </span>
              )}

              {/* 返回前台（佔滿中間） */}
              {!isActuallyCollapsed && (
                <Link
                  href="/"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回前台
                </Link>
              )}

              {/* 深色模式切換 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleTheme}
                    className="flex-shrink-0 p-2.5 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    aria-label={
                      theme === "light" ? "切換至深色模式" : "切換至淺色模式"
                    }
                  >
                    {theme === "light" ? (
                      <Moon className="h-4 w-4" />
                    ) : (
                      <Sun className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {theme === "light" ? "深色模式" : "淺色模式"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

export { sidebarItems, sidebarGroups };
