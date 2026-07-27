export function shouldShowStandaloneInvoiceOperations(
  invoice: { failReason: string | null } | null
): boolean {
  return Boolean(invoice?.failReason)
}
