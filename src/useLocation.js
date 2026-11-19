import { useCallback, useEffect, useState } from 'react'

// shared across pages so the position survives navigating to a spot and back
let last = null
let watchId = null
const listeners = new Set()
const emit = (s) => listeners.forEach((fn) => fn(s))
let state = { me: null, locating: false, error: null }

function set(patch) {
  state = { ...state, ...patch }
  emit(state)
}

function start() {
  if (!('geolocation' in navigator)) return set({ error: 'Your browser has no location access.' })
  if (watchId !== null) return
  set({ locating: !last, error: null })
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      last = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }
      set({ me: last, locating: false, error: null })
    },
    (err) => {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
      set({
        locating: false,
        error: err.code === 1 ? 'Location is blocked – allow it in your browser settings.' : "Couldn't get your location.",
      })
    },
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
  )
}

/** live position of the user; asks for permission on first use */
export default function useLocation({ auto = true } = {}) {
  const [s, setS] = useState(state)
  useEffect(() => {
    listeners.add(setS)
    if (auto) start()
    return () => listeners.delete(setS)
  }, [auto])
  const request = useCallback(() => start(), [])
  return { ...s, request }
}

/** distance in metres */
export function distance(a, b) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

export function formatDistance(m) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}
