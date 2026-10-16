'use client'

// Optional: shows the result of getMarketBenchmark as a card with a chart.
// Built with shadcn/ui (Card, Badge, Chart). If your app uses shadcn, add them
// with `npx shadcn@latest add card badge chart` and paste this file in.
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { MarketBenchmark as Result } from '@/lib/market-benchmark'

const UNIT_LABEL: Record<string, string> = {
  usd_per_lb: '$/lb',
  usd_each: '$ each',
  usd_per_cwt: '$/cwt',
  usd_per_metric_ton: '$/metric ton',
}

const chartConfig = {
  you: { label: 'Price you paid (your invoices)', color: 'var(--chart-1)' },
  market: { label: 'USDA market price', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function MarketBenchmarkCard({ benchmark, region }: { benchmark: Result; region: string }) {
  const unit = UNIT_LABEL[benchmark.unit] ?? benchmark.unit
  // Show the change since the first purchase, so both lines start at 0%.
  const data = benchmark.points.map((p) => ({ date: p.date, you: round(p.you - 100), market: round(p.market - 100) }))
  const config = { ...chartConfig, market: { ...chartConfig.market, label: `USDA market price (${region})` } } satisfies ChartConfig

  return (
    <Card data-testid="benchmark-card">
      <CardHeader>
        <CardTitle>Price you paid vs USDA market price</CardTitle>
      </CardHeader>

      <CardContent>
        <ChartContainer data-testid="chart" config={config} className="aspect-auto h-72 w-full">
          <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={month} />
            <YAxis tickLine={false} axisLine={false} width={44} domain={domain(data)} ticks={ticks(domain(data))} tickFormatter={(v) => `${sign(v)}${v}%`} />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={(d) => day(String(d))} formatter={tooltipRow(config)} />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line dataKey="market" type="monotone" stroke="var(--color-market)" strokeWidth={2.5} strokeDasharray="6 4" dot={false} />
            <Line dataKey="you" type="monotone" stroke="var(--color-you)" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ChartContainer>
      </CardContent>

      <CardFooter className="text-muted-foreground text-xs">
        <span data-testid="source-line">% change in {unit} · Market price: USDA via Orbbit Data</span>
      </CardFooter>
    </Card>
  )
}

const tooltipRow = (config: ChartConfig) => (value: unknown, name: unknown) => (
  <div className="flex w-full justify-between gap-4">
    <span className="text-muted-foreground">{config[String(name)]?.label ?? String(name)}</span>
    <span className="font-mono font-medium tabular-nums">{pct(Number(value))}</span>
  </div>
)

// Round the axis out to the nearest 10% so its labels read -20%, -10%, 0%, ...
const domain = (data: { you: number; market: number }[]): [number, number] => {
  const values = data.flatMap((p) => [p.you, p.market, 0])
  return [Math.floor(Math.min(...values) / 10) * 10, Math.ceil(Math.max(...values) / 10) * 10]
}
const ticks = ([min, max]: [number, number]) => Array.from({ length: (max - min) / 10 + 1 }, (_, i) => min + i * 10)
const round = (n: number) => Math.round(n * 10) / 10
const sign = (n: number) => (n > 0 ? '+' : '')
const pct = (n: number) => `${sign(n)}${n.toFixed(1)}%`
const month = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
const day = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
