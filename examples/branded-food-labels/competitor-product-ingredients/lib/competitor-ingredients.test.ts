import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanIngredients, getClosestCompetitors, ingredientKind, OrbbitDataError } from './competitor-ingredients'

const API_KEY = 'orbbit_data_test'
const RECIPE = 'ROLLED OATS, MAPLE SYRUP, HONEY, SEA SALT'

// ── fixtures ──────────────────────────────────────────────────────────────────

function buildLabel(id: string, ingredients: string | null, overrides: Record<string, unknown> = {}) {
  return {
    id,
    description: `GRANOLA ${id}`,
    brand_owner: `OWNER ${id}`,
    brand_name: `BRAND ${id}`,
    category: 'Cereal',
    upc: `00000000000${id}`,
    ingredients,
    modified_on: '2021-06-01',
    ...overrides,
  }
}

const PAGE_1 = {
  data: [
    buildLabel('A', 'ORGANIC ROLLED OATS, HONEY, ALMONDS (ALMONDS, SALT).'),
    buildLabel('B', 'ROLLED OATS, CANE SUGAR, ALMONDS'),
    buildLabel('C', null),
  ],
  next_cursor: 'C',
}

const PAGE_2 = {
  data: [
    buildLabel('D', 'WHOLE GRAIN ROLLED OATS, HONEY; COCONUT, CONTAINS 2% OR LESS OF SEA SALT', {
      brand_name: null,
      modified_on: '2019-03-01',
    }),
    buildLabel('E', 'OATS, MAPLE SYRUP, HONEY, SALT, CINNAMON'),
    buildLabel('F', 'OATS, HONEY, SALT'),
  ],
  next_cursor: null,
}

