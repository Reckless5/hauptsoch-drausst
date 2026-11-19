import { createClient } from '@supabase/supabase-js'

// The publishable key is meant to live in the browser; row level security protects the data.
// Override with VITE_SUPABASE_URL / VITE_SUPABASE_KEY if you ever point this at another project.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://wzaymtdjmmisxprogeyq.supabase.co'
const key = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_L-vE-3ogtSE4TwTqoMylFw_F3OI8duJ'

export const supabase = createClient(url, key)

export const PHOTO_BUCKET = 'spot-photos'

/** bust status from community votes */
export function bustStatus(spot) {
  if (spot.kind === 'park') return 'none' // skateparks have no bust rating
  const yes = Number(spot.bust_yes || 0)
  const no = Number(spot.bust_no || 0)
  if (yes + no === 0) return 'unknown'
  return yes > no ? 'bust' : 'safe'
}

export const BUST_LABEL = {
  bust: 'BUST',
  safe: 'Skateable',
  unknown: 'No reports',
}

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

/** resize + upload a photo to storage, returns its public URL */
export async function uploadPhoto(file, userId) {
  const small = await shrink(file)
  const ext = small?.ext ?? (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, small?.blob ?? file, { contentType: small?.type ?? file.type, upsert: false })
  if (error) throw error
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
}

/** spot categories: colour + letter on the map (letter keeps it readable without colour) */
export const CATEGORIES = [
  { id: 'park', label: 'Skatepark', letter: 'P', color: '#2563eb', ink: '#fff' },
  { id: 'transition', label: 'Transition', letter: 'T', color: '#9333ea', ink: '#fff' },
  { id: 'ledge', label: 'Ledge', letter: 'L', color: '#f97316', ink: '#111' },
  { id: 'rail', label: 'Rail', letter: 'R', color: '#16a34a', ink: '#fff' },
  { id: 'handrail', label: 'Handrail', letter: 'H', color: '#db2777', ink: '#fff' },
  { id: 'mannypad', label: 'Manny pad', letter: 'M', color: '#facc15', ink: '#111' },
  { id: 'stairs', label: 'Stairset', letter: 'S', color: '#7c4a1e', ink: '#fff' },
  { id: 'gap', label: 'Gap', letter: 'G', color: '#06b6d4', ink: '#111' },
  { id: 'other', label: 'Other', letter: '?', color: '#6b7280', ink: '#fff' },
]
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))
export const catOf = (spot) => CAT[spot?.category] ?? CAT.other
