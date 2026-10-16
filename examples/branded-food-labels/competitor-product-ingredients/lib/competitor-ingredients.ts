import 'server-only'
import { unstable_cache } from 'next/cache'

// Find the real products whose labels share the most ingredients with your customer's
// recipe, and split each one into what both use, only they use, and only you use.
// Copy this file into your project. It runs only on the server, because it reads your
// Orbbit Data API key. Outside Next.js, delete the last section and call
// getClosestCompetitors with your key.
//
// Labels are as the brand last reported them to USDA, often years ago, so show each
// label's date and never use one label to say a product is safe for an allergy.

export type IngredientKind = 'grain' | 'nut' | 'sweetener' | 'oil' | 'fruit' | 'salt' | 'spice' | 'legume' | 'dairy' | 'other'

export type Ingredient = { name: string; kind: IngredientKind }

export type Competitor = {
  id: string
  upc: string | null
  brand: string // brand name, else brand owner
  name: string // the product name as printed in the label data
  changedOn: string | null // when the brand last changed the label, YYYY-MM-DD
  statement: string // the full ingredient statement, as printed on the label
  sharedCount: number // ingredients this product shares with the recipe
  ingredients: (Ingredient & { shared: boolean })[] // in label order, most by weight first
  onlyThem: string[]
  onlyYou: string[]
}

export type ClosestCompetitors = {
  query: string
  category: string
  productCount: number // labels with an ingredient list
  skipped: number // labels without one
  recipe: Ingredient[]
  closest: Competitor[]
}

export class OrbbitDataError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(`Orbbit Data ${status}: ${message}`)
  }
}

const PAGE_SIZE = 200 // the most the search returns per request

type Label = {
  id: string
  upc: string | null
  description: string
  brand_name: string | null
  brand_owner: string | null
  ingredients: string | null
  modified_on: string | null
}

