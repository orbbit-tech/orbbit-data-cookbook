// Writes assets/demo.png from the running demo (npm run dev): the whole page, 16:9, at double resolution.
// Reloads are cached for 12 hours, so this usually costs nothing.
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })
await page.goto(`${process.env.DEMO_URL ?? 'http://localhost:3000'}/items/butter`)
await page.locator('[data-testid="chart"] .recharts-line').first().waitFor()

// Grow the window, keeping 16:9, until the whole page fits.
const height = Math.max(900, await page.evaluate(() => document.documentElement.scrollHeight))
await page.setViewportSize({ width: Math.round((height * 16) / 9), height })
await page.waitForTimeout(2000) // let the lines finish drawing
await page.screenshot({ path: 'assets/demo.png' })
await browser.close()
console.log('Wrote assets/demo.png')
