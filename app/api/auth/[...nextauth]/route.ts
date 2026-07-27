// app/api/auth/[...nextauth]/route.ts
// NextAuth API Route
// 處理所有認證相關的 API 請求

import { handlers } from '@/lib/auth'
import { patchHost } from '@/lib/auth-route-host'
import { NextRequest } from 'next/server'

const { GET: _GET, POST: _POST } = handlers

export const GET = (req: NextRequest) => _GET(patchHost(req))
export const POST = (req: NextRequest) => _POST(patchHost(req))
