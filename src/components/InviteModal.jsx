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
      .select('code, created_at, expires_at, used_at, joined:profiles!used_by(username)')
      .order('created_at', { ascending: false })
    setInvites(data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function create() {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_invite')
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

  const open = invites.filter((i) => !i.used_at && new Date(i.expires_at) > new Date())
  const used = invites.filter((i) => i.used_at)

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>Invite skaters</h2>
        <p className="muted">Each link works once and expires after 14 days.</p>
        <button className="btn btn-accent big" onClick={create} disabled={busy}>
          {busy ? '…' : '+ New invite link'}
        </button>
        {error && <div className="banner error">{error}</div>}

        {open.length > 0 && (
          <ul className="invite-list">
            {open.map((i) => (
              <li key={i.code}>
                <code>{linkFor(i.code)}</code>
                <button className="link" onClick={() => copy(i.code)}>
                  {copied === i.code ? 'Copied!' : 'Copy'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {used.length > 0 && (
          <p className="muted small">Joined via your invites: {used.map((i) => i.joined?.username ?? '?').join(', ')}</p>
        )}
      </div>
    </div>
  )
}
