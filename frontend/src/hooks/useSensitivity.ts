import { useCallback, useState } from 'react'

export type Density = 'low' | 'mid' | 'high'

// Mirrors PREFERENCE_THRESHOLDS in backend/app/config.py.
export const DENSITY_THRESHOLDS: Record<Density, number> = {
  low: 250,
  mid: 500,
  high: 1000,
}

const STORAGE_KEY = 'hushway.density'

function readStored(): Density {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'low' || stored === 'mid' || stored === 'high' ? stored : 'mid'
}

/** Crowd preference, persisted across sessions (US 1.3 AC1). */
export function useSensitivity() {
  const [density, setDensityState] = useState<Density>(readStored)

  const setDensity = useCallback((next: Density) => {
    setDensityState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  return { density, setDensity, threshold: DENSITY_THRESHOLDS[density] }
}
