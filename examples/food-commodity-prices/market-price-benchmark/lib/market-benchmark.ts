import 'server-only'
import { unstable_cache } from 'next/cache'

// Compare how a customer's purchase price moved with how the USDA market moved.
// Copy this file into your project. It runs only on the server, because it reads
// your Orbbit Data API key. Outside Next.js, delete the last section and call
// getMarketBenchmark with your key.
//
// It compares movement, not price level: both lines start at 100 on the first
// purchase, because a supplier's price includes freight and margin that the
// market price does not.

export type Purchase = {
  date: string // YYYY-MM-DD
  price: number // in the metric's unit, e.g. dollars per pound
}

export type BenchmarkPoint = {
  date: string // the purchase date
  you: number // the customer's price, indexed to 100 at the first purchase
  market: number // the market price on or before that date, indexed the same way
}

export type MarketBenchmark = {
  metric: string
  unit: string // how to read the prices, e.g. "usd_per_lb"
  firstDate: string
  lastDate: string
  marketNewestDate: string // the newest market value the API has
  points: BenchmarkPoint[]
  yourChangePct: number
  marketChangePct: number
  gapPts: number // yourChangePct minus marketChangePct
  skipped: number // purchases dated before any market value
}

export class OrbbitDataError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(`Orbbit Data ${status}: ${message}`)
  }
}

const LOOKBACK_DAYS = 31 // so a market value on or before the first purchase is always included

export async function getMarketBenchmark(options: {
  metric: string // a metric_name from GET /v1/commodities, in the same unit as the purchases
  purchases: Purchase[]
  apiKey: string
}): Promise<MarketBenchmark> {
  const { metric, apiKey } = options
  const purchases = [...options.purchases].sort((a, b) => a.date.localeCompare(b.date))

  // One call ($0.01): from a month before the first purchase up to the market's newest value.
  const url = new URL('https://data-api.orbbit.co/v1/commodities/metric-values')
  url.searchParams.set('metrics', metric)
  url.searchParams.set('from', daysBefore(purchases[0].date, LOOKBACK_DAYS))
  const res = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` } })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new OrbbitDataError(res.status, body?.error?.message ?? res.statusText)

  const series: { unit: string; points: { date: string; value: number }[] } = body.data[0]

  // Pair each purchase with the market value on or before its date.
  const paired: { date: string; price: number; market: number }[] = []
  for (const purchase of purchases) {
    const market = series.points.findLast((p) => p.date <= purchase.date)
    if (market) paired.push({ ...purchase, market: market.value })
  }
  if (paired.length === 0) throw new Error(`No market values on or before any purchase for ${metric}`)

  const base = paired[0]
  const last = paired.at(-1)!
  const yourChangePct = round((last.price / base.price - 1) * 100)
  const marketChangePct = round((last.market / base.market - 1) * 100)

  return {
    metric,
    unit: series.unit,
    firstDate: base.date,
    lastDate: last.date,
    marketNewestDate: series.points.at(-1)!.date,
    points: paired.map((p) => ({
      date: p.date,
      you: round((p.price / base.price) * 100),
      market: round((p.market / base.market) * 100),
    })),
    yourChangePct,
    marketChangePct,
    gapPts: round(yourChangePct - marketChangePct),
    skipped: purchases.length - paired.length,
  }
}

function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

// Next.js only: read the key here, never in a page, and keep each result for 12 hours.
// USDA publishes once per business day, so reloading costs nothing until then.
// Returns null when no key is set.
const cached = unstable_cache(getMarketBenchmark, ['market-benchmark'], { revalidate: 12 * 60 * 60 })

export async function getCachedMarketBenchmark(metric: string, purchases: Purchase[]): Promise<MarketBenchmark | null> {
  const apiKey = process.env.ORBBIT_DATA_API_KEY
  return apiKey ? cached({ metric, purchases, apiKey }) : null
}
