'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { BookOpen, ChevronDown, CreditCard, LayoutDashboard, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { isAdminOrInstructorRole } from '@/lib/admin-roles'
import styles from './bestappstore-member-menu.module.css'

export type BestAppStoreHeaderUser = {
  name?: string | null
  email?: string | null
  image?: string | null
  role?: string | null
}

type BestAppStoreMemberMenuProps = {
  compact?: boolean
  user: BestAppStoreHeaderUser | null
}

function getInitials(user: BestAppStoreHeaderUser) {
  const source = user.name?.trim() || user.email?.trim() || '會員'
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length > 1) {
    return `${Array.from(parts[0])[0] ?? ''}${Array.from(parts.at(-1) ?? '')[0] ?? ''}`.toUpperCase()
  }

  return Array.from(source).slice(0, 2).join('').toUpperCase()
}

function MemberAvatar({ user }: { user: BestAppStoreHeaderUser }) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" src={user.image} />
      ) : (
        getInitials(user)
      )}
    </span>
  )
}

export function BestAppStoreMemberMenu({ compact = false, user }: BestAppStoreMemberMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!detailsRef.current?.contains(event.target as Node)) {
        detailsRef.current?.removeAttribute('open')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  if (!user) {
    return (
      <Link className={`${styles.loginLink} ${compact ? styles.compactLogin : ''}`} href="/login">
        會員登入
      </Link>
    )
  }

  const closeMenu = () => detailsRef.current?.removeAttribute('open')
  const displayName = user.name?.trim() || user.email?.split('@')[0] || '我的帳戶'
  const canManage = isAdminOrInstructorRole(user.role)

  const handleSignOut = async () => {
    closeMenu()
    await signOut({ redirect: false })
    window.location.assign('/')
  }

  return (
    <details
      className={`${styles.memberMenu} ${compact ? styles.compact : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          closeMenu()
          detailsRef.current?.querySelector<HTMLElement>('summary')?.focus()
        }
      }}
      ref={detailsRef}
    >
      <summary className={styles.memberTrigger} aria-label="開啟會員選單">
        <MemberAvatar user={user} />
        <span className={styles.memberName}>{displayName}</span>
        <ChevronDown className={styles.chevron} aria-hidden="true" size={15} />
      </summary>

      <div className={styles.menuPanel} role="menu">
        <div className={styles.profileSummary}>
          <MemberAvatar user={user} />
          <span>
            <strong>{displayName}</strong>
            {user.email ? <small>{user.email}</small> : null}
          </span>
        </div>

        <div className={styles.menuItems}>
          <Link href="/my-courses" onClick={closeMenu} role="menuitem">
            <BookOpen aria-hidden="true" size={17} />
            <span>我的學習中心／我的內容</span>
          </Link>
          <Link href="/my-subscriptions" onClick={closeMenu} role="menuitem">
            <CreditCard aria-hidden="true" size={17} />
            <span>我的訂閱</span>
          </Link>
          {canManage ? (
            <Link href="/admin" onClick={closeMenu} role="menuitem">
              <LayoutDashboard aria-hidden="true" size={17} />
              <span>管理後台</span>
            </Link>
          ) : null}
        </div>

        <button className={styles.signOutButton} onClick={handleSignOut} role="menuitem" type="button">
          <LogOut aria-hidden="true" size={17} />
          <span>登出帳號</span>
        </button>
      </div>
    </details>
  )
}
