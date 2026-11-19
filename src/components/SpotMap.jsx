import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { bustStatus } from '../supabase.js'

const VIENNA = [48.2082, 16.3738]
const COLORS = { bust: '#ff4d2e', safe: '#3ddc84', unknown: '#f5c518' }

function tiles(map) {
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    className: 'dark-tiles',
  }).addTo(map)
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/** Overview map with every spot as a coloured dot */
export default function SpotMap({ spots, onSelect, highlightId, className = '' }) {
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const markers = useRef(new Map())
  const fitted = useRef(false)

  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: true }).setView(VIENNA, 12)
    tiles(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    const ro = new ResizeObserver(() => map.current?.invalidateSize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      map.current.remove()
    }
  }, [])

  useEffect(() => {
    layer.current.clearLayers()
    markers.current.clear()
    spots.forEach((s) => {
      const status = bustStatus(s)
      const m = L.circleMarker([s.lat, s.lng], {
        radius: s.kind === 'park' ? 9 : 7,
        color: '#111',
        weight: 2,
        fillColor: COLORS[status],
        fillOpacity: 0.95,
      })
      const rating = s.avg_rating ? `★ ${s.avg_rating}` : 'not rated'
      m.bindTooltip(`<b>${escapeHtml(s.name)}</b><br>${rating}`, { direction: 'top', offset: [0, -6] })
      m.on('click', () => onSelect?.(s))
      m.addTo(layer.current)
      markers.current.set(s.id, m)
    })
    if (!fitted.current && spots.length > 1) {
      // fit to the core Vienna cluster, ignoring far outliers
      map.current.setView(VIENNA, 12)
      fitted.current = true
    }
  }, [spots, onSelect])

  useEffect(() => {
    if (!highlightId) return
    const m = markers.current.get(highlightId)
    if (m) {
      m.setStyle({ color: '#fff', weight: 3 })
      m.bringToFront()
      return () => m.setStyle({ color: '#111', weight: 2 })
    }
  }, [highlightId, spots])

  return <div ref={el} className={`map ${className}`} />
}

/** Small map that marks one spot, or lets you pick a location when onPick is set */
export function MiniMap({ lat, lng, onPick, zoom = 15, className = '' }) {
  const el = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)

  useEffect(() => {
    const start = lat != null && lng != null ? [lat, lng] : VIENNA
    map.current = L.map(el.current, { scrollWheelZoom: !!onPick }).setView(start, lat != null ? zoom : 12)
    tiles(map.current)
    if (onPick) {
      map.current.on('click', (e) => onPick(e.latlng.lat, e.latlng.lng))
    }
    const ro = new ResizeObserver(() => map.current?.invalidateSize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      map.current.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (lat == null || lng == null) return
    if (!marker.current) {
      marker.current = L.circleMarker([lat, lng], {
        radius: 10,
        color: '#fff',
        weight: 3,
        fillColor: '#ff4d2e',
        fillOpacity: 1,
      }).addTo(map.current)
    } else marker.current.setLatLng([lat, lng])
    if (!map.current.getBounds().contains([lat, lng])) map.current.setView([lat, lng], Math.max(map.current.getZoom(), 15))
  }, [lat, lng])

  return <div ref={el} className={`map ${className}`} />
}
