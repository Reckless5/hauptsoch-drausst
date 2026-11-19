import { useState } from 'react'
import { supabase } from '../supabase.js'

export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setBusy(false)
      if (error) return setError(error.message)
      onClose()
    } else {
      if (!username.trim()) {
        setBusy(false)
        return setError('Pick a username.')
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username.trim() }, emailRedirectTo: window.location.origin },
      })
      setBusy(false)
      if (error) return setError(error.message)
      if (data.session) onClose()
      else setInfo('Check your inbox and click the confirmation link, then log in.')
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>{mode === 'login' ? 'Log in' : 'Join the crew'}</h2>
        <p className="muted">Log in to add spots, rate them, flag busts and leave notes.</p>
        {info ? (
          <div className="banner ok">{info}</div>
        ) : (
          <form onSubmit={submit} className="auth-form">
            {mode === 'signup' && (
              <label>
                Username
                <input value={username} maxLength={30} onChange={(e) => setUsername(e.target.value)} autoComplete="nickname" />
              </label>
            )}
            <label>
              Email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>
            {error && <div className="banner error">{error}</div>}
            <button className="btn btn-accent big" disabled={busy}>
              {busy ? '…' : mode === 'login' ? 'Log in' : 'Sign up'}
            </button>
          </form>
        )}
        <p className="switch">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button className="link" onClick={() => { setMode('signup'); setError(null); setInfo(null) }}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already skating with us?{' '}
              <button className="link" onClick={() => { setMode('login'); setError(null); setInfo(null) }}>
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
