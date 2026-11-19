import { createClient } from '@supabase/supabase-js'

// The publishable key is meant to live in the browser; row level security protects the data.
// Override with VITE_SUPABASE_URL / VITE_SUPABASE_KEY if you ever point this at another project.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://wzaymtdjmmisxprogeyq.supabase.co'
const key = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_L-vE-3ogtSE4TwTqoMylFw_F3OI8duJ'

export const supabase = createClient(url, key)

export const PHOTO_BUCKET = 'spot-photos'

/** bust status from community votes */
export function bustStatus(spot) {
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
