import { useCallback, useEffect, useState } from 'react'
import { supabase, uploadPhoto, deletePhotoFile } from '../supabase.js'
import { BustStamp } from './bits.jsx'

/**
 * Photo gallery for a spot: big photo + thumbnail strip + fullscreen viewer.
 * Members' uploads wait for admin review (only uploader + admins see them until then).
 * Uploaders can delete their own photos, admins can approve and delete any.
 */
export default function Gallery({ spot, user, isAdmin, onRequireLogin, onChanged, fail }) {
  const [photos, setPhotos] = useState([])
  const [names, setNames] = useState({})
  const [index, setIndex] = useState(0)
  const [viewer, setViewer] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [broken, setBroken] = useState({})

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('spot_photos')
      .select('id, url, user_id, status, created_at')
      .eq('spot_id', spot.id)
      .order('created_at', { ascending: false })
    const list = (data ?? []).map((p) => ({ ...p, kind: 'community' }))
    // the photo that came with the spot (original map import or the creator's first photo)
    if (spot.photo_url) list.push({ id: 'original', url: spot.photo_url, status: 'approved', kind: 'original', user_id: spot.created_by })
    // approved first, newest first; pending after
    list.sort((a, b) => (a.status === b.status ? 0 : a.status === 'approved' ? -1 : 1))
    setPhotos(list)
    const ids = [...new Set(list.map((p) => p.user_id).filter(Boolean))]
    if (ids.length) {
      const { data: prof } = await supabase.from('profiles').select('id, username').in('id', ids)
      setNames(Object.fromEntries((prof ?? []).map((p) => [p.id, p.username])))
    }
  }, [spot.id, spot.photo_url, spot.created_by])

  useEffect(() => {
    load()
  }, [load])

  const shown = photos.filter((p) => !broken[p.id])
  const current = shown[Math.min(index, Math.max(shown.length - 1, 0))]

  useEffect(() => {
    if (!viewer) return
    const onKey = (e) => {
      if (e.key === 'Escape') setViewer(false)
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % shown.length)
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + shown.length) % shown.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewer, shown.length])

  async function upload(files) {
    if (!files?.length) return
    if (!user) return onRequireLogin()
    setBusy(true)
    let ok = 0
    try {
      for (const file of [...files].slice(0, 10)) {
        const url = await uploadPhoto(file, user.id)
        const { error } = await supabase.from('spot_photos').insert({ spot_id: spot.id, user_id: user.id, url })
        if (error) throw error
        ok++
      }
    } catch (err) {
      fail?.(err)
    } finally {
      setBusy(false)
    }
    if (ok && !isAdmin) setNote(`Thanks! ${ok === 1 ? 'Your photo is' : `Your ${ok} photos are`} waiting for an admin to approve.`)
    setIndex(0)
    await load()
    onChanged?.()
  }

  async function approve(p) {
    const { error } = await supabase.from('spot_photos').update({ status: 'approved' }).eq('id', p.id)
    if (error) return fail?.(error)
    await load()
    onChanged?.()
  }

  async function remove(p) {
    if (!window.confirm('Delete this photo? This cannot be undone.')) return
    if (p.kind === 'original') {
      // only admins can clear the spot's original photo
      const { error } = await supabase.from('spots').update({ photo_url: null, photo_credit: null }).eq('id', spot.id)
      if (error) return fail?.(error)
    } else {
      const { error } = await supabase.from('spot_photos').delete().eq('id', p.id)
      if (error) return fail?.(error)
      await deletePhotoFile(p.url)
    }
    setIndex(0)
    setViewer(false)
    await load()
    onChanged?.()
  }

  const canDelete = (p) => !!user && (isAdmin || (p.kind === 'community' && p.user_id === user.id))
  const approvedCount = shown.filter((p) => p.status === 'approved').length

  return (
    <div className="gallery">
      <div className="hero-wrap">
        {current ? (
          <button className="hero-btn" onClick={() => setViewer(true)} aria-label="Open photo">
            <img
              className={`hero ${current.status === 'pending' ? 'is-pending' : ''}`}
              src={current.url}
              alt={spot.name}
              referrerPolicy="no-referrer"
              onError={() => setBroken((b) => ({ ...b, [current.id]: true }))}
            />
          </button>
        ) : (
          <div className="hero hero-empty">no photo yet</div>
        )}
        <BustStamp spot={spot} />
        {current?.status === 'pending' && <span className="pending-tag">waiting for review</span>}
        {shown.length > 1 && (
          <span className="photo-count">
            {Math.min(index, shown.length - 1) + 1}/{shown.length}
          </span>
        )}
        <label className={`photo-btn ${busy ? 'busy' : ''}`} onClick={(e) => !user && (e.preventDefault(), onRequireLogin())}>
          {busy ? 'Uploading…' : '+ Add photos'}
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={busy}
            onChange={(e) => {
              upload(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {note && (
        <div className="banner small" onClick={() => setNote(null)}>
          {note}
        </div>
      )}

      {current && (isAdmin || canDelete(current)) && (
        <div className="photo-actions">
          <span className="muted small">
            {current.kind === 'original' ? (spot.photo_credit ? `Photo: ${spot.photo_credit}` : 'Original photo') : `by ${names[current.user_id] ?? '…'}`}
          </span>
          <span className="row-actions">
            {isAdmin && current.status === 'pending' && (
              <button className="btn btn-accent" onClick={() => approve(current)}>
                Approve photo
              </button>
            )}
            {canDelete(current) && (
              <button className="link danger" onClick={() => remove(current)}>
                delete photo
              </button>
            )}
          </span>
        </div>
      )}

      {shown.length > 1 && (
        <ul className="thumbs">
          {shown.map((p, i) => (
            <li key={p.id}>
              <button className={`${i === index ? 'on' : ''} ${p.status === 'pending' ? 'is-pending' : ''}`} onClick={() => setIndex(i)}>
                <img src={p.url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken((b) => ({ ...b, [p.id]: true }))} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {approvedCount < shown.length && <p className="muted small">Dashed photos are waiting for admin review and only visible to {isAdmin ? 'admins and the uploader' : 'you and the admins'}.</p>}

      {viewer && current && (
        <div className="viewer" onClick={() => setViewer(false)}>
          <img src={current.url} alt={spot.name} referrerPolicy="no-referrer" onClick={(e) => e.stopPropagation()} />
          {shown.length > 1 && (
            <>
              <button className="viewer-nav prev" onClick={(e) => (e.stopPropagation(), setIndex((index - 1 + shown.length) % shown.length))} aria-label="Previous">
                ‹
              </button>
              <button className="viewer-nav next" onClick={(e) => (e.stopPropagation(), setIndex((index + 1) % shown.length))} aria-label="Next">
                ›
              </button>
            </>
          )}
          <button className="viewer-close" aria-label="Close">
            ×
          </button>
        </div>
      )}
    </div>
  )
}
