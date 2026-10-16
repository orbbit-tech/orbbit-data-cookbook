import 'server-only'
import { unstable_cache } from 'next/cache'
import { OrbbitDataError } from './competitor-ingredients'

// Demo only: reads one real product's label by barcode, to stand in for your customer's
// product. In your app, the recipe comes from your own records instead.
export type RealProduct = { id: string; upc: string; brand: string; name: string; ingredients: string }

async function getRealProduct(upc: string, apiKey: string): Promise<RealProduct> {
  const url = new URL('https://data-api.orbbit.co/v1/branded-foods')
  url.searchParams.set('upc', upc)
  url.searchParams.set('limit', '1')
  const res = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` } })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new OrbbitDataError(res.status, body?.error?.message ?? res.statusText)
  const label = body.data[0]
  return { id: label.id, upc: label.upc, brand: label.brand_name || label.brand_owner, name: label.description, ingredients: label.ingredients }
}

const cached = unstable_cache(getRealProduct, ['real-product'], { revalidate: 7 * 24 * 60 * 60 })

export async function getCachedRealProduct(upc: string): Promise<RealProduct | null> {
  const apiKey = process.env.ORBBIT_DATA_API_KEY
  return apiKey ? cached(upc, apiKey) : null
}
