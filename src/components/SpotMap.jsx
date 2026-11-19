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

const LocateControl = L.Control.extend({
  options: { position: 'topleft' },
  onAdd() {
    const btn = L.DomUtil.create('button', 'locate-btn')
    btn.type = 'button'
    btn.title = 'Center on my location'
    btn.setAttribute('aria-label', 'Center on my location')
    btn.innerHTML = '<span></span>'
    L.DomEvent.disableClickPropagation(btn)
    L.DomEvent.on(btn, 'click', (e) => {
      L.DomEvent.preventDefault(e)
      this.options.onClick?.()
    })
    this._btn = btn
    return btn
  },
  setState(state) {
    if (this._btn) this._btn.dataset.state = state
  },
})

/** Overview map with every spot as a letter tile */
export default function SpotMap({ spots, onSelect, highlightId, me, recenter = 0, onLocate, locating, className = '' }) {
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const markers = useRef(new Map())
  const meLayer = useRef(null)
  const locate = useRef(null)
  const onLocateRef = useRef(onLocate)
  onLocateRef.current = onLocate
  const userMoved = useRef(false)
  const centeredOnce = useRef(false)

  useEffect(() => {
    const start = me ? [me.lat, me.lng] : VIENNA
    map.current = L.map(el.current, { zoomControl: true }).setView(start, me ? 15 : 12)
    centeredOnce.current = !!me
    tiles(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    meLayer.current = L.layerGroup().addTo(map.current)
    locate.current = new LocateControl({ onClick: () => onLocateRef.current?.() }).addTo(map.current)
    map.current.on('dragstart', () => (userMoved.current = true))
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

  // you-are-here marker; center on the first fix unless the user already moved the map
  useEffect(() => {
    meLayer.current.clearLayers()
    if (!me) return
    if (me.accuracy && me.accuracy < 2000)
      L.circle([me.lat, me.lng], { radius: me.accuracy, className: 'me-accuracy', interactive: false }).addTo(meLayer.current)
    L.marker([me.lat, me.lng], {
      icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(meLayer.current)
    if (!centeredOnce.current && !userMoved.current) {
      map.current.setView([me.lat, me.lng], 15)
      centeredOnce.current = true
    }
  }, [me])

  // locate button pressed -> fly to current position
  useEffect(() => {
    if (!recenter || !me) return
    map.current.flyTo([me.lat, me.lng], Math.max(map.current.getZoom(), 15), { duration: 0.6 })
  }, [recenter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    locate.current?.setState(locating ? 'busy' : me ? 'on' : 'off')
  }, [locating, me])

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
    </div>
  )
}
