import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findImages, imageUrlFor } from './product-images'

describe('imageUrlFor', () => {
  it("turns a barcode into Kroger's image address: drop the check digit, pad to 13 digits", () => {
    expect(imageUrlFor('045300002422')).toBe('https://www.kroger.com/product/images/xlarge/front/0004530000242')
    expect(imageUrlFor('0071018010794')).toBe('https://www.kroger.com/product/images/xlarge/front/0007101801079')
  })
})

describe('findImages', () => {
  const barcodes = Array.from({ length: 25 }, (_, i) => String(100000000000 + i * 10))
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // every third barcode has an image
    fetchMock = vi.fn(async (input: URL | string) => {
      const code = Number(input.toString().split('/').pop())
      return new Response(null, { status: (code - 10000000000) % 3 === 0 ? 200 : 404 })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('checks barcodes 10 at a time in order and stops once it has want images', async () => {
    const images = await findImages(barcodes, { want: 3 })

    expect(Object.keys(images)).toEqual(['100000000000', '100000000030', '100000000060'])
    expect(images['100000000000']).toBe(imageUrlFor('100000000000'))
    expect(fetchMock).toHaveBeenCalledTimes(10)
  })

  it('stops after max checks when too few have images, returning the ones it found', async () => {
    const images = await findImages(barcodes, { want: 5, max: 10 })

    expect(Object.keys(images)).toHaveLength(4)
    expect(fetchMock).toHaveBeenCalledTimes(10)
  })

  it('throws when a check was refused or unreachable and it found fewer than want', async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 429 }))

    await expect(findImages(barcodes, { want: 5 })).rejects.toThrow()
  })
})
