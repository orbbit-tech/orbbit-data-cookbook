'use client'

// Demo only: the customer's own purchases, as your product already shows them.
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

const config = { price: { label: 'Price you paid ($/lb)', color: 'var(--chart-1)' } } satisfies ChartConfig

export function InvoicesChart({ purchases }: { purchases: { date: string; price: number }[] }) {
  return (
    <ChartContainer data-testid="invoices-chart" config={config} className="aspect-auto h-48 w-full">
      <BarChart data={purchases} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={month} />
        <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => day(String(d))} />} />
        <Bar dataKey="price" fill="var(--color-price)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}

const month = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
const day = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
