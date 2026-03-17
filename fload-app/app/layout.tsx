import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata = {
  title: 'FLOAT — Yield While You Wait',
  description: 'Put your idle stablecoins to work in YO Protocol vaults. Tell FLOAT what you\'re saving for, and it earns yield until you need it.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-cream min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
