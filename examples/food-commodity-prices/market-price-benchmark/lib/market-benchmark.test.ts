import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMarketBenchmark, OrbbitDataError, type Purchase } from './market-benchmark'

const METRIC = 'butter_aa_us_chicago_wholesale_daily_close_price_usd_per_lb'
const API_KEY = 'orbbit_data_test'

// ── fixtures ──────────────────────────────────────────────────────────────────

const MARKET_POINTS = [
  { date: '2025-10-01', value: 2.0 },
  { date: '2025-10-03', value: 2.1 },
  { date: '2026-04-01', value: 1.9 },
  { date: '2026-10-01', value: 2.2 },
]

function buildMarketResponse(points = MARKET_POINTS) {
  return {
    data: [
      {
        metric_name: METRIC,
        unit: 'usd_per_lb',
        start_date: '2025-09-02',
        end_date: points.at(-1)?.date ?? null,
        values: points,
      },
    ],
  }
}

function buildPurchases(overrides: Purchase[] = []): Purchase[] {
  return overrides.length
    ? overrides
    : [
        { date: '2025-10-03', price: 1.4 },
        { date: '2026-10-01', price: 1.68 },
      ]
}

function respondWith(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('getMarketBenchmark', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async () => respondWith(buildMarketResponse()))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts both lines at 100 on the first purchase date', async () => {
    const result = await getMarketBenchmark({ metric: METRIC, purchases: buildPurchases(), apiKey: API_KEY })

    expect(result.points[0]).toEqual({ date: '2025-10-03', you: 100, market: 100 })
  })

  it('returns your change, the market change and the gap in points', async () => {
    const result = await getMarketBenchmark({ metric: METRIC, purchases: buildPurchases(), apiKey: API_KEY })

    expect(result.yourChangePct).toBe(20)
    expect(result.marketChangePct).toBe(4.76)
    expect(result.gapPts).toBe(15.24)
  })

  it('matches a purchase to the market value on the same day', async () => {
    const result = await getMarketBenchmark({ metric: METRIC, purchases: buildPurchases(), apiKey: API_KEY })

    expect(result.points[1]).toEqual({ date: '2026-10-01', you: 120, market: 104.76 })
  })

  it('returns the unit, the purchase date range and the market newest date', async () => {
    const result = await getMarketBenchmark({ metric: METRIC, purchases: buildPurchases(), apiKey: API_KEY })

    expect(result.unit).toBe('usd_per_lb')
    expect(result.firstDate).toBe('2025-10-03')
    expect(result.lastDate).toBe('2026-10-01')
    expect(result.marketNewestDate).toBe('2026-10-01')
  })

  it('matches a purchase with no same-day value to the value before it, never after', async () => {
    const purchases = buildPurchases([
      { date: '2025-10-02', price: 1.4 },
      { date: '2026-10-01', price: 1.68 },
    ])

    const result = await getMarketBenchmark({ metric: METRIC, purchases, apiKey: API_KEY })

    expect(result.marketChangePct).toBe(10)
  })

  it('returns purchases given out of order in date order, starting from the earliest', async () => {
    const purchases = buildPurchases([
      { date: '2026-10-01', price: 1.68 },
      { date: '2025-10-03', price: 1.4 },
    ])

    const result = await getMarketBenchmark({ metric: METRIC, purchases, apiKey: API_KEY })

    expect(result.points.map((p) => p.date)).toEqual(['2025-10-03', '2026-10-01'])
    expect(result.yourChangePct).toBe(20)
  })

  it('leaves out a purchase dated before any market value, counts it, and starts from the next one', async () => {
    const purchases = buildPurchases([
      { date: '2025-09-15', price: 1.3 },
      { date: '2025-10-03', price: 1.4 },
      { date: '2026-10-01', price: 1.68 },
    ])

    const result = await getMarketBenchmark({ metric: METRIC, purchases, apiKey: API_KEY })

    expect(result.skipped).toBe(1)
    expect(result.points[0]).toEqual({ date: '2025-10-03', you: 100, market: 100 })
  })

  it('throws OrbbitDataError when the API refuses the request', async () => {
    fetchMock.mockResolvedValue(respondWith({ error: { type: 'invalid_request', message: 'Unknown metrics: x' } }, 400))

    await expect(getMarketBenchmark({ metric: 'x', purchases: buildPurchases(), apiKey: API_KEY })).rejects.toThrow(
      OrbbitDataError,
    )
  })

  it('asks for the series by name in metric_names', async () => {
    await getMarketBenchmark({ metric: METRIC, purchases: buildPurchases(), apiKey: API_KEY })

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.get('metric_names')).toBe(METRIC)
  })

  it('asks for prices from 31 days before the first purchase in start_date', async () => {
    await getMarketBenchmark({ metric: METRIC, purchases: buildPurchases(), apiKey: API_KEY })

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.get('start_date')).toBe('2025-09-02')
  })

  it('never sends the old inputs metrics or from', async () => {
    await getMarketBenchmark({ metric: METRIC, purchases: buildPurchases(), apiKey: API_KEY })

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.has('metrics')).toBe(false)
    expect(url.searchParams.has('from')).toBe(false)
  })

  it('makes exactly one call, to /v1/commodities/metric-values', async () => {
    await getMarketBenchmark({ metric: METRIC, purchases: buildPurchases(), apiKey: API_KEY })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/v1/commodities/metric-values')
  })

  it('sends the API key only in the authorization header', async () => {
    await getMarketBenchmark({ metric: METRIC, purchases: buildPurchases(), apiKey: API_KEY })

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).not.toContain(API_KEY)
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${API_KEY}`)
  })

  it('never returns a dollar difference between your price and the market price', async () => {
    const result = await getMarketBenchmark({ metric: METRIC, purchases: buildPurchases(), apiKey: API_KEY })

    expect(Object.keys(result).sort()).toEqual(
      [
        'firstDate',
        'gapPts',
        'lastDate',
        'marketChangePct',
        'marketNewestDate',
        'metric',
        'points',
        'skipped',
        'unit',
        'yourChangePct',
      ].sort(),
    )
    expect(Object.keys(result.points[0]).sort()).toEqual(['date', 'market', 'you'])
  })
})
