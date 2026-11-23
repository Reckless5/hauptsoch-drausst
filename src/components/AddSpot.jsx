import { useState } from 'react'
import { supabase, uploadPhoto, CATEGORIES } from '../supabase.js'
import { navigate } from '../App.jsx'
import { MiniMap } from './SpotMap.jsx'
import { Tiles } from './bits.jsx'

export default function AddSpot({ user, isAdmin, onRequireLogin, onCreated }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(null)
  const kind = category === 'park' ? 'park' : 'spot'
  const [description, setDescription] = useState('')
  const [pos, setPos] = useState(null)
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [locating, setLocating] = useState(false)

  if (!user)
    return (
      <main className="detail narrow">
        <Tiles as="h1" text="ADD A SPOT" />
        <p>You need to be logged in to add spots.</p>
        <button className="btn btn-accent" onClick={onRequireLogin}>
          Log in / sign up
        </button>
      </main>
    )

  function pickFiles(list) {
    setFiles((prev) => [...prev, ...[...list].map((f) => ({ f, url: URL.createObjectURL(f) }))].slice(0, 10))
  }

  function locate() {
    if (!navigator.geolocation) return setError('Your browser has no location access.')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude })
        setLocating(false)
      },
      () => {
        setError("Couldn't get your location – tap the map instead.")
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Give the spot a name.')
    if (!category) return setError('Pick what kind of spot it is.')
    if (!pos) return setError('Tap the map (or use your location) to place the spot.')
    setBusy(true)
    try {
      const { data, error: insErr } = await supabase
        .from('spots')
        .insert({
          name: name.trim(),
          kind,
          category,
          description: description.trim() || null,
          lat: pos.lat,
          lng: pos.lng,
          created_by: user.id,
        })
        .select('id')
        .single()
      if (insErr) throw insErr
      // photos go into the spot's gallery (approved together with the spot)
      for (const { f } of files) {
        const url = await uploadPhoto(f, user.id)
        const { error: pErr } = await supabase.from('spot_photos').insert({ spot_id: data.id, user_id: user.id, url })
        if (pErr) throw pErr
      }
      await onCreated?.()
      navigate(`/spot/${data.id}`)
    } catch (err) {
      setError(err.message ?? String(err))
      setBusy(false)
    }
  }

  return (
    <main className="detail narrow">
      <Tiles as="h1" text="ADD A SPOT" />
      <form className="add-form" onSubmit={submit}>
        <label>
          Name
          <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="e.g. Museumsquartier Ledges" />
        </label>

        <div className="field">
          What is it?
          <div className="cat-picker">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.id}
                className={category === c.id ? 'on' : ''}
                onClick={() => setCategory(c.id)}
                style={category === c.id ? { background: c.color, color: c.ink } : undefined}
              >
                <b className="pin" style={{ background: c.color, color: c.ink }}>{c.letter}</b>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <label>
          Description
          <textarea
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's there? Ledges, rails, gap, ground quality…"
          />
        </label>

        <div className="field">
          <div className="row-between">
            <span>Location</span>
            <button type="button" className="link" onClick={locate} disabled={locating}>
              {locating ? 'Locating…' : 'Use my location'}
            </button>
          </div>
          <MiniMap lat={pos?.lat} lng={pos?.lng} spot={{ kind, category: category ?? 'other' }} onPick={(lat, lng) => setPos({ lat, lng })} className="pick" />
          <span className="hint">{pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} – tap to move` : 'Tap the map to drop the pin.'}</span>
        </div>

        <label className="file">
          Photos {files.length > 0 && <span className="muted">({files.length}/10)</span>}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              pickFiles(e.target.files ?? [])
              e.target.value = ''
            }}
          />
        </label>
        {files.length > 0 && (
          <ul className="thumbs">
            {files.map((x, i) => (
              <li key={x.url}>
                <button type="button" title="Remove" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                  <img src={x.url} alt="" />
                  <span className="thumb-x">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <div className="banner error">{error}</div>}
        <button className="btn btn-accent big" disabled={busy}>
          {busy ? 'Saving…' : isAdmin ? 'Add spot' : 'Send spot for review'}
        </button>
        {!isAdmin && <p className="hint">An admin checks new spots before they show up for everyone. You can see yours right away.</p>}
      </form>
    </main>
  )
}
