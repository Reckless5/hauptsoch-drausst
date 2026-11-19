import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

const linkFor = (code) => `${window.location.origin}/?invite=${code}`

export default function InviteModal({ onClose }) {
  const [invites, setInvites] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(null)

  async function load() {
    const { data } = await supabase
      .from('invites')
      .select('code, created_at, expires_at, used_at, max_uses, use_count, invite_uses(profiles(username))')
      .order('created_at', { ascending: false })
    setInvites(data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function create(group) {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_invite', group ? { max_uses: 50, valid_days: 30 } : {})
    setBusy(false)
    if (error) return setError(error.message)
    await load()
    copy(data)
  }

  async function copy(code) {
    try {
      await navigator.clipboard.writeText(linkFor(code))
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* clipboard blocked – link is visible to copy by hand */
    }
  }

  const open = invites.filter((i) => i.use_count < i.max_uses && new Date(i.expires_at) > new Date())
  const joined = invites.flatMap((i) => (i.invite_uses ?? []).map((u) => u.profiles?.username ?? '?'))

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>Invite skaters</h2>
        <p className="muted">Personal link: works once, 14 days. Group link: up to 50 people, 30 days – for WhatsApp groups.</p>
        <div className="invite-actions">
          <button className="btn btn-accent" onClick={() => create(false)} disabled={busy}>
            + Personal link
          </button>
          <button className="btn" onClick={() => create(true)} disabled={busy}>
            + Group link
          </button>
        </div>
        {error && <div className="banner error">{error}</div>}

        {open.length > 0 && (
          <ul className="invite-list">
            {open.map((i) => (
              <li key={i.code}>
                <code>{linkFor(i.code)}</code>
                {i.max_uses > 1 && (
                  <span className="muted small">
                    {i.use_count}/{i.max_uses}
                  </span>
                )}
                <button className="link" onClick={() => copy(i.code)}>
                  {copied === i.code ? 'Copied!' : 'Copy'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {joined.length > 0 && <p className="muted small">Joined via your invites: {joined.join(', ')}</p>}
      </div>
    </div>
  )
}
