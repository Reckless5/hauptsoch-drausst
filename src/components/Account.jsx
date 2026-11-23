import { useCallback, useEffect, useState } from 'react'
import { supabase, catOf, deletePhotoFile } from '../supabase.js'
import { navigate } from '../App.jsx'
import { Tiles } from './bits.jsx'

const linkFor = (code) => `${window.location.origin}/?invite=${code}`
const fmtDate = (iso) => new Date(iso).toLocaleDateString('de-AT')

function inviteStatus(i) {
  if (i.use_count >= i.max_uses) return 'full'
  if (new Date(i.expires_at) <= new Date()) return 'expired'
  return 'active'
}

function AdminManager({ user, setError }) {
  const [people, setPeople] = useState([])
  const [q, setQ] = useState('')
  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, username, is_admin, is_superadmin, created_at').order('username')
    setPeople(data ?? [])
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function toggle(p) {
    const make = !p.is_admin
    if (!window.confirm(make ? `Make ${p.username} an admin? Admins can delete any spot and create invite links.` : `Remove admin rights from ${p.username}?`)) return
    const { error } = await supabase.rpc('set_admin', { target: p.id, make_admin: make })
    if (error) setError(error.message)
    load()
  }

  const shown = people.filter((p) => p.username.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <section className="card">
      <div className="row-between">
        <h2>Admins</h2>
        <span className="muted small">{people.filter((p) => p.is_admin).length} admins · {people.length} members</span>
      </div>
      <p className="muted small">Only you (superadmin) can change this. Admins can delete any spot or park and create invite links.</p>
      <input type="search" placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="crew-list">
        {shown.map((p) => (
          <li key={p.id}>
            <span>
              <b>{p.username}</b>{' '}
              {p.is_superadmin ? <span className="tag">Superadmin</span> : p.is_admin ? <span className="tag">Admin</span> : null}
            </span>
            {p.is_superadmin || p.id === user.id ? null : (
              <button className={`btn ${p.is_admin ? '' : 'btn-accent'}`} onClick={() => toggle(p)}>
                {p.is_admin ? 'Remove admin' : 'Make admin'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReviewQueue({ spots, onChange, setError }) {
  const pending = spots.filter((s) => s.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at))
  const [names, setNames] = useState({})
  useEffect(() => {
    const ids = [...new Set(pending.map((s) => s.created_by).filter(Boolean))]
    if (!ids.length) return
    supabase
      .from('profiles')
      .select('id, username')
      .in('id', ids)
      .then(({ data }) => setNames(Object.fromEntries((data ?? []).map((p) => [p.id, p.username]))))
  }, [pending.map((s) => s.id).join()]) // eslint-disable-line react-hooks/exhaustive-deps

  async function approve(s) {
    const { error } = await supabase.from('spots').update({ status: 'approved' }).eq('id', s.id)
    if (error) setError(error.message)
    onChange()
  }
  async function reject(s) {
    if (!window.confirm(`Reject and delete "${s.name}"?`)) return
    const { error } = await supabase.from('spots').delete().eq('id', s.id)
    if (error) setError(error.message)
    onChange()
  }

  return (
    <section className="card">
      <div className="row-between">
        <h2>Spots to review</h2>
        <span className="muted small">{pending.length} waiting</span>
      </div>
      {pending.length === 0 ? (
        <p className="muted">Nothing to review. New spots from members show up here.</p>
      ) : (
        <ul className="invite-table">
          {pending.map((s) => (
            <li key={s.id}>
              <div className="row-between">
                <a
                  href={`/spot/${s.id}`}
                  className="crew-spot"
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(`/spot/${s.id}`)
                  }}
                >
                  <span className="cat-dot" style={{ background: catOf(s).color, color: catOf(s).ink }}>{catOf(s).letter}</span>
                  <b>{s.name}</b>
                </a>
                <span className="muted small">{catOf(s).label}</span>
              </div>
              <div className="muted small">
                by {names[s.created_by] ?? '…'} · {fmtDate(s.created_at)}
                {s.cover_url ? ' · has photo' : ' · no photo'}
              </div>
              {s.description && <div className="small">{s.description}</div>}
              <div className="invite-row-actions">
                <button className="btn btn-accent" onClick={() => approve(s)}>
                  Approve
                </button>
                <button className="link danger" onClick={() => reject(s)}>
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PhotoReview({ onChange, setError }) {
  const [photos, setPhotos] = useState([])
  const [big, setBig] = useState(null)
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('spot_photos')
      .select('id, url, created_at, spot_id, spots(name, status), profiles!user_id(username)')
      .eq('status', 'pending')
      .order('created_at')
    if (error) setError(error.message)
    setPhotos(data ?? [])
  }, [setError])
  useEffect(() => {
    load()
  }, [load])

  async function approve(p) {
    const { error } = await supabase.from('spot_photos').update({ status: 'approved' }).eq('id', p.id)
    if (error) setError(error.message)
    await load()
    onChange?.()
  }
  async function remove(p) {
    if (!window.confirm('Delete this photo?')) return
    const { error } = await supabase.from('spot_photos').delete().eq('id', p.id)
    if (error) return setError(error.message)
    await deletePhotoFile(p.url)
    await load()
    onChange?.()
  }
  async function approveAll() {
    if (!window.confirm(`Approve all ${photos.length} photos?`)) return
    const { error } = await supabase.from('spot_photos').update({ status: 'approved' }).in('id', photos.map((p) => p.id))
    if (error) setError(error.message)
    await load()
    onChange?.()
  }

  return (
    <section className="card">
      <div className="row-between">
        <h2>Photos to review</h2>
        <span className="row-actions">
          <span className="muted small">{photos.length} waiting</span>
          {photos.length > 1 && (
            <button className="link" onClick={approveAll}>
              approve all
            </button>
          )}
        </span>
      </div>
      {photos.length === 0 ? (
        <p className="muted">No photos waiting.</p>
      ) : (
        <ul className="photo-review">
          {photos.map((p) => (
            <li key={p.id}>
              <img src={p.url} alt="" loading="lazy" onClick={() => setBig(p.url)} />
              <div className="pr-body">
                <a
                  href={`/spot/${p.spot_id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(`/spot/${p.spot_id}`)
                  }}
                >
                  <b>{p.spots?.name ?? 'spot'}</b>
                  {p.spots?.status === 'pending' && <span className="muted"> (new spot)</span>}
                </a>
                <span className="muted">
                  by {p.profiles?.username ?? '?'} · {fmtDate(p.created_at)}
                </span>
                <span className="row-actions">
                  <button className="btn btn-accent" onClick={() => approve(p)}>
                    Approve
                  </button>
                  <button className="link danger" onClick={() => remove(p)}>
                    delete
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {big && (
        <div className="viewer" onClick={() => setBig(null)}>
          <img src={big} alt="" />
          <button className="viewer-close" aria-label="Close">
            ×
          </button>
        </div>
      )}
    </section>
  )
}

export default function Account({ user, profile, spots = [], onSpotsChange, onProfileChange, onRequireLogin }) {
  const [username, setUsername] = useState(profile?.username ?? '')
  const [saved, setSaved] = useState(false)
  const [invites, setInvites] = useState([])
  const [joined, setJoined] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => setUsername(profile?.username ?? ''), [profile?.username])

  const load = useCallback(async () => {
    if (!profile?.is_admin) return
    const [{ data: inv }, { data: uses }] = await Promise.all([
      supabase
        .from('invites')
        .select('code, created_at, expires_at, max_uses, use_count')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('invite_uses')
        .select('code, used_at, profiles:profiles!user_id(username)')
        .eq('invited_by', user.id)
        .order('used_at', { ascending: false }),
    ])
    setInvites(inv ?? [])
    setJoined(uses ?? [])
  }, [user?.id, profile?.is_admin])

  useEffect(() => {
    load()
  }, [load])

  if (!user)
    return (
      <main className="detail narrow">
        <Tiles as="h1" text="ACCOUNT" />
        <p>Log in to see your account.</p>
        <button className="btn btn-accent" onClick={onRequireLogin}>
          Log in
        </button>
      </main>
    )

  async function saveName(e) {
    e.preventDefault()
    const name = username.trim()
    if (!name || name === profile?.username) return
    setError(null)
    const { error } = await supabase.from('profiles').update({ username: name }).eq('id', user.id)
    if (error) return setError(error.message)
    onProfileChange?.()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function create(group) {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_invite', group ? { max_uses: 50, valid_days: 30 } : {})
    setBusy(false)
    if (error) return setError(error.message)
    await load()
    copy(data)
  }

  async function remove(code) {
    if (!window.confirm('Delete this invite link? Nobody new can sign up with it. People who already joined keep their accounts.')) return
    const { error } = await supabase.from('invites').delete().eq('code', code)
    if (error) return setError(error.message)
    load()
  }

  async function copy(code) {
    try {
      await navigator.clipboard.writeText(linkFor(code))
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* clipboard blocked – the link is shown to copy by hand */
    }
  }

  const byCode = joined.reduce((m, j) => ((m[j.code] ??= []).push(j.profiles?.username ?? '?'), m), {})
  const totalJoined = joined.length

  return (
    <main className="detail narrow account">
      <a
        href="/"
        className="back link"
        onClick={(e) => {
          e.preventDefault()
          navigate('/')
        }}
      >
        ← All spots
      </a>
      <Tiles as="h1" text="ACCOUNT" />

      <section className="card">
        <h2>Profile</h2>
        <form className="name-form" onSubmit={saveName}>
          <label>
            Username
            <input value={username} maxLength={30} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <button className="btn" disabled={!username.trim() || username.trim() === profile?.username}>
            {saved ? 'Saved' : 'Save'}
          </button>
        </form>
        <p className="muted small">
          {user.email} · {profile?.is_superadmin ? 'Superadmin' : profile?.is_admin ? 'Admin' : 'Member'}
        </p>
        <button className="link" onClick={() => supabase.auth.signOut().then(() => navigate('/'))}>
          Log out
        </button>
      </section>

      {profile?.is_admin && <ReviewQueue spots={spots} onChange={onSpotsChange} setError={setError} />}
      {profile?.is_admin && <PhotoReview onChange={onSpotsChange} setError={setError} />}

      {profile?.is_superadmin && <AdminManager user={user} setError={setError} />}

      {profile?.is_admin && (
        <section className="card">
          <div className="row-between">
            <h2>Invite links</h2>
            <span className="muted small">{totalJoined} joined via your links</span>
          </div>
          <p className="muted small">Personal: 1 person, 14 days. Group: up to 50 people, 30 days.</p>
          <div className="invite-actions">
            <button className="btn btn-accent" onClick={() => create(false)} disabled={busy}>
              + Personal link
            </button>
            <button className="btn" onClick={() => create(true)} disabled={busy}>
              + Group link
            </button>
          </div>
          {error && <div className="banner error">{error}</div>}

          <ul className="invite-table">
            {invites.map((i) => {
              const status = inviteStatus(i)
              const names = byCode[i.code] ?? []
              return (
                <li key={i.code} className={status}>
                  <div className="row-between">
                    <div className="invite-head">
                      <b>{i.code}</b>
                      <span className="tag">{i.max_uses > 1 ? 'Group' : 'Personal'}</span>
                      <span className={`inv-status ${status}`}>{status}</span>
                    </div>
                    <b className="uses">
                      {i.use_count}/{i.max_uses} used
                    </b>
                  </div>
                  <div className="muted small">
                    Created {fmtDate(i.created_at)} · {status === 'expired' ? 'expired' : 'valid until'} {fmtDate(i.expires_at)}
                  </div>
                  {names.length > 0 && <div className="small">Joined: {names.join(', ')}</div>}
                  <div className="invite-row-actions">
                    {status === 'active' && (
                      <button className="link" onClick={() => copy(i.code)}>
                        {copied === i.code ? 'Copied!' : 'Copy link'}
                      </button>
                    )}
                    <button className="link danger" onClick={() => remove(i.code)}>
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
            {invites.length === 0 && <li className="muted">No invite links yet.</li>}
          </ul>
        </section>
      )}
    </main>
  )
}
