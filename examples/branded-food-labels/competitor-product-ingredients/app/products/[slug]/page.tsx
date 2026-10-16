// Demo page only: your product's page for one of your customer's products, with the
// closest-products matchup added. It runs on the server, so the API key never reaches the browser.
import { notFound } from 'next/navigation'
import { CompetitorPanel, type PackShape } from '@/components/competitor-panel'
import { getCachedClosestCompetitors } from '@/lib/competitor-ingredients'
import { getCachedImageBox, type ImageBox } from '@/lib/image-bounds'
import { getCachedImages, imageUrlFor } from '@/lib/product-images'
import { getCachedRealProduct } from '@/lib/real-product'
import sample from '@/lib/sample-products.json'

export const dynamic = 'force-dynamic'

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ vs?: string }>
}) {
  const { slug } = await params
  const { vs } = await searchParams
  const product = sample.products.find((p) => p.slug === slug)
  if (!product) notFound()

  const yours = await getCachedRealProduct(product.upc)
  const ranked = yours && (await getCachedClosestCompetitors(yours.ingredients, product.query, product.category, 40))
  // Leave out the product's own brand, whose labels are always its closest matches, and keep one label per brand.
  const brandOf = (b: string) => b.toLowerCase().split(/\s+/)[0]
  const seen = new Set([brandOf(yours?.brand ?? '')])
  const candidates = ranked?.closest.filter((c) => !seen.has(brandOf(c.brand)) && seen.add(brandOf(c.brand))) ?? []
  // Show the 5 closest that have a package image; if the check fails, the 5 closest anyway.
  const images = await getCachedImages(candidates.flatMap((c) => (c.upc ? [c.upc] : [])), { want: 5, max: 40 }).catch(() => ({}) as Record<string, string>)
  const withImages = candidates.filter((c) => c.upc && images[c.upc])
  const result = ranked && { ...ranked, closest: (withImages.length ? withImages : candidates).slice(0, 5) }
  const productImage = product.image ?? (yours ? imageUrlFor(yours.upc) : null)
  // Measure where the package sits in each image, so every package fills the same frame.
  const urls = [productImage, ...Object.values(images)].filter((u): u is string => Boolean(u))
  const boxes: Record<string, ImageBox | null> = Object.fromEntries(
    await Promise.all(urls.map(async (u) => [u, await getCachedImageBox(u)] as const)),
  )

  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-6 pt-6 pb-16">
      {!result ? (
        <p data-testid="missing-key" className="text-muted-foreground bg-muted rounded-3xl py-24 text-center text-sm">
          Add <code>ORBBIT_DATA_API_KEY</code> to <code>.env.local</code> and reload to run the demo.
        </p>
      ) : (
        <CompetitorPanel
          productName={`${title(yours!.brand)} ${productTitle(yours!.name)}`}
          productImage={productImage}
          productStatement={yours!.ingredients}
          pack={product.pack as PackShape}
          result={result}
          images={images}
          boxes={boxes}
          selectedId={vs}
          hrefFor={(id) => `/products/${slug}?vs=${id}`}
        />
      )}
    </main>
  )
}

const title = (text: string) => text.toLowerCase().replace(/(^|[\s(&/-])([a-z])/g, (_, before, c) => before + c.toUpperCase())
// USDA names often repeat their parts ("GRANOLA, CINNAMON, RAISIN, CINNAMON, RAISIN").
const productTitle = (text: string) => title([...new Set(text.split(',').map((p) => p.trim()))].join(', '))
