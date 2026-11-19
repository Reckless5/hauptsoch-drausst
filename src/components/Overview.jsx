import { useCallback, useMemo, useState } from 'react'
import { navigate } from '../App.jsx'
import { bustStatus } from '../supabase.js'
import SpotMap from './SpotMap.jsx'
import { BustBadge, RatingPill, Thumb } from './bits.jsx'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'spot', label: 'Street spots' },
  { id: 'park', label: 'Skateparks' },
  { id: 'safe', label: 'Skateable' },
  { id: 'bust', label: 'Bust' },
]

const SORTS = [
  { id: 'name', label: 'A–Z' },
  { id: 'rating', label: 'Top rated' },
  { id: 'new', label: 'Newest' },
]

// survives navigating to a spot and back
const saved = { q: '', filter: 'all', sort: 'name', view: 'list' }

export default function Overview({ spots, loading }) {
  const [q, setQ] = useState(saved.q)
  const [filter, setFilter] = useState(saved.filter)
  const [sort, setSort] = useState(saved.sort)
  const [view, setView] = useState(saved.view) // mobile only
  const [hover, setHover] = useState(null)
  Object.assign(saved, { q, filter, sort, view })

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = spots.filter((s) => {
      if (needle && !`${s.name} ${s.description ?? ''}`.toLowerCase().includes(needle)) return false
      if (filter === 'spot' || filter === 'park') return s.kind === filter
      if (filter === 'bust' || filter === 'safe') return bustStatus(s) === filter
      return true
    })
    if (sort === 'rating')
      list = [...list].sort((a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1) || b.rating_count - a.rating_count)
    else if (sort === 'new') list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))
    return list
  }, [spots, q, filter, sort])

  const open = useCallback((s) => navigate(`/spot/${s.id}`), [])

  return (
    <main className={`overview view-${view}`}>
      <section className="panel">
        <div className="controls">
          <input
            className="search"
            type="search"
            placeholder="Search spots – ledge, rail, Prater…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="chips">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`chip ${filter === f.id ? 'on' : ''} chip-${f.id}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="row-between">
            <span className="muted">
              {loading ? 'Loading spots…' : `${shown.length} of ${spots.length} spots`}
            </span>
            <div className="sort">
              {SORTS.map((s) => (
                <button key={s.id} className={`link ${sort === s.id ? 'on' : ''}`} onClick={() => setSort(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <ul className="spot-list">
          {shown.map((s) => (
            <li key={s.id}>
              <a
                href={`/spot/${s.id}`}
                className="spot-row"
                onClick={(e) => {
                  e.preventDefault()
                  open(s)
                }}
                onMouseEnter={() => setHover(s.id)}
                onMouseLeave={() => setHover(null)}
              >
                <Thumb src={s.cover_url} alt={s.name} />
                <div className="spot-row-body">
                  <div className="spot-row-title">
                    <strong>{s.name}</strong>
                    {s.kind === 'park' && <span className="tag">Park</span>}
                  </div>
                  {s.description && <p className="spot-row-desc">{s.description}</p>}
                  <div className="spot-row-meta">
                    <RatingPill avg={s.avg_rating} count={s.rating_count} />
                    <BustBadge spot={s} small />
                    {s.note_count > 0 && <span className="muted">💬 {s.note_count}</span>}
                  </div>
                </div>
              </a>
            </li>
          ))}
          {!loading && shown.length === 0 && <li className="empty">No spots match. Found one? Add it!</li>}
        </ul>
      </section>

      <section className="map-panel">
        <SpotMap spots={shown} onSelect={open} highlightId={hover} />
        <div className="legend">
          <span><i style={{ background: '#3ddc84' }} /> Skateable</span>
          <span><i style={{ background: '#ff4d2e' }} /> Bust</span>
          <span><i style={{ background: '#f5c518' }} /> No reports</span>
        </div>
      </section>

      <div className="view-toggle">
        <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
          List
        </button>
        <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>
          Map
        </button>
      </div>
    </main>
  )
}
