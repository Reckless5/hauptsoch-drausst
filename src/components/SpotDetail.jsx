import { useCallback, useEffect, useState } from 'react'
import { supabase, bustStatus, uploadPhoto } from '../supabase.js'
import { navigate } from '../App.jsx'
import { MiniMap } from './SpotMap.jsx'
import { BustBadge, BustStamp, Hours, KindTag, Tiles, timeAgo } from './bits.jsx'

export default function SpotDetail({ id, user, isAdmin, onRequireLogin, onChanged }) {
  const [spot, setSpot] = useState(null)
  const [notes, setNotes] = useState([])
  const [myRating, setMyRating] = useState(null)
  const [myBust, setMyBust] = useState(null)
  const [status, setStatus] = useState('loading')
  const [noteText, setNoteText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [imgFailed, setImgFailed] = useState(false)
  const [saves, setSaves] = useState([]) // saved_spots rows for this spot I'm allowed to see

  const load = useCallback(async () => {
    const [{ data: s, error }, { data: n }] = await Promise.all([
      supabase.from('spot_overview').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('notes')
        .select('id, body, created_at, user_id, profiles(username)')
        .eq('spot_id', id)
        .order('created_at', { ascending: false }),
    ])
    if (error || !s) return setStatus('missing')
    setSpot(s)
    setNotes(n ?? [])
    setStatus('ready')
  }, [id])

  const loadMine = useCallback(async () => {
    if (!user) {
      setMyRating(null)
      setMyBust(null)
      setSaves([])
      return
    }
    const [{ data: r }, { data: b }] = await Promise.all([
      supabase.from('ratings').select('score').eq('spot_id', id).eq('user_id', user.id).maybeSingle(),
      supabase.from('bust_votes').select('is_bust').eq('spot_id', id).eq('user_id', user.id).maybeSingle(),
    ])
    setMyRating(r?.score ?? null)
    setMyBust(b ? b.is_bust : null)
    const { data: sv } = await supabase.from('saved_spots').select('user_id, list, profiles(username)').eq('spot_id', id)
    setSaves(sv ?? [])
  }, [id, user])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    loadMine()
  }, [loadMine])

  const refresh = async () => {
    await Promise.all([load(), loadMine()])
    onChanged?.()
  }

  const guard = () => {
    if (!user) {
      onRequireLogin()
      return false
    }
    return true
  }

  const fail = (error) => {
    setMsg(error.message)
    setTimeout(() => setMsg(null), 4000)
  }

  async function rate(score) {
    if (!guard()) return
    setBusy(true)
    const { error } =
      myRating === score
        ? await supabase.from('ratings').delete().eq('spot_id', id).eq('user_id', user.id)
        : await supabase
            .from('ratings')
            .upsert({ spot_id: id, user_id: user.id, score, updated_at: new Date().toISOString() })
    setBusy(false)
    if (error) return fail(error)
    refresh()
  }

  async function voteBust(isBust) {
    if (!guard()) return
    setBusy(true)
    const { error } =
      myBust === isBust
        ? await supabase.from('bust_votes').delete().eq('spot_id', id).eq('user_id', user.id)
        : await supabase
            .from('bust_votes')
            .upsert({ spot_id: id, user_id: user.id, is_bust: isBust, updated_at: new Date().toISOString() })
    setBusy(false)
    if (error) return fail(error)
    refresh()
  }

  async function addNote(e) {
    e.preventDefault()
    if (!guard()) return
    const body = noteText.trim()
    if (!body) return
    setBusy(true)
    const { error } = await supabase.from('notes').insert({ spot_id: id, user_id: user.id, body })
    setBusy(false)
    if (error) return fail(error)
    setNoteText('')
    refresh()
  }

  async function deleteNote(noteId) {
    if (!window.confirm('Delete this note?')) return
    const { error } = await supabase.from('notes').delete().eq('id', noteId)
    if (error) return fail(error)
    refresh()
  }

  async function addPhoto(file) {
    if (!file || !guard()) return
    setBusy(true)
    try {
      const url = await uploadPhoto(file, user.id)
      const { error } = await supabase.from('spot_photos').insert({ spot_id: id, user_id: user.id, url })
      if (error) throw error
      setImgFailed(false)
      await refresh()
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  const inList = (list) => saves.some((x) => x.user_id === user?.id && x.list === list)
  async function toggleList(list) {
    if (!guard()) return
    setBusy(true)
    const { error } = inList(list)
      ? await supabase.from('saved_spots').delete().match({ user_id: user.id, spot_id: id, list })
      : await supabase.from('saved_spots').insert({ user_id: user.id, spot_id: id, list })
    setBusy(false)
    if (error) return fail(error)
    loadMine()
  }
  const othersNext = saves.filter((x) => x.list === 'next' && x.user_id !== user?.id).map((x) => x.profiles?.username ?? '?')

  async function deleteSpot() {
    if (!window.confirm(`Delete "${spot.name}" for everyone? Its ratings, notes, photos and bust votes are deleted too. This can't be undone.`)) return
    const { error } = await supabase.from('spots').delete().eq('id', id)
    if (error) return fail(error)
    onChanged?.()
    navigate('/')
  }

  if (status === 'loading') return <main className="detail"><p className="muted">Loading…</p></main>
  if (status === 'missing')
    return (
      <main className="detail">
        <BackLink />
        <h1>Spot not found</h1>
        <p className="muted">It may have been deleted.</p>
      </main>
    )

  const bust = bustStatus(spot)
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`

  return (
    <main className="detail">
      <BackLink />
      <div className="detail-head">
        <KindTag kind={spot.kind} />
        <Tiles as="h1" text={spot.name} className="spot-title" />
        {bust !== 'none' && <div className={`bust-line ${bust}`}>
          <BustBadge spot={spot} />
          <span>
            {Number(spot.bust_yes)} say bust · {Number(spot.bust_no)} say skateable
          </span>
        </div>}
        {spot.description && <p className="desc">{spot.description}</p>}
      </div>
      <div className="detail-grid">
        <div className="detail-media">
          <div className="hero-wrap">
            {spot.cover_url && !imgFailed ? (
              <img
                className="hero"
                src={spot.cover_url}
                alt={spot.name}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className="hero hero-empty">no photo yet</div>
            )}
            <BustStamp spot={spot} />
            <label className={`photo-btn ${busy ? 'busy' : ''}`} onClick={(e) => { if (!user) { e.preventDefault(); onRequireLogin() } }}>
              {busy ? 'Uploading…' : spot.cover_url && !imgFailed ? '+ New photo' : '+ Add photo'}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={busy}
                onChange={(e) => {
                  addPhoto(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          <MiniMap lat={spot.lat} lng={spot.lng} kind={spot.kind} status={bust} className="mini" />
          <a className="link" href={gmaps} target="_blank" rel="noreferrer">
            Directions in Google Maps ↗
          </a>
        </div>

        <div className="detail-info">
          {spot.kind === 'park' && (
            <section className="card">
              <h2>Opening hours</h2>
              <Hours text={spot.opening_hours} />
            </section>
          )}

          {/* BUST FLAG (street spots only) */}
          {bust !== 'none' && <section className={`card bust-card ${bust}`}>
            <div className="row-between">
              <h2>Bust?</h2>
              <BustBadge spot={spot} />
            </div>
            <p className="muted">Was security there last time? Vote so others know.</p>
            <div className="vote-row">
              <button
                disabled={busy}
                className={`btn vote-bust ${myBust === true ? 'on' : ''}`}
                onClick={() => voteBust(true)}
              >
                It's a bust
              </button>
              <button
                disabled={busy}
                className={`btn vote-safe ${myBust === false ? 'on' : ''}`}
                onClick={() => voteBust(false)}
              >
                Skateable
              </button>
            </div>
            {myBust !== null && <p className="hint">Tap your vote again to take it back.</p>}
          </section>}

          {/* MY LISTS */}
          <section className="card save-card">
            <div className="vote-row">
              <button disabled={busy} className={`btn ${inList('favorite') ? 'btn-accent' : ''}`} onClick={() => toggleList('favorite')}>
                {inList('favorite') ? '★ Favorite' : '☆ Favorite'}
              </button>
              <button disabled={busy} className={`btn ${inList('next') ? 'btn-accent' : ''}`} onClick={() => toggleList('next')}>
                {inList('next') ? '✓ Skate next' : '→ Skate next'}
              </button>
            </div>
            {othersNext.length > 0 && (
              <p className="small">
                <b>Your crew wants to skate this:</b> {othersNext.join(', ')}
              </p>
            )}
          </section>

          {/* RATING */}
          <section className="card">
            <div className="row-between">
              <h2>Community rating</h2>
              <div className="big-rating">
                {spot.rating_count > 0 ? (
                  <>
                    <b>{Number(spot.avg_rating).toFixed(1)}</b>
                    <span>/10</span>
                  </>
                ) : (
                  <span className="muted">–</span>
                )}
              </div>
            </div>
            <p className="muted">
              {spot.rating_count > 0
                ? `${spot.rating_count} rating${spot.rating_count === 1 ? '' : 's'}`
                : 'Nobody rated this yet.'}
              {myRating && ` · you gave ${myRating}`}
            </p>
            <div className="rating-scale" role="group" aria-label="Your rating">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  disabled={busy}
                  className={`${myRating === n ? 'on' : ''} ${myRating && n <= myRating ? 'fill' : ''}`}
                  onClick={() => rate(n)}
                  aria-label={`Rate ${n}`}
                >
                  {n}
                </button>
              ))}
            </div>
            {!user && <p className="hint">Log in to rate.</p>}
          </section>

          {/* NOTES */}
          <section className="card">
            <h2>Notes ({notes.length})</h2>
            <form className="note-form" onSubmit={addNote}>
              <textarea
                placeholder={user ? 'Security times, crack in the run-up, wax needed…' : 'Log in to leave a note'}
                value={noteText}
                maxLength={1000}
                onFocus={() => !user && onRequireLogin()}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
              />
              <button className="btn btn-accent" disabled={busy || !noteText.trim()}>
                Post note
              </button>
            </form>
            <ul className="notes">
              {notes.map((n) => (
                <li key={n.id}>
                  <div className="note-meta">
                    <b>{n.profiles?.username ?? 'skater'}</b>
                    <span className="muted">{timeAgo(n.created_at)}</span>
                    {user?.id === n.user_id && (
                      <button className="link danger" onClick={() => deleteNote(n.id)}>
                        delete
                      </button>
                    )}
                  </div>
                  <p>{n.body}</p>
                </li>
              ))}
              {notes.length === 0 && <li className="muted">No notes yet. Be the first.</li>}
            </ul>
          </section>

          <p className="muted small">
            {spot.source === 'viennaskatespots' ? (
              <>
                From the original{' '}
                <a className="link" href="https://viennaskatespots.wordpress.com/" target="_blank" rel="noreferrer">
                  Vienna Spotmap
                </a>
              </>
            ) : spot.source === 'stadt-wien' ? (
              <>Data: Stadt Wien – wien.gv.at (CC BY 4.0)</>
            ) : spot.source === 'openstreetmap' ? (
              <>Data © OpenStreetMap contributors</>
            ) : (
              <>Added {new Date(spot.created_at).toLocaleDateString('de-AT')} by the community</>
            )}
            {spot.photo_credit && <> · Photo: {spot.photo_credit}</>}
            {user && (spot.created_by === user.id || isAdmin) && (
              <>
                {' · '}
                <button className="link danger" onClick={deleteSpot}>
                  {spot.kind === 'park' ? 'delete skatepark' : 'delete spot'}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
      {msg && <div className="toast">{msg}</div>}
    </main>
  )
}

function BackLink() {
  return (
    <a
      href="/"
      className="back link"
      onClick={(e) => {
        e.preventDefault()
        if (window.history.state?.inApp) window.history.back()
        else navigate('/')
      }}
    >
      ← All spots
    </a>
  )
}
