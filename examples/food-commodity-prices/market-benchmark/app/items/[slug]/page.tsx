// Demo page only: your product's item page, with the market benchmark card added.
// It runs on the server, so the API key never reaches the browser.
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InvoicesChart } from '@/components/invoices-chart'
import { MarketBenchmarkCard } from '@/components/market-benchmark-card'
import { getCachedMarketBenchmark } from '@/lib/market-benchmark'
import sample from '@/lib/sample-items.json'

export const dynamic = 'force-dynamic'

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = sample.items.find((i) => i.slug === slug)
  if (!item) notFound()

  const benchmark = await getCachedMarketBenchmark(item.metric, item.purchases)
  const latest = item.purchases.at(-1)!

  return (
    <main className="mx-auto grid max-w-4xl gap-6 p-6">
      <div data-testid="item-header" className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <span className="text-muted-foreground text-sm">Items</span>
          <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
        </div>
        <div className="flex gap-6 text-sm">
          <Fact label="Pack" value={item.pack} />
          <Fact label="Last price" value={`$${latest.price.toFixed(2)}/lb`} />
          <Fact label="Last order" value={short(latest.date)} />
        </div>
      </div>

      {!benchmark ? (
        <Card data-testid="missing-key" className="border-dashed">
          <CardContent className="text-muted-foreground py-16 text-center text-sm">
            Add <code>ORBBIT_DATA_API_KEY</code> to <code>.env.local</code> and reload to run the demo.
          </CardContent>
        </Card>
      ) : (
        <>
      <MarketBenchmarkCard benchmark={benchmark} region={item.region} />

      <Card data-testid="purchase-history">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Your invoices
            <Badge data-testid="example-data" variant="secondary" className="font-normal">Example data</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InvoicesChart purchases={item.purchases} />
        </CardContent>
      </Card>
        </>
      )}
    </main>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

const short = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
