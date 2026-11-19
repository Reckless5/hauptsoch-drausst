import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../App.jsx'
import { bustStatus, CATEGORIES, catOf } from '../supabase.js'
import SpotMap from './SpotMap.jsx'
import { BustBadge, RatingPill, Thumb } from './bits.jsx'
import useLocation, { distance, formatDistance } from '../useLocation.js'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'spot', label: 'Street spots' },
  { id: 'park', label: 'Skateparks' },
  { id: 'safe', label: 'Not bust' },
  { id: 'bust', label: 'Bust' },
]

const SORTS = [
  { id: 'near', label: 'Nearby' },
  { id: 'name', label: 'A–Z' },
  { id: 'rating', label: 'Top rated' },
  { id: 'new', label: 'Newest' },
]

// survives navigating to a spot and back
const saved = { q: '', filter: 'all', sort: 'near', view: 'map', cat: null, legendOpen: typeof window !== 'undefined' && window.innerWidth > 820 }

export default function Overview({ spots, loading }) {
  const [q, setQ] = useState(saved.q)
  const [filter, setFilter] = useState(saved.filter)
  const [sort, setSort] = useState(saved.sort)
  const [view, setView] = useState(saved.view) // mobile only
  const [hover, setHover] = useState(null)
  const [cat, setCat] = useState(saved.cat) // category picked in the legend
  const [legendOpen, setLegendOpen] = useState(saved.legendOpen)
  const [recenter, setRecenter] = useState(0)
  const { me, locating, error: locError, request } = useLocation()
  Object.assign(saved, { q, filter, sort, view, cat, legendOpen })

  // locate button: center now if we know where you are, otherwise once the first fix arrives
  const wantCenter = useRef(false)
  const [showLocError, setShowLocError] = useState(false)
  useEffect(() => {
    if (!showLocError) return
    const t = setTimeout(() => setShowLocError(false), 5000)
    return () => clearTimeout(t)
  }, [showLocError])
  const onLocate = useCallback(() => {
    setShowLocError(true)
    if (me) setRecenter((n) => n + 1)
    else {
      wantCenter.current = true
      request()
    }
  }, [me, request])
  useEffect(() => {
    if (me && wantCenter.current) {
      wantCenter.current = false
      setRecenter((n) => n + 1)
    }
  }, [me])

  const sortBy = sort === 'near' && !me ? 'name' : sort

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = spots.filter((s) => {
      if (needle && !`${s.name} ${s.description ?? ''}`.toLowerCase().includes(needle)) return false
      if (cat && s.category !== cat) return false
      if (filter === 'spot' || filter === 'park') return s.kind === filter
      if (filter === 'bust' || filter === 'safe') return bustStatus(s) === filter
      return true
    })
    if (sortBy === 'near') list = list.map((x) => ({ ...x, _d: distance(me, x) })).sort((a, b) => a._d - b._d)
    else if (sortBy === 'rating')
      list = [...list].sort((a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1) || b.rating_count - a.rating_count)
    else if (sortBy === 'new') list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))
    return list
  }, [spots, q, filter, sortBy, me, cat])

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
              {sortBy === 'near' && ' · closest first'}
            </span>
            <div className="sort">
              {SORTS.filter((s) => s.id !== 'near' || me).map((s) => (
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
                    <span className="cat-dot" style={{ background: catOf(s).color, color: catOf(s).ink }} title={catOf(s).label}>
                      {catOf(s).letter}
                    </span>
                    {s.status === 'pending' && <span className="tag">in review</span>}
                    {me && <span className="dist">{formatDistance(s._d ?? distance(me, s))}</span>}
                  </div>
                  {s.description && <p className="spot-row-desc">{s.description}</p>}
                  <div className="spot-row-meta">
                    <RatingPill avg={s.avg_rating} count={s.rating_count} />
                    <BustBadge spot={s} small />
                    {s.note_count > 0 && <span className="muted">{s.note_count} note{s.note_count === 1 ? '' : 's'}</span>}
                  </div>
                </div>
              </a>
            </li>
          ))}
          {!loading && shown.length === 0 && <li className="empty">No spots match. Found one? Add it!</li>}
        </ul>
      </section>

      <section className="map-panel">
        <SpotMap
          spots={shown}
          onSelect={open}
          highlightId={hover}
          me={me}
          recenter={recenter}
          onLocate={onLocate}
          locating={locating}
        />
        {locError && showLocError && <div className="loc-error">{locError}</div>}
        <div className="map-filter" role="group" aria-label="Show">
          {[
            { id: 'all', label: 'All' },
            { id: 'spot', label: 'S', title: 'Street spots' },
            { id: 'park', label: 'P', title: 'Skateparks' },
          ].map((f) => (
            <button
              key={f.id}
              title={f.title}
              className={`mf-${f.id} ${filter === f.id ? 'on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              {f.title && <span>{f.title}</span>}
            </button>
          ))}
        </div>
        <div className={`legend ${legendOpen ? 'open' : ''}`}>
          <button className="legend-head" onClick={() => setLegendOpen(!legendOpen)} aria-expanded={legendOpen}>
            {cat ? `Only: ${catOf({ category: cat }).label}` : 'Legend'} <span>{legendOpen ? '–' : '+'}</span>
          </button>
          {legendOpen && (
            <ul>
              {CATEGORIES.map((c) => (
                <li key={c.id}>
                  <button
                    className={cat === c.id ? 'on' : cat ? 'dim' : ''}
                    onClick={() => setCat(cat === c.id ? null : c.id)}
                    title={cat === c.id ? 'Show all' : `Only show ${c.label}`}
                  >
                    <b className="pin" style={{ background: c.color, color: c.ink }}>{c.letter}</b>
                    {c.label}
                  </button>
                </li>
              ))}
              <li className="legend-bust">
                <b className="pin pin-bust" style={{ background: '#fff', color: '#111' }}>L<i>!</i></b>
                Bust
              </li>
              {cat && (
                <li>
                  <button className="link" onClick={() => setCat(null)}>
                    show all
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </section>

      <div className="view-toggle">
        <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>
          Map
        </button>
        <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
          List
        </button>
      </div>
    </main>
  )
}
