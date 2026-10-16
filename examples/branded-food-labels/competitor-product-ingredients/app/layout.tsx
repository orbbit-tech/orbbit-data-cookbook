import { EB_Garamond } from 'next/font/google'
import './globals.css'

const garamond = EB_Garamond({ subsets: ['latin'], variable: '--font-garamond' })

export const metadata = { title: 'Competitor product ingredients · Orbbit Data Cookbook' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={garamond.variable}>
      <body className="bg-background min-h-screen antialiased">{children}</body>
    </html>
  )
}
