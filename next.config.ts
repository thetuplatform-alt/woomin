import type { NextConfig } from "next";

// 從 S3_PUBLIC_URL 或 CLOUDFLARE_R2_PUBLIC_URL 動態產生 remotePatterns
function getStorageRemotePatterns() {
  const publicUrl =
    process.env.S3_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL;
  if (!publicUrl) return [];

  try {
    const url = new URL(publicUrl);
    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        pathname: "/**",
      },
    ];
  } catch {
    return [];
  }
}

// Server Actions origin check：Next.js 會驗證 origin header 是否符合已知 host。
// Zeabur ingress 不轉送 host，導致 Next.js 認為自己在 0.0.0.0:8080，
// 從反代進來的 aiver.me origin 就會被拒絕（Invalid Server Actions request）。
// 明確加入允許的 origin 來解決。
function getAllowedOrigins(): string[] {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return [];
  try {
    const { hostname } = new URL(appUrl);
    return [hostname];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: getAllowedOrigins(),
    },
  },
  // 臺灣電子發票 SDK 為 server-only（使用 node:crypto），標為 external 避免打包進前端
  serverExternalPackages: [
    "@paid-tw/einvoice",
    "@paid-tw/einvoice-ecpay",
    "@paid-tw/einvoice-ezpay",
  ],
  images: {
    remotePatterns: [
      ...getStorageRemotePatterns(),
      {
        protocol: "https",
        hostname: "customer-xxx.cloudflarestream.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/vi/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/icon.svg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  // PostHog reverse proxy rewrites to avoid ad blockers
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
