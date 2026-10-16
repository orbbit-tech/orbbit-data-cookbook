// Optional: shows the result of getClosestCompetitors as a side-by-side matchup. The chosen
// competitor is drawn as a package (jar, bag or tub) from its label data on the left; on the right, picture tiles show the ingredients
// both products use, only theirs uses, and only yours uses. The other close matches sit in a
// row underneath, and clicking one makes it the matchup. Plain Tailwind, no other components.
import Link from 'next/link'
import type { ClosestCompetitors, Competitor, IngredientKind } from '@/lib/competitor-ingredients'
import { placeInFrame, type ImageBox } from '@/lib/image-bounds'
import { cn } from '@/lib/utils'

export function CompetitorPanel({
  productName,
  productImage,
  productStatement,
  pack,
  result,
  images,
  boxes,
  selectedId,
  hrefFor,
}: {
  productName: string
  productImage: string | null
  productStatement: string
  pack: PackShape
  result: ClosestCompetitors
  images: Record<string, string>
  boxes: Record<string, ImageBox | null>
  selectedId?: string
  hrefFor: (competitorId: string) => string
}) {
  const imageOf = (c: Competitor) => (c.upc ? images[c.upc] ?? null : null)
  const selected = result.closest.find((c) => c.id === selectedId) ?? result.closest[0]
  if (!selected) return null

  const kindOf = new Map([...result.recipe, ...selected.ingredients].map((i) => [i.name, i.kind] as const))
  const both = selected.ingredients.filter((i) => i.shared).map((i) => i.name)

  return (
    <div data-testid="competitor-panel" className="grid gap-8">
      <section className="grid items-start gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="grid gap-8">
          <div className="bg-muted grid grid-cols-2 items-end gap-6 rounded-3xl px-8 pt-10 pb-6">
            <Shot image={productImage} box={productImage ? boxes[productImage] : null} label="Yours" />
            <Shot
              image={imageOf(selected)}
              box={imageOf(selected) ? boxes[imageOf(selected)!] : null}
              label="Theirs"
              fallback={<Package shape={pack} competitor={selected} className="aspect-square w-full rounded-2xl" />}
            />
          </div>

          <div className="grid gap-3">
            <h3 className="font-serif text-xl">Also close to yours</h3>
            <p className="text-muted-foreground -mt-2 text-xs" data-testid="product-count">
              The {result.closest.length} of {result.productCount.toLocaleString('en-US')} {result.query} labels in {result.category} that share
              the most ingredients with yours
            </p>
            <div className="grid grid-cols-5 gap-3">
              {result.closest.map((c) => (
                <Link key={c.id} href={hrefFor(c.id)} scroll={false} data-testid="competitor-row" className="group grid min-w-0 gap-1.5" title={`${title(c.brand)} · ${productTitle(c.name)}`}>
                  <span
                    className={cn(
                      'bg-muted relative block aspect-square w-full overflow-hidden rounded-xl ring-2 ring-transparent ring-offset-2 ring-offset-background transition',
                      c.id === selected.id ? 'ring-warm' : 'group-hover:ring-border',
                    )}
                  >
                    {imageOf(c) ? (
                      <span className="absolute inset-[12%]">
                        <Fitted src={imageOf(c)!} box={boxes[imageOf(c)!]} frameRatio={1} />
                      </span>
                    ) : (
                      <Package shape={pack} competitor={c} className="absolute inset-0 h-full w-full" />
                    )}
                  </span>
                  <span className="grid text-xs">
                    <span className="truncate font-medium">{title(c.brand)}</span>
                    <span className="text-muted-foreground">
                      {c.sharedCount} of {result.recipe.length}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-7">
          <div className="grid gap-2">
            <p className="text-muted-foreground text-sm">Closest products on the shelf · {result.query}</p>
            <h2 className="font-serif text-3xl leading-tight tracking-tight">
              {productName}
              <span className="text-muted-foreground block">
                vs {title(selected.brand)} {withoutBrand(productTitle(selected.name), selected.brand)}
              </span>
            </h2>
            <p data-testid="match-line" className="text-muted-foreground text-sm">
              {selected.sharedCount} of your {result.recipe.length} ingredients
              {selected.changedOn && <> · label from {selected.changedOn.slice(0, 4)}</>}
            </p>
          </div>

          <Group label="In both" names={both} kindOf={kindOf} />
          <Group label="Only in theirs" names={selected.onlyThem} kindOf={kindOf} />
          <Group label="Only in yours" names={selected.onlyYou} kindOf={kindOf} />

          <details className="group" data-testid="full-ingredients">
            <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 text-sm">
              <span className="transition-transform group-open:rotate-90">›</span>
              Full ingredient lists, as printed on each label
            </summary>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <Statement label="Yours" text={productStatement} />
              <Statement label="Theirs" text={selected.statement} />
            </div>
          </details>
        </div>
      </section>

      <p data-testid="source-line" className="text-muted-foreground text-xs">
        Labels: USDA via Orbbit Data · Package images belong to each brand, linked from kroger.com and the brand&apos;s own website
      </p>
    </div>
  )
}

function Statement({ label, text }: { label: string; text: string }) {
  return (
    <div className="grid content-start gap-2">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">{label}</span>
      <p className="bg-muted rounded-2xl p-4 text-sm leading-relaxed">{text}</p>
    </div>
  )
}

function Group({ label, names, kindOf }: { label: string; names: string[]; kindOf: Map<string, IngredientKind> }) {
  return (
    <div className="grid gap-3" data-testid="ingredient-group">
      <h3 className="font-serif text-lg">
        {label} <span className="text-muted-foreground text-base">{names.length}</span>
      </h3>
      {names.length === 0 ? (
        <p className="text-muted-foreground text-sm">None</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,5rem)] gap-x-3 gap-y-3">
          {names.map((name) => (
            <li key={name} title={name} className="grid content-start justify-items-center gap-2 text-center">
              <span className="bg-muted grid size-20 place-items-center rounded-2xl text-3xl" aria-hidden>
                {emojiFor(name, kindOf.get(name) ?? 'other')}
              </span>
              <span className="line-clamp-2 h-8 text-xs leading-4 capitalize">{name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Shot({ image, box, label, fallback }: { image: string | null; box?: ImageBox | null; label: string; fallback?: React.ReactNode }) {
  return (
    <figure className="grid justify-items-center gap-3">
      <span className="relative block aspect-[3/4] w-full">
        {image ? (
          <span className="absolute inset-[6%]">
            <Fitted src={image} box={box ?? null} frameRatio={3 / 4} />
          </span>
        ) : (
          <span className="absolute inset-0 grid place-items-center">{fallback}</span>
        )}
      </span>
      <figcaption className="text-muted-foreground text-xs tracking-wide uppercase">{label}</figcaption>
    </figure>
  )
}

// Scales an image so the package inside it fills the frame, whatever empty space the image has.
function Fitted({ src, box, frameRatio }: { src: string; box: ImageBox | null | undefined; frameRatio: number }) {
  if (!box) {
    // eslint-disable-next-line @next/next/no-img-element -- images are linked from the store or brand, not copied
    return <img src={src} alt="" className="absolute inset-0 h-full w-full object-contain mix-blend-multiply" />
  }
  const place = placeInFrame(box, frameRatio)
  return (
    <span className="absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- images are linked from the store or brand, not copied */}
      <img
        src={src}
        alt=""
        className="absolute max-w-none mix-blend-multiply"
        style={{ width: `${place.width}%`, height: `${place.height}%`, left: `${place.left}%`, top: `${place.top}%` }}
      />
    </span>
  )
}

export type PackShape = 'jar' | 'bag' | 'tub'

// A drawn package with the brand and product name on its label, tinted from the brand name,
// so every product gets the same clean picture without any outside image.
function Package({ shape, competitor, className }: { shape: PackShape; competitor: Competitor; className?: string }) {
  const hue = hueOf(competitor.brand)
  const body = `oklch(0.88 0.05 ${hue})`
  const dark = `oklch(0.42 0.06 ${hue})`
  const label = (
    <span className="grid w-[78%] justify-items-center gap-[1.5cqw] rounded-[3cqw] bg-white/85 px-[4cqw] py-[5cqw] text-center">
      <span className="font-serif text-[7.5cqw] leading-none" style={{ color: dark }}>
        {title(competitor.brand)}
      </span>
      <span className="text-muted-foreground line-clamp-2 text-[3.6cqw] leading-tight">{productTitle(competitor.name)}</span>
    </span>
  )
  return (
    <span className={cn('bg-muted @container grid place-items-center overflow-hidden', className)} aria-hidden>
      {shape === 'jar' && (
        <span className="flex h-[78%] w-[58%] flex-col items-center">
          <span className="h-[14%] w-[84%] rounded-[2.5cqw]" style={{ background: dark }} />
          <span className="h-[4%] w-[78%]" style={{ background: body, filter: 'brightness(0.94)' }} />
          <span className="grid w-full flex-1 place-items-center rounded-[9cqw_9cqw_6cqw_6cqw]" style={{ background: body }}>
            {label}
          </span>
        </span>
      )}
      {shape === 'bag' && (
        <span className="flex h-[82%] w-[56%] flex-col">
          <span className="h-[8%] w-full rounded-t-[2cqw]" style={{ background: dark }} />
          <span className="grid w-full flex-1 place-items-center rounded-b-[7cqw]" style={{ background: body }}>
            {label}
          </span>
        </span>
      )}
      {shape === 'tub' && (
        <span className="flex h-[56%] w-[74%] flex-col items-center">
          <span className="h-[16%] w-full rounded-full" style={{ background: dark }} />
          <span
            className="grid w-[94%] flex-1 place-items-center"
            style={{ background: body, clipPath: 'polygon(0 0, 100% 0, 92% 100%, 8% 100%)', borderRadius: '0 0 6cqw 6cqw' }}
          >
            {label}
          </span>
        </span>
      )}
    </span>
  )
}

const hueOf = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)

// A picture for each ingredient: the first matching word wins, else one per kind.
const EMOJI: [RegExp, string][] = [
  [/cookie/, '🍪'], [/caramel|toffee/, '🍮'], [/brownie|cake/, '🍰'], [/coffee|espresso/, '☕'], [/gum|carrageenan|lecithin|pectin/, '🌱'],
  [/maple/, '🍁'], [/honey/, '🍯'], [/peanut/, '🥜'], [/sunflower/, '🌻'], [/pumpkin/, '🎃'], [/coconut/, '🥥'],
  [/almond|pecan|walnut|cashew|hazelnut|pistachio/, '🌰'], [/sesame|tahini|flax|chia|hemp|seed/, '🌱'],
  [/oat|wheat|barley|rye|flour|grain/, '🌾'], [/rice/, '🍚'], [/corn/, '🌽'], [/chocolate|cocoa/, '🍫'],
  [/blueberr/, '🫐'], [/strawberr|raspberr|cranberr/, '🍓'], [/cherr/, '🍒'], [/raisin|grape/, '🍇'], [/apple/, '🍎'],
  [/banana/, '🍌'], [/lemon|lime|citric/, '🍋'], [/orange/, '🍊'], [/tomato/, '🍅'], [/red pepper|bell pepper/, '🫑'],
  [/chili|cayenne|jalapen/, '🌶️'], [/garlic/, '🧄'], [/onion/, '🧅'], [/carrot/, '🥕'], [/kale|spinach|lettuce/, '🥬'],
  [/chickpea|bean|lentil/, '🫘'], [/olive/, '🫒'], [/butter/, '🧈'], [/cheese/, '🧀'], [/milk|cream|whey|yogurt/, '🥛'],
  [/egg/, '🥚'], [/salt/, '🧂'], [/water/, '💧'], [/vanilla/, '🌼'], [/sugar|syrup|molasses|dextrose|stevia/, '🍬'],
]
const BY_KIND: Record<IngredientKind, string> = {
  grain: '🌾', nut: '🌰', sweetener: '🍬', oil: '🫗', fruit: '🍏', salt: '🧂', spice: '🌿', legume: '🫘', dairy: '🥛', other: '⚪',
}
const emojiFor = (name: string, kind: IngredientKind) => EMOJI.find(([pattern]) => pattern.test(name))?.[1] ?? BY_KIND[kind]

const title = (text: string) => text.toLowerCase().replace(/(^|[\s(&/-])([a-z])/g, (_, before, c) => before + c.toUpperCase())
// USDA names often repeat their parts ("GRANOLA, CINNAMON, RAISIN, CINNAMON, RAISIN").
// USDA names often start with the brand again ("FARR BETTER, FROZEN CUSTARD").
const withoutBrand = (name: string, brand: string) => name.replace(new RegExp(`^${title(brand).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},?\\s*`, 'i'), '')
const productTitle = (text: string) => title([...new Set(text.split(',').map((p) => p.trim()))].join(', '))
