import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { bustStatus } from '../supabase.js'

const VIENNA = [48.2082, 16.3738]

function tiles(map) {
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    className: 'ink-tiles',
  }).addTo(map)
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/** letter-tile marker: S = street spot (black tile), P = skatepark (white tile); red when bust */
export function pinIcon(kind, status, extra = '') {
  const letter = kind === 'park' ? 'P' : 'S'
  return L.divIcon({
    className: '',
    html: `<div class="pin pin-${kind} pin-${status} ${extra}">${letter}${status === 'bust' ? '<i>!</i>' : ''}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    tooltipAnchor: [0, -14],
  })
}

/** Overview map with every spot as a letter tile */
export default function SpotMap({ spots, onSelect, highlightId, className = '' }) {
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const markers = useRef(new Map())

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
      const m = L.marker([s.lat, s.lng], {
        icon: pinIcon(s.kind, status),
        riseOnHover: true,
        zIndexOffset: s.kind === 'park' ? 100 : 0,
      })
      const rating = s.avg_rating ? `${s.avg_rating}/10` : 'not rated'
      const bust = status === 'bust' ? ' · <b class="tt-bust">BUST!</b>' : ''
      m.bindTooltip(`<b>${escapeHtml(s.name)}</b><br>${s.kind === 'park' ? 'Skatepark' : 'Street spot'} · ${rating}${bust}`, {
        direction: 'top',
        className: 'ink-tooltip',
      })
      m.on('click', () => onSelect?.(s))
      m.addTo(layer.current)
      markers.current.set(s.id, m)
    })
  }, [spots, onSelect])

  useEffect(() => {
    if (!highlightId) return
    const el = markers.current.get(highlightId)?.getElement()?.firstChild
    if (!el) return
    el.classList.add('pin-hi')
    return () => el.classList.remove('pin-hi')
  }, [highlightId, spots])

  return (
    <div className={`map-wrap ${className}`}>
      <div ref={el} className="map" />
      <div className="map-grain" />
    </div>
  )
}

/** Small map that marks one spot, or lets you pick a location when onPick is set */
export function MiniMap({ lat, lng, kind = 'spot', status = 'unknown', onPick, zoom = 15, className = '' }) {
  const el = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)

  useEffect(() => {
    const start = lat != null && lng != null ? [lat, lng] : VIENNA
    map.current = L.map(el.current, { scrollWheelZoom: !!onPick }).setView(start, lat != null ? zoom : 12)
    tiles(map.current)
    if (onPick) map.current.on('click', (e) => onPick(e.latlng.lat, e.latlng.lng))
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
    const icon = pinIcon(kind, status, 'pin-big')
    if (!marker.current) marker.current = L.marker([lat, lng], { icon }).addTo(map.current)
    else {
      marker.current.setLatLng([lat, lng])
      marker.current.setIcon(icon)
    }
    if (!map.current.getBounds().contains([lat, lng])) map.current.setView([lat, lng], Math.max(map.current.getZoom(), 15))
  }, [lat, lng, kind, status])

  return (
    <div className={`map-wrap ${className}`}>
      <div ref={el} className="map" />
      <div className="map-grain" />
    </div>
  )
}
