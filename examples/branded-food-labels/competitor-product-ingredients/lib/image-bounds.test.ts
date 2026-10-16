import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { measureImage, placeInFrame } from './image-bounds'

async function pngWithBlock() {
  // 100 x 100 transparent image with a 20 x 40 red block at left 30, top 10
  const block = await sharp({ create: { width: 20, height: 40, channels: 4, background: '#ff0000' } }).png().toBuffer()
  return sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: block, left: 30, top: 10 }])
    .png()
    .toBuffer()
}

describe('measureImage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('finds where the package sits inside the empty space around it', async () => {
    const png = await pngWithBlock()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(png))))

    expect(await measureImage('https://example.com/a.png')).toEqual({ width: 100, height: 100, left: 30, top: 10, contentWidth: 20, contentHeight: 40 })
  })

  it('gives null when the image cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))

    expect(await measureImage('https://example.com/missing.png')).toBeNull()
  })
})

describe('placeInFrame', () => {
  it('scales the image so its package fills the frame, as percentages of the frame', () => {
    // package 20 x 40 (ratio 0.5) in a 3:4 frame (ratio 0.75): the package fills the height and is centred
    const box = { width: 100, height: 100, left: 30, top: 10, contentWidth: 20, contentHeight: 40 }
    const place = placeInFrame(box, 3 / 4)

    expect(place.height).toBeCloseTo(250) // image is 2.5x the package's height
    expect(place.width).toBeCloseTo(333.33) // package spans 66.67% of the frame width, image is 5x that
    expect(place.top).toBeCloseTo(-25)
    expect(place.left).toBeCloseTo(16.67 - 100) // centring gap minus the space left of the package
  })
})
