import { useState } from 'react'
import { BUST_LABEL, bustStatus } from '../supabase.js'

export function BustBadge({ spot, small }) {
  const status = bustStatus(spot)
  return (
    <span className={`bust-badge ${status} ${small ? 'small' : ''}`}>
      {status === 'bust' ? '🚨 ' : status === 'safe' ? '✓ ' : ''}
      {BUST_LABEL[status]}
    </span>
  )
}

export function RatingPill({ avg, count }) {
  if (!count) return <span className="rating-pill none">Not rated</span>
  return (
    <span className="rating-pill">
      <b>{Number(avg).toFixed(1)}</b>/10 <span className="muted">({count})</span>
    </span>
  )
}

export function Thumb({ src, alt }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div className="thumb thumb-empty">🛹</div>
  return <img className="thumb" src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}

export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`
  return new Date(iso).toLocaleDateString('de-AT')
}
