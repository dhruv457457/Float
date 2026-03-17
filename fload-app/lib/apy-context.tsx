'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface VaultAPYData {
  yoUSD: number
  yoETH: number
  yoBTC: number
  loading: boolean
  lastUpdated: Date | null
}

const defaultData: VaultAPYData = {
  yoUSD: 0,
  yoETH: 0,
  yoBTC: 0,
  loading: true,
  lastUpdated: null,
}

const APYContext = createContext<VaultAPYData>(defaultData)

export function useVaultAPYs() {
  return useContext(APYContext)
}

export function APYProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<VaultAPYData>(defaultData)

  useEffect(() => {
    async function fetchAPYs() {
      try {
        const res = await fetch('/api/apys')
        const json = await res.json()
        setData({
          yoUSD: json.yoUSD ?? 0,
          yoETH: json.yoETH ?? 0,
          yoBTC: json.yoBTC ?? 0,
          loading: false,
          lastUpdated: new Date(),
        })
      } catch {
        setData(prev => ({ ...prev, loading: false }))
      }
    }

    fetchAPYs()
    const interval = setInterval(fetchAPYs, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <APYContext.Provider value={data}>
      {children}
    </APYContext.Provider>
  )
}