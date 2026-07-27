// types/next-auth.d.ts
// 擴展 NextAuth 型別定義
// 加入自訂的 id 和 role 欄位

import { UserRole } from '@prisma/client'
import type { DefaultSession, DefaultUser } from 'next-auth'
import type { DefaultJWT } from 'next-auth/jwt'

// 擴展 next-auth 模組型別
declare module 'next-auth' {
  /**
   * 擴展 Session 型別
   * 在 session.user 中加入 id 和 role
   */
  interface Session {
    user: {
      id: string
      role: UserRole
    } & DefaultSession['user']
  }

  /**
   * 擴展 User 型別
   * 加入 role 欄位
   */
  interface User extends DefaultUser {
    role: UserRole
  }
}

// 擴展 JWT 型別
declare module 'next-auth/jwt' {
  /**
   * 擴展 JWT 型別
   * 在 token 中加入 id 和 role
   */
  interface JWT extends DefaultJWT {
    id: string
    role: UserRole
  }
}
