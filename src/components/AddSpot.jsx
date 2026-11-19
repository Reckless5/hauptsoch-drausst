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
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
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

  function pickFile(f) {
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
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
      let photo_url = null
      if (file) photo_url = await uploadPhoto(file, user.id)
      const { data, error: insErr } = await supabase
        .from('spots')
        .insert({
          name: name.trim(),
          kind,
          category,
          description: description.trim() || null,
          lat: pos.lat,
          lng: pos.lng,
          photo_url,
          created_by: user.id,
        })
        .select('id')
        .single()
      if (insErr) throw insErr
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
          Photo
          <input type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          {preview && <img src={preview} alt="preview" className="preview" />}
        </label>

        {error && <div className="banner error">{error}</div>}
        <button className="btn btn-accent big" disabled={busy}>
          {busy ? 'Saving…' : isAdmin ? 'Add spot' : 'Send spot for review'}
        </button>
        {!isAdmin && <p className="hint">An admin checks new spots before they show up for everyone. You can see yours right away.</p>}
      </form>
    </main>
  )
}
