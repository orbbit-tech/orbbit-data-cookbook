// Writes assets/demo.png from the running demo (npm run dev): the page content, cropped to 16:9, at double resolution.
// Reloads are cached for 7 days, so this usually costs nothing.
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })
await page.goto(`${process.env.DEMO_URL ?? 'http://localhost:3000'}/products/peanut-butter`)
await page.locator('[data-testid="competitor-row"]').first().waitFor()
await page.waitForFunction(() => [...document.images].every((img) => img.complete)) // package images

// Crop to the content at 16:9, with a small margin, instead of the whole wide window.
await page.waitForTimeout(500)
const box = await page.evaluate(() => {
  const r = document.querySelector('main')!.getBoundingClientRect()
  const top = document.querySelector('header')!.getBoundingClientRect().top
  return { x: r.left, y: top, width: r.width, height: r.bottom - top }
})
const margin = 32
let width = box.width + margin * 2
let height = box.height + margin
if (width / height < 16 / 9) width = Math.min(1600, (height * 16) / 9)
height = (width * 9) / 16
await page.setViewportSize({ width: 1600, height: Math.ceil(box.y + height + 50) })
const x = Math.max(0, box.x + box.width / 2 - width / 2)
await page.screenshot({ path: 'assets/demo.png', clip: { x, y: Math.max(0, box.y - margin / 2), width, height } })
await browser.close()
console.log('Wrote assets/demo.png')
