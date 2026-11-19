import { navigate } from '../App.jsx'

export default function Header({ user, profile, onLogin, onLogout, onAdd }) {
  return (
    <header className="header">
      <a
        className="logo"
        href="/"
        onClick={(e) => {
          e.preventDefault()
          navigate('/')
        }}
      >
        <img src="/logo.jpg" alt="Hauptsoch Drausst" />
        <small>Vienna skatespots</small>
      </a>
      <div className="header-actions">
        <button className="btn btn-accent" onClick={onAdd}>
          + Spot
        </button>
        {user ? (
          <div className="user-chip">
            <span title={user.email}>{profile?.username ?? '…'}</span>
            <button className="link" onClick={onLogout}>
              Log out
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost" onClick={onLogin}>
            Log in
          </button>
        )}
      </div>
    </header>
  )
}
