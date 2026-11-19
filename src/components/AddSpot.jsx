import { useState } from 'react'
import { supabase, PHOTO_BUCKET } from '../supabase.js'
import { navigate } from '../App.jsx'
import { MiniMap } from './SpotMap.jsx'

/** shrink big phone photos before upload (falls back to the original file) */
async function shrink(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    return blob ? { blob, ext: 'jpg', type: 'image/jpeg' } : null
  } catch {
    return null
  }
}

export default function AddSpot({ user, onRequireLogin, onCreated }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('spot')
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
        <h1>Add a spot</h1>
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
    if (!pos) return setError('Tap the map (or use your location) to place the spot.')
    setBusy(true)
    try {
      let photo_url = null
      if (file) {
        const small = await shrink(file)
        const ext = small?.ext ?? (file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, small?.blob ?? file, { contentType: small?.type ?? file.type, upsert: false })
        if (upErr) throw upErr
        photo_url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
      }
      const { data, error: insErr } = await supabase
        .from('spots')
        .insert({
          name: name.trim(),
          kind,
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
      <h1>Add a spot</h1>
      <form className="add-form" onSubmit={submit}>
        <label>
          Name
          <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="e.g. Museumsquartier Ledges" />
        </label>

        <div className="seg">
          <button type="button" className={kind === 'spot' ? 'on' : ''} onClick={() => setKind('spot')}>
            Street spot
          </button>
          <button type="button" className={kind === 'park' ? 'on' : ''} onClick={() => setKind('park')}>
            Skatepark
          </button>
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
              {locating ? 'Locating…' : '📍 Use my location'}
            </button>
          </div>
          <MiniMap lat={pos?.lat} lng={pos?.lng} onPick={(lat, lng) => setPos({ lat, lng })} className="pick" />
          <span className="hint">{pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} – tap to move` : 'Tap the map to drop the pin.'}</span>
        </div>

        <label className="file">
          Photo
          <input type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          {preview && <img src={preview} alt="preview" className="preview" />}
        </label>

        {error && <div className="banner error">{error}</div>}
        <button className="btn btn-accent big" disabled={busy}>
          {busy ? 'Saving…' : 'Add spot'}
        </button>
      </form>
    </main>
  )
}
