// Demo shell only: a plain stand-in for your product's navigation.
import { ItemNav } from '@/components/item-nav'
import sample from '@/lib/sample-items.json'

export default function ItemsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="bg-background hidden w-60 shrink-0 flex-col gap-6 border-r p-4 md:flex">
        <div className="flex items-center gap-2 px-2 font-semibold">
          <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-sm">P</span>
          Purchasing
        </div>
        <ItemNav items={sample.items.map(({ slug, name }) => ({ slug, name }))} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
