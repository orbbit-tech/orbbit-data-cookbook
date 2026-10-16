import 'server-only'
import { unstable_cache } from 'next/cache'
import sharp from 'sharp'

// Demo only: package images come with different amounts of empty space around the
// package, so the same jar can look big in one and small in another. This finds where
// the package sits in each image (the image itself is not stored or served again), so the
// page can scale every package to fill the same frame.

export type ImageBox = { width: number; height: number; left: number; top: number; contentWidth: number; contentHeight: number }

export async function measureImage(url: string): Promise<ImageBox | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const input = Buffer.from(await res.arrayBuffer())
    const { width = 0, height = 0 } = await sharp(input).metadata()
    const { info } = await sharp(input).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true })
    return {
      width,
      height,
      left: -(info.trimOffsetLeft ?? 0),
      top: -(info.trimOffsetTop ?? 0),
      contentWidth: info.width,
      contentHeight: info.height,
    }
  } catch {
    return null
  }
}

// Where to draw the whole image, in % of the frame, so its package fits the frame and is centred.
export function placeInFrame(box: ImageBox, frameRatio: number) {
  const ratio = box.contentWidth / box.contentHeight
  const contentW = ratio < frameRatio ? (ratio / frameRatio) * 100 : 100 // % of frame width
  const contentH = ratio < frameRatio ? 100 : (frameRatio / ratio) * 100 // % of frame height
  return {
    width: (box.width / box.contentWidth) * contentW,
    height: (box.height / box.contentHeight) * contentH,
    left: (100 - contentW) / 2 - (box.left / box.contentWidth) * contentW,
    top: (100 - contentH) / 2 - (box.top / box.contentHeight) * contentH,
  }
}

export const getCachedImageBox = unstable_cache(measureImage, ['image-box'], { revalidate: 7 * 24 * 60 * 60 })
