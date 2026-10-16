// Demo shell only: a plain stand-in for your product's navigation.
import { ProductNav } from '@/components/product-nav'
import sample from '@/lib/sample-products.json'

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
        <span className="font-serif text-xl">Product development</span>
        <ProductNav products={sample.products.map(({ slug, name }) => ({ slug, name }))} />
      </header>
      {children}
    </div>
  )
}
