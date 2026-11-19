import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { navigate } from '../App.jsx'
import { Tiles } from './bits.jsx'

const TABS = [
  { id: 'lists', label: 'My lists' },
  { id: 'friends', label: 'Friends' },
  { id: 'crews', label: 'Crews' },
]

function SpotLink({ spot, children }) {
  if (!spot) return <span className="muted">deleted spot</span>
  return (
    <a
      href={`/spot/${spot.id}`}
      className="crew-spot"
      onClick={(e) => {
        e.preventDefault()
        navigate(`/spot/${spot.id}`)
      }}
    >
      <span className={`kind-dot ${spot.kind}`}>{spot.kind === 'park' ? 'P' : 'S'}</span>
      <b>{spot.name}</b>
      {children}
    </a>
  )
}

export default function Crew({ user, spots, onRequireLogin }) {
  const [tab, setTab] = useState(() => sessionStorage.getItem('crewTab') || 'lists')
  const [saved, setSaved] = useState([]) // everything visible: mine + friends + crews
  const [friendships, setFriendships] = useState([])
  const [crews, setCrews] = useState([])
  const [members, setMembers] = useState([])
  const [error, setError] = useState(null)
  const byId = useMemo(() => Object.fromEntries(spots.map((s) => [s.id, s])), [spots])

  useEffect(() => {
    try {
      sessionStorage.setItem('crewTab', tab)
    } catch {
      /* ignore */
    }
  }, [tab])

  const load = useCallback(async () => {
    if (!user) return
    const [s, f, c, m] = await Promise.all([
      supabase.from('saved_spots').select('user_id, spot_id, list, created_at, profiles(username)').order('created_at', { ascending: false }),
      supabase
        .from('friendships')
        .select('requester, addressee, status, created_at, req:profiles!requester(username), adr:profiles!addressee(username)'),
      supabase.from('crews').select('id, name, created_by, created_at').order('created_at'),
      supabase.from('crew_members').select('crew_id, user_id, profiles:profiles!user_id(username)'),
    ])
    const err = s.error || f.error || c.error || m.error
    if (err) setError(err.message)
    setSaved(s.data ?? [])
    setFriendships(f.data ?? [])
    setCrews(c.data ?? [])
    setMembers(m.data ?? [])
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  if (!user)
    return (
      <main className="detail narrow">
        <Tiles as="h1" text="CREW" />
        <p>Log in to save spots, add friends and build crews.</p>
        <button className="btn btn-accent" onClick={onRequireLogin}>
          Log in
        </button>
      </main>
    )

  const friends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => (f.requester === user.id ? { id: f.addressee, username: f.adr?.username } : { id: f.requester, username: f.req?.username }))
  const incoming = friendships.filter((f) => f.status === 'pending' && f.addressee === user.id)
  const outgoing = friendships.filter((f) => f.status === 'pending' && f.requester === user.id)

  return (
    <main className="detail narrow crew-page">
      <Tiles as="h1" text="CREW" />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'friends' && incoming.length > 0 && <i className="badge">{incoming.length}</i>}
          </button>
        ))}
      </div>
      {error && <div className="banner error">{error}</div>}

      {tab === 'lists' && <MyLists user={user} saved={saved} byId={byId} onChange={load} />}
      {tab === 'friends' && (
        <Friends user={user} friends={friends} incoming={incoming} outgoing={outgoing} saved={saved} byId={byId} onChange={load} setError={setError} />
      )}
      {tab === 'crews' && (
        <Crews user={user} crews={crews} members={members} friends={friends} saved={saved} byId={byId} onChange={load} setError={setError} />
      )}
    </main>
  )
}