function respondWith(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function run(count?: number) {
  return getClosestCompetitors({ recipe: RECIPE, query: 'granola', category: 'Cereal', apiKey: API_KEY, count })
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('cleanIngredients', () => {
  it('splits on commas, semicolons and periods, keeping label order', () => {
    expect(cleanIngredients('OATS; HONEY. SALT')).toEqual(['oats', 'honey', 'salt'])
  })

  it('keeps a comma inside parentheses or brackets from splitting, and drops what is inside', () => {
    expect(cleanIngredients('ALMONDS (ALMONDS, SALT), RAISINS [RAISINS, OIL]')).toEqual(['almonds', 'raisins'])
  })

  it('drops leading filler', () => {
    expect(cleanIngredients('INGREDIENTS: OATS, CONTAINS 2% OR LESS OF CINNAMON, AND HONEY, & SPICES')).toEqual([
      'oats',
      'cinnamon',
      'honey',
      'spices',
    ])
  })

  it('drops a trailing reason', () => {
    expect(cleanIngredients('PALM OIL TO PREVENT SEPARATION, TOCOPHEROLS FOR FRESHNESS')).toEqual(['palm oil', 'tocopherols'])
  })

  it('drops qualifier and cooking words', () => {
    expect(cleanIngredients('ORGANIC ROLLED OATS, DRY ROASTED PEANUTS, EXTRA VIRGIN OLIVE OIL, FREEZE-DRIED BLUEBERRIES')).toEqual([
      'oats',
      'peanuts',
      'olive oil',
      'blueberries',
    ])
  })

  it('merges same-thing names', () => {
    expect(cleanIngredients('SEA SALT, GARBANZO BEANS, SESAME TAHINI, NATURAL FLAVORS, VEGETABLE OILS')).toEqual([
      'salt',
      'chickpeas',
      'tahini',
      'flavor',
      'vegetable oil',
    ])
  })

  it('drops empty pieces and keeps only the first of a repeated ingredient', () => {
    expect(cleanIngredients('OATS, , WHOLE OATS, HONEY')).toEqual(['oats', 'honey'])
  })
})

describe('ingredientKind', () => {
  it('gives each kind from its keyword', () => {
    const kinds = Object.fromEntries(
      ['oats', 'almonds', 'pumpkin seeds', 'honey', 'canola oil', 'blueberries', 'salt', 'cinnamon', 'chickpeas', 'milk', 'xanthan gum'].map(
        (name) => [name, ingredientKind(name)],
      ),
    )

    expect(kinds).toEqual({
      oats: 'grain',
      almonds: 'nut',
      'pumpkin seeds': 'nut',
      honey: 'sweetener',
      'canola oil': 'oil',
      blueberries: 'fruit',
      salt: 'salt',
      cinnamon: 'spice',
      chickpeas: 'legume',
      milk: 'dairy',
      'xanthan gum': 'other',
    })
  })
})

describe('getClosestCompetitors', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (input: URL | string) => {
      const url = new URL(input.toString())
      return respondWith(url.searchParams.get('cursor') === 'C' ? PAGE_2 : PAGE_1)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('follows next_cursor until a page has none, calling the search once per page', async () => {
    await run()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [first, second] = fetchMock.mock.calls.map(([input]) => new URL(input.toString()))
    for (const url of [first, second]) {
      expect(url.origin + url.pathname).toBe('https://data-api.orbbit.co/v1/branded-foods')
      expect(url.searchParams.get('description')).toBe('granola')
      expect(url.searchParams.get('category')).toBe('Cereal')
      expect(url.searchParams.get('limit')).toBe('200')
    }
    expect(first.searchParams.get('cursor')).toBeNull()
    expect(second.searchParams.get('cursor')).toBe('C')
  })

  it('counts labels with an ingredient list as productCount and the rest as skipped', async () => {
    const result = await run()

    expect(result.productCount).toBe(5)
    expect(result.skipped).toBe(1)
  })

  it('returns the cleaned recipe in order with kinds', async () => {
    const result = await run()

    expect(result.recipe).toEqual([
      { name: 'oats', kind: 'grain' },
      { name: 'maple syrup', kind: 'sweetener' },
      { name: 'honey', kind: 'sweetener' },
      { name: 'salt', kind: 'salt' },
    ])
  })

  it('ranks by ingredients shared with the recipe, ties going to the shorter list', async () => {
    const result = await run()

    expect(result.closest.map((p) => [p.id, p.sharedCount])).toEqual([
      ['E', 4],
      ['F', 3],
      ['D', 3],
      ['A', 2],
      ['B', 1],
    ])
  })

  it('returns only count products', async () => {
    const result = await run(2)

    expect(result.closest.map((p) => p.id)).toEqual(['E', 'F'])
  })

  it('counts labels with the same cleaned ingredient list once, keeping the newest', async () => {
    fetchMock.mockImplementation(async (input: URL | string) => {
      const url = new URL(input.toString())
      if (url.searchParams.get('cursor') !== 'C') return respondWith(PAGE_1)
      return respondWith({ ...PAGE_2, data: [...PAGE_2.data, buildLabel('G', 'OATS, HONEY, SEA SALT', { modified_on: '2024-01-01' })] })
    })

    const result = await run()

    expect(result.closest.map((p) => p.id)).toEqual(['E', 'G', 'D', 'A', 'B'])
  })

  it("gives each product's ingredients in label order with shared flags, and what only they or only you use", async () => {
    const d = (await run()).closest.find((p) => p.id === 'D')!

    expect(d.ingredients.map((i) => [i.name, i.shared])).toEqual([
      ['oats', true],
      ['honey', true],
      ['coconut', false],
      ['salt', true],
    ])
    expect(d.ingredients[2].kind).toBe('nut')
    expect(d.onlyThem).toEqual(['coconut'])
    expect(d.onlyYou).toEqual(['maple syrup'])
  })

  it("gives each product's brand, name, barcode, label date and full ingredient statement", async () => {
    const result = await run()
    const byId = Object.fromEntries(result.closest.map((p) => [p.id, p]))

    expect(byId.E).toMatchObject({
      brand: 'BRAND E',
      name: 'GRANOLA E',
      upc: '00000000000E',
      changedOn: '2021-06-01',
      statement: 'OATS, MAPLE SYRUP, HONEY, SALT, CINNAMON',
    })
    expect(byId.D).toMatchObject({ brand: 'OWNER D', changedOn: '2019-03-01' })
  })

  it('throws OrbbitDataError with the status when the API refuses the request', async () => {
    fetchMock.mockImplementation(async () => respondWith({ error: { message: 'Insufficient balance' } }, 402))

    const error = await run().catch((e) => e)
    expect(error).toBeInstanceOf(OrbbitDataError)
    expect(error.status).toBe(402)
  })

  it('sends the API key only in the authorization header, never in the address', async () => {
    await run()

    for (const [input, init] of fetchMock.mock.calls) {
      expect(input.toString()).not.toContain(API_KEY)
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${API_KEY}`)
    }
  })
})
