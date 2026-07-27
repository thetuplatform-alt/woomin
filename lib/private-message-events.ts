export const ADMIN_PRIVATE_MESSAGE_UNREAD_CHANGED_EVENT =
  'admin-private-message-unread-changed'

export function notifyAdminPrivateMessageUnreadChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ADMIN_PRIVATE_MESSAGE_UNREAD_CHANGED_EVENT))
}
