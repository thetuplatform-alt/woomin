import type { LumiProduct } from './data'

export const lumiKidsGroup = {
  category: 'kids',
  name: 'Lumi Kids',
  label: '幼教工具',
  description: '給幼教老師與家長的日常實用工具',
} as const

export function groupLumiCatalogProducts(products: LumiProduct[]) {
  const kidsProducts: LumiProduct[] = []
  const otherProducts: LumiProduct[] = []

  for (const product of products) {
    if (product.category === lumiKidsGroup.category) {
      kidsProducts.push(product)
    } else {
      otherProducts.push(product)
    }
  }

  return { kidsProducts, otherProducts }
}
