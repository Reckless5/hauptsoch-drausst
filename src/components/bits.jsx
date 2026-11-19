import { useState } from 'react'
import { BUST_LABEL, bustStatus } from '../supabase.js'

/** text rendered as black letter tiles, like the logo sticker */
export function Tiles({ text, as: Tag = 'span', className = '' }) {
  return (
    <Tag className={`tiles ${className}`} aria-label={text}>
      {text.split(' ').map((word, wi) => (
        <span className="tiles-word" key={wi} aria-hidden="true">
          {[...word].map((ch, i) => (
            <span className="tile" key={i} style={{ '--r': `${(((wi * 7 + i * 13) % 5) - 2) * 0.8}deg` }}>
              {ch}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  )
}

export function BustBadge({ spot, small }) {
  const status = bustStatus(spot)
  if (status === 'none') return null
  return (
    <span className={`bust-badge ${status} ${small ? 'small' : ''}`}>
      {status === 'bust' ? 'BUST!' : status === 'safe' ? 'Skateable' : BUST_LABEL.unknown}
    </span>
  )
}

/** big rubber stamp shown on the spot page */
export function BustStamp({ spot }) {
  const status = bustStatus(spot)
  if (status === 'none') return null
  const yes = Number(spot.bust_yes || 0)
  const no = Number(spot.bust_no || 0)
  const text = status === 'bust' ? 'BUST!' : status === 'safe' ? 'SKATEABLE' : 'NO BUST REPORTS'
  return (
    <div className={`stamp ${status}`} title={`${yes} say bust · ${no} say skateable`}>
      {text}
    </div>
  )
}

export function KindTag({ kind }) {
  return <span className={`kind-tag ${kind}`}>{kind === 'park' ? 'P · Skatepark' : 'S · Street spot'}</span>
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
  if (!src || failed) return <div className="thumb thumb-empty">no pic</div>
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

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/** opening hours as written (OSM style, e.g. "Mo-Su 06:00-22:00; Nov-Mar 07:00-20:00"), one rule per line */
export function Hours({ text }) {
  if (!text) return <p className="muted">No opening hours known yet.</p>
  if (/^24\/7$/.test(text.trim())) return <p><b>Open 24/7</b></p>
  const rules = text.split(';').map((r) => r.trim()).filter(Boolean)
  const today = DAYS[(new Date().getDay() + 6) % 7]
  return (
    <ul className="hours">
      {rules.map((r, i) => {
        const m = r.match(/^([A-Za-z,\- ]+?)\s+(\d.*|off|closed)$/)
        return (
          <li key={i} className={m && dayMatches(m[1], today) ? 'today' : ''}>
            <span>{m ? m[1] : r}</span>
            {m && <span>{m[2]}</span>}
          </li>
        )
      })}
    </ul>
  )
}

function dayMatches(spec, today) {
  const t = DAYS.indexOf(today)
  return spec.split(',').some((part) => {
    const [a, b] = part.trim().split('-').map((d) => DAYS.indexOf(d.slice(0, 2)))
    if (a < 0) return false
    if (b === undefined || b < 0) return a === t
    return a <= b ? t >= a && t <= b : t >= a || t <= b
  })
}
