import './globals.css'

export const metadata = { title: 'Market benchmark · Orbbit Data Cookbook' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-muted/40 min-h-screen antialiased">{children}</body>
    </html>
  )
}
