'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function ItemNav({ items }: { items: { slug: string; name: string }[] }) {
  const pathname = usePathname()

  return (
    <nav className="grid gap-1">
      <span className="text-muted-foreground px-2 pb-1 text-xs font-medium">Items</span>
      {items.map((item) => {
        const href = `/items/${item.slug}`
        return (
          <Link
            key={item.slug}
            href={href}
            data-testid={`nav-${item.slug}`}
            className={cn(
              'hover:bg-muted rounded-md px-2 py-1.5 text-sm transition-colors',
              pathname === href && 'bg-muted font-medium',
            )}
          >
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}