export async function getClosestCompetitors(options: {
  recipe: string // the product's ingredient list, written like a label
  query: string // a word competing products' names contain, e.g. "granola"
  category: string // one value from GET /v1/branded-foods/categories, e.g. "Cereal"
  apiKey: string
  count?: number // how many closest products to return
}): Promise<ClosestCompetitors> {
  const { recipe, query, category, apiKey, count = 5 } = options

  // One request ($0.01) per 200 labels, following each page to the next.
  const labels: Label[] = []
  let cursor: string | null = null
  do {
    const url = new URL('https://data-api.orbbit.co/v1/branded-foods')
    url.searchParams.set('description', query)
    url.searchParams.set('category', category)
    url.searchParams.set('limit', String(PAGE_SIZE))
    if (cursor) url.searchParams.set('cursor', cursor)
    const res = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` } })
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new OrbbitDataError(res.status, body?.error?.message ?? res.statusText)
    labels.push(...body.data)
    cursor = body.next_cursor ?? null
  } while (cursor)

  const mine = cleanIngredients(recipe)
  const listed = labels.filter((l) => l.ingredients?.trim())

  // One product often appears under two brand owners: count the same list once, keeping the newest label.
  const newestByList = new Map<string, { label: Label; theirs: string[] }>()
  for (const label of listed) {
    const theirs = cleanIngredients(label.ingredients!)
    const key = theirs.join('|')
    const kept = newestByList.get(key)
    if (!kept || (label.modified_on ?? '') > (kept.label.modified_on ?? '')) newestByList.set(key, { label, theirs })
  }

  const compared: Competitor[] = [...newestByList.values()].map(({ label, theirs }) => {
    const ingredients = theirs.map((name) => ({ name, kind: ingredientKind(name), shared: mine.includes(name) }))
    return {
      id: label.id,
      upc: label.upc,
      brand: label.brand_name || label.brand_owner || '',
      name: label.description,
      changedOn: label.modified_on,
      statement: label.ingredients!.trim(),
      sharedCount: ingredients.filter((i) => i.shared).length,
      ingredients,
      onlyThem: theirs.filter((name) => !mine.includes(name)),
      onlyYou: mine.filter((name) => !theirs.includes(name)),
    }
  })

  // Most shared first; on a tie, the shorter list is the closer match.
  const closest = compared
    .sort((a, b) => b.sharedCount - a.sharedCount || a.ingredients.length - b.ingredients.length || a.id.localeCompare(b.id))
    .slice(0, count)

  return {
    query,
    category,
    productCount: listed.length,
    skipped: labels.length - listed.length,
    recipe: mine.map((name) => ({ name, kind: ingredientKind(name) })),
    closest,
  }
}

// Turn one ingredient statement into plain ingredient names in label order, so that
// "ORGANIC ROLLED OATS" and "WHOLE GRAIN OATS" count as the same thing.
const FILLER = /^(?:ingredients\s*:?|contains\s+(?:less\s+than\s+)?\d+(?:\.\d+)?%\s+(?:or\s+less\s+)?of\s*:?|and|&)\s*/
const REASON = /\s+(?:to|for)\s.*$/ // "palm oil to prevent separation"
const QUALIFIERS =
  /\b(?:organic|certified|non-gmo|natural|whole grain|whole|rolled|expeller[- ]pressed|pure|filtered|dry roasted|roasted|cooked|steamed|blanched|selected|extra virgin|fully|partially|fresh|freeze-dried|dried)\b/g
const SAME = new Map([
  ['sea salt', 'salt'],
  ['garbanzo beans', 'chickpeas'],
  ['sesame tahini', 'tahini'],
  ['flavors', 'flavor'],
])

export function cleanIngredients(text: string): string[] {
  const pieces: string[] = []
  let depth = 0
  let piece = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    else if (depth > 0) continue // drop sub-ingredients
    else if (ch === ',' || ch === ';' || (ch === '.' && !/\d/.test(text[i + 1] ?? ''))) {
      pieces.push(piece)
      piece = ''
    } else piece += ch
  }
  pieces.push(piece)

  const names: string[] = []
  for (const raw of pieces) {
    let name = raw.toLowerCase().trim()
    let before: string
    do {
      before = name
      name = name.replace(FILLER, '').trim()
    } while (name !== before)
    name = name
      .replace(REASON, '')
      .replace(QUALIFIERS, '')
      .replace(/[^a-z0-9%' -]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\boils$/, 'oil')
    name = SAME.get(name) ?? name
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

// A rough kind for each ingredient, only used to pick an icon. Checked in order.
const KINDS: [IngredientKind, RegExp][] = [
  ['oil', /\boils?\b|shortening/],
  ['sweetener', /sugar|syrup|honey|molasses|dextrose|sweetener|stevia|nectar|maltodextrin/],
  ['salt', /\bsalt\b/],
  ['spice', /cinnamon|spice|vanilla|cumin|paprika|ginger|nutmeg|flavor|extract|parsley|herb|pepper flakes/],
  ['legume', /chickpea|\bbeans?\b|lentil|\bpeas?\b|\bsoy/],
  ['nut', /nut|almond|pecan|cashew|pistachio|seed|coconut|tahini|sesame/],
  ['grain', /oat|wheat|rice|flour|corn|barley|quinoa|millet|\brye\b|bran|grain|crisp/],
  ['fruit', /berr|raisin|apple|banana|cherr|\bdates?\b|\bfigs?\b|mango|lemon|lime|orange|fruit|pepper|tomato|garlic|onion|carrot|vegetable/],
  ['dairy', /milk|cream|cheese|butter|whey|yogurt|casein/],
]

export function ingredientKind(name: string): IngredientKind {
  return KINDS.find(([, pattern]) => pattern.test(name))?.[0] ?? 'other'
}

// Next.js only: read the key here, never in a page, and keep each result for 7 days.
// USDA updates labels about twice a year, so reloading costs nothing until then.
// Returns null when no key is set.
const cached = unstable_cache(getClosestCompetitors, ['closest-competitors'], { revalidate: 7 * 24 * 60 * 60 })

export async function getCachedClosestCompetitors(
  recipe: string,
  query: string,
  category: string,
  count = 5,
): Promise<ClosestCompetitors | null> {
  const apiKey = process.env.ORBBIT_DATA_API_KEY
  return apiKey ? cached({ recipe, query, category, apiKey, count }) : null
}
