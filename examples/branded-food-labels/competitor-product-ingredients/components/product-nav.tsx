'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function ProductNav({ products }: { products: { slug: string; name: string }[] }) {
  const pathname = usePathname()

  return (
    <nav className="flex gap-6 text-sm">
      {products.map((product) => {
        const href = `/products/${product.slug}`
        return (
          <Link
            key={product.slug}
            href={href}
            data-testid={`nav-${product.slug}`}
            className={cn(
              'text-muted-foreground hover:text-foreground border-b border-transparent pb-0.5 transition-colors',
              pathname === href && 'text-foreground border-foreground',
            )}
          >
            {product.name}
          </Link>
        )
      })}
    </nav>
  )
}
