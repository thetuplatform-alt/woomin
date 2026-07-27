/**
 * This platform is designed to boot with only DATABASE_URL in common hosted
 * environments. Auth.js requires explicitly trusting the incoming host when the
 * app sits behind a proxy, so we enable host trust by default here instead of
 * asking each deployment to set an extra env var.
 */
export function shouldTrustAuthHost(): boolean {
  return true
}
