// components/shared/logo.tsx
// 網站 Logo 元件
// 極簡黑白灰設計

'use client'

import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePublicSiteSettings } from "@/hooks/use-public-site-settings";
import { DEFAULT_SITE_ICON_PATH } from "@/lib/site-brand-assets";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  siteLogo?: string;
  brandDisplayName?: string;
  brandSubtitle?: string;
}

export function Logo({
  className,
  size = "md",
  siteLogo: siteLogoProp,
  brandDisplayName: brandDisplayNameProp,
  brandSubtitle: brandSubtitleProp,
}: LogoProps) {
  const settings = usePublicSiteSettings()
  const siteLogo = siteLogoProp || settings.siteLogo
  const brandDisplayName = brandDisplayNameProp || settings.brandDisplayName
  const brandSubtitle = brandSubtitleProp || settings.brandSubtitle

  const sizeConfig = {
    sm: { image: 24, text: "text-sm" },
    md: { image: 32, text: "text-base" },
    lg: { image: 40, text: "text-lg" },
  };

  const config = sizeConfig[size];

  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 transition-opacity hover:opacity-80",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={siteLogo || DEFAULT_SITE_ICON_PATH}
        alt={brandDisplayName || 'Brand'}
        width={config.image}
        height={config.image}
        className="rounded-full overflow-hidden"
      />
      <div className={cn("flex flex-col leading-tight", config.text)}>
        <span className="font-bold text-sm text-neutral-700">{brandDisplayName}</span>
        <span className="font-bold text-sm text-neutral-700">{brandSubtitle}</span>
      </div>
    </Link>
  );
}
