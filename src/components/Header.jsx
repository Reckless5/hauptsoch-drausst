import { navigate } from '../App.jsx'

export default function Header({ user, profile, onLogin, onLogout, onAdd, pendingCount = 0 }) {
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
          <>
          <a
            className="btn"
            href="/crew"
            onClick={(e) => {
              e.preventDefault()
              navigate('/crew')
            }}
          >
            Crew
          </a>
          <a
            className="btn"
            href="/account"
            onClick={(e) => {
              e.preventDefault()
              navigate('/account')
            }}
            title={user.email}
          >
            {profile?.username ?? 'Account'}
            {pendingCount > 0 && <i className="badge" title={`${pendingCount} spots waiting for review`}>{pendingCount}</i>}
          </a>
          </>
        ) : (
          <button className="btn btn-ghost" onClick={onLogin}>
            Log in
          </button>
        )}
      </div>
    </header>
  )
}
