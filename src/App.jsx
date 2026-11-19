import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import Header from './components/Header.jsx'
import Overview from './components/Overview.jsx'
import SpotDetail from './components/SpotDetail.jsx'
import AddSpot from './components/AddSpot.jsx'
import AuthModal from './components/AuthModal.jsx'
import InviteModal from './components/InviteModal.jsx'

function parseRoute() {
  const path = window.location.pathname
  const m = path.match(/^\/spot\/([0-9a-f-]{36})/i)
  if (m) return { name: 'spot', id: m[1] }
  if (path.startsWith('/add')) return { name: 'add' }
  return { name: 'home' }
}

export function navigate(to) {
  if (to === window.location.pathname) return
  window.history.pushState({ inApp: true }, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function App() {
  const [route, setRoute] = useState(parseRoute)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  // invite links look like /?invite=CODE – open sign-up with the code filled in
  const [inviteCode] = useState(() => {
    const code = new URLSearchParams(window.location.search).get('invite') || ''
    if (code) window.history.replaceState({}, '', window.location.pathname)
    return code
  })
  const [authOpen, setAuthOpen] = useState(!!inviteCode)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [spots, setSpots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const onPop = () => {
      setRoute(parseRoute())
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) return setProfile(null)
    supabase
      .from('profiles')
      .select('id, username, is_admin')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data))
  }, [session?.user?.id])

  const loadSpots = useCallback(async () => {
    const { data, error } = await supabase
      .from('spot_overview')
      .select('*')
      .order('name')
    if (error) setError(error.message)
    else setSpots(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSpots()
  }, [loadSpots])

  const user = session?.user ?? null
  const requireLogin = () => setAuthOpen(true)

  return (
    <div className="app">
      <Header
        user={user}
        profile={profile}
        onLogin={requireLogin}
        onLogout={() => supabase.auth.signOut()}
        onAdd={() => (user ? navigate('/add') : requireLogin())}
        onInvite={() => setInviteOpen(true)}
      />
      {error && <div className="banner error">Couldn't load spots: {error}</div>}
      {route.name === 'home' && <Overview spots={spots} loading={loading} />}
      {route.name === 'spot' && (
        <SpotDetail
          key={route.id}
          id={route.id}
          user={user}
          onRequireLogin={requireLogin}
          onChanged={loadSpots}
        />
      )}
      {route.name === 'add' && (
        <AddSpot user={user} onRequireLogin={requireLogin} onCreated={loadSpots} />
      )}
      {authOpen && !user && <AuthModal invite={inviteCode} onClose={() => setAuthOpen(false)} />}
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  )
}