function MyLists({ user, saved, byId, onChange }) {
  const mine = saved.filter((s) => s.user_id === user.id)
  const remove = async (s) => {
    await supabase.from('saved_spots').delete().match({ user_id: user.id, spot_id: s.spot_id, list: s.list })
    onChange()
  }
  return (
    <>
      {[
        { list: 'next', title: 'Skate next', empty: 'Tap "Skate next" on a spot to plan your next session.' },
        { list: 'favorite', title: 'Favorites', empty: 'Tap "Favorite" on a spot to keep it here.' },
      ].map(({ list, title, empty }) => {
        const items = mine.filter((s) => s.list === list)
        return (
          <section className="card" key={list}>
            <h2>
              {title} ({items.length})
            </h2>
            {items.length === 0 ? (
              <p className="muted">{empty}</p>
            ) : (
              <ul className="crew-list">
                {items.map((s) => (
                  <li key={s.spot_id}>
                    <SpotLink spot={byId[s.spot_id]} />
                    <button className="link" onClick={() => remove(s)}>
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </>
  )
}

function Friends({ user, friends, incoming, outgoing, saved, byId, onChange, setError }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return setResults([])
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `%${term.replace(/[%_]/g, '')}%`)
        .neq('id', user.id)
        .limit(8)
      setResults(data ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [q, user.id])

  const known = new Set([...friends.map((f) => f.id), ...incoming.map((f) => f.requester), ...outgoing.map((f) => f.addressee)])

  async function add(id) {
    const { error } = await supabase.from('friendships').insert({ requester: user.id, addressee: id })
    if (error) setError(error.message.includes('duplicate') ? 'You already have a request with this person.' : error.message)
    onChange()
  }
  async function accept(f) {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).match({ requester: f.requester, addressee: user.id })
    if (error) setError(error.message)
    onChange()
  }
  async function remove(a, b, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return
    await supabase.from('friendships').delete().match({ requester: a, addressee: b })
    await supabase.from('friendships').delete().match({ requester: b, addressee: a })
    onChange()
  }

  return (
    <>
      <section className="card">
        <h2>Add friends</h2>
        <input type="search" placeholder="Search by username" value={q} onChange={(e) => setQ(e.target.value)} />
        {results.length > 0 && (
          <ul className="crew-list">
            {results.map((p) => (
              <li key={p.id}>
                <b>{p.username}</b>
                {known.has(p.id) ? (
                  <span className="muted small">already added</span>
                ) : (
                  <button className="btn" onClick={() => add(p.id)}>
                    + Add
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {q.trim().length >= 2 && results.length === 0 && <p className="muted small">Nobody found.</p>}
      </section>

      {incoming.length > 0 && (
        <section className="card">
          <h2>Requests</h2>
          <ul className="crew-list">
            {incoming.map((f) => (
              <li key={f.requester}>
                <b>{f.req?.username}</b>
                <span className="row-actions">
                  <button className="btn btn-accent" onClick={() => accept(f)}>
                    Accept
                  </button>
                  <button className="link" onClick={() => remove(f.requester, user.id)}>
                    decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Friends ({friends.length})</h2>
        {friends.length === 0 && <p className="muted">No friends yet – search for someone above.</p>}
        <ul className="friend-cards">
          {friends.map((f) => {
            const next = saved.filter((s) => s.user_id === f.id && s.list === 'next')
            return (
              <li key={f.id}>
                <div className="row-between">
                  <b>{f.username}</b>
                  <button className="link danger" onClick={() => remove(user.id, f.id, `Remove ${f.username} as a friend?`)}>
                    remove
                  </button>
                </div>
                {next.length === 0 ? (
                  <p className="muted small">Nothing on their skate-next list.</p>
                ) : (
                  <>
                    <p className="small">Wants to skate next:</p>
                    <ul className="crew-list compact">
                      {next.map((s) => (
                        <li key={s.spot_id}>
                          <SpotLink spot={byId[s.spot_id]} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            )
          })}
        </ul>
        {outgoing.length > 0 && (
          <p className="muted small">
            Waiting for: {outgoing.map((f) => f.adr?.username).join(', ')}
          </p>
        )}
      </section>
    </>
  )
}

function Crews({ user, crews, members, friends, saved, byId, onChange, setError }) {
  const [name, setName] = useState('')
  const [open, setOpen] = useState(() => crews[0]?.id ?? null)
  useEffect(() => {
    if (!open && crews[0]) setOpen(crews[0].id)
  }, [crews, open])

  async function create(e) {
    e.preventDefault()
    if (!name.trim()) return
    const { data, error } = await supabase.from('crews').insert({ name: name.trim(), created_by: user.id }).select('id').single()
    if (error) return setError(error.message)
    setName('')
    setOpen(data.id)
    onChange()
  }

  return (
    <>
      <section className="card">
        <h2>New crew</h2>
        <form className="name-form" onSubmit={create}>
          <input placeholder="Crew name, e.g. Donnerstag Session" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-accent" disabled={!name.trim()}>
            Create
          </button>
        </form>
      </section>

      {crews.length === 0 && <p className="muted">No crews yet. Create one and add your friends.</p>}

      {crews.map((c) => (
        <CrewCard
          key={c.id}
          crew={c}
          user={user}
          open={open === c.id}
          onToggle={() => setOpen(open === c.id ? null : c.id)}
          members={members.filter((m) => m.crew_id === c.id)}
          friends={friends}
          saved={saved}
          byId={byId}
          onChange={onChange}
          setError={setError}
        />
      ))}
    </>
  )
}

function CrewCard({ crew, user, open, onToggle, members, friends, saved, byId, onChange, setError }) {
  const [pick, setPick] = useState('')
  const memberIds = new Set(members.map((m) => m.user_id))
  const addable = friends.filter((f) => !memberIds.has(f.id))
  const isOwner = crew.created_by === user.id

  // combined skate-next list: spots wanted by most crew members first
  const plan = useMemo(() => {
    const m = new Map()
    saved
      .filter((s) => s.list === 'next' && memberIds.has(s.user_id))
      .forEach((s) => {
        const e = m.get(s.spot_id) ?? { spot_id: s.spot_id, who: [] }
        e.who.push(s.user_id === user.id ? 'you' : s.profiles?.username ?? '?')
        m.set(s.spot_id, e)
      })
    return [...m.values()].sort((a, b) => b.who.length - a.who.length)
  }, [saved, members, user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addMember() {
    if (!pick) return
    const { error } = await supabase.from('crew_members').insert({ crew_id: crew.id, user_id: pick, added_by: user.id })
    if (error) setError(error.message)
    setPick('')
    onChange()
  }
  async function removeMember(id, label) {
    if (!window.confirm(label)) return
    const { error } = await supabase.from('crew_members').delete().match({ crew_id: crew.id, user_id: id })
    if (error) setError(error.message)
    onChange()
  }
  async function deleteCrew() {
    if (!window.confirm(`Delete the crew "${crew.name}" for everyone?`)) return
    const { error } = await supabase.from('crews').delete().eq('id', crew.id)
    if (error) setError(error.message)
    onChange()
  }

  return (
    <section className="card crew-card">
      <button className="crew-toggle" onClick={onToggle} aria-expanded={open}>
        <h2>{crew.name}</h2>
        <span className="muted small">
          {members.length} member{members.length === 1 ? '' : 's'} · {plan.length} spot{plan.length === 1 ? '' : 's'} planned
        </span>
      </button>
      {open && (
        <>
          <div>
            <p className="small">
              <b>Skate next</b>
            </p>
            {plan.length === 0 ? (
              <p className="muted small">Nobody in this crew has a skate-next spot yet.</p>
            ) : (
              <ul className="crew-list">
                {plan.map((p) => (
                  <li key={p.spot_id}>
                    <SpotLink spot={byId[p.spot_id]} />
                    <span className="who">
                      <b>{p.who.length}</b> {p.who.join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="small">
              <b>Members</b>
            </p>
            <ul className="chips member-chips">
              {members.map((m) => (
                <li key={m.user_id} className="chip">
                  {m.user_id === user.id ? 'you' : m.profiles?.username}
                  {isOwner && m.user_id !== user.id && (
                    <button aria-label="Remove" onClick={() => removeMember(m.user_id, `Remove ${m.profiles?.username} from ${crew.name}?`)}>
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {addable.length > 0 ? (
              <div className="name-form">
                <select value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Add a friend…</option>
                  {addable.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.username}
                    </option>
                  ))}
                </select>
                <button className="btn" disabled={!pick} onClick={addMember}>
                  Add
                </button>
              </div>
            ) : (
              <p className="muted small">Only friends can be added. Add friends in the Friends tab.</p>
            )}
          </div>

          <div className="invite-row-actions">
            {isOwner ? (
              <button className="link danger" onClick={deleteCrew}>
                delete crew
              </button>
            ) : (
              <button className="link danger" onClick={() => removeMember(user.id, `Leave ${crew.name}?`)}>
                leave crew
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
