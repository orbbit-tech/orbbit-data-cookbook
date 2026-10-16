import 'server-only'
import { unstable_cache } from 'next/cache'

// Optional: a package image for each barcode. Kroger's website serves a front-of-pack
// product image for every barcode it sells, at a fixed address. The images belong to the
// brands; link to them (never copy them) and keep the credit line on the page.
// Products Kroger doesn't sell have no image; show something else for those, or skip them.

export function imageUrlFor(barcode: string): string {
  const code = barcode.slice(0, -1).padStart(13, '0') // drop the check digit, pad to 13 digits
  return `https://www.kroger.com/product/images/xlarge/front/${code}`
}

// Check barcodes in the order given, 10 at a time, and stop once `want` have an image
// or `max` checks are spent. Returns only the barcodes with an image, in that order.
// If a check was refused or unreachable and fewer than `want` turned up, it throws,
// so a cache never keeps a partial answer.
export async function findImages(barcodes: string[], { want, max = 30 }: { want: number; max?: number }): Promise<Record<string, string>> {
  const found: [string, string][] = []
  let failed = false
  const queue = [...new Set(barcodes)].slice(0, max)
  for (let i = 0; i < queue.length && found.length < want; i += 10) {
    const batch = queue.slice(i, i + 10)
    const results = await Promise.all(batch.map(check))
    results.forEach((r, j) => {
      if (r === 'yes') found.push([batch[j], imageUrlFor(batch[j])])
      if (r === 'failed') failed = true
    })
  }
  if (failed && found.length < want) throw new Error('Some image checks were refused or unreachable; try again in a minute')
  return Object.fromEntries(found.slice(0, want))
}

async function check(barcode: string): Promise<'yes' | 'no' | 'failed'> {
  try {
    const res = await fetch(imageUrlFor(barcode), { method: 'HEAD' })
    if (res.ok) return 'yes'
    return res.status === 404 ? 'no' : 'failed'
  } catch {
    return 'failed'
  }
}

// Next.js only: keep each answer for 7 days. A thrown check is not kept.
export const getCachedImages = unstable_cache(findImages, ['product-images'], { revalidate: 7 * 24 * 60 * 60 })
