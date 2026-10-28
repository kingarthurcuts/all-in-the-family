import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import Auth, { NewPassword } from './Auth'
import FamilySetup from './FamilySetup'
import Calendar from './Calendar'
import Lists from './Lists'
import Polls from './Polls'
import Family from './Family'
import { Icon } from './ui'

const TABS = [
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'lists', label: 'Lists', icon: 'list' },
  { id: 'polls', label: 'Polls', icon: 'poll' },
  { id: 'family', label: 'Family', icon: 'home' },
]

const store = {
  get(k) { try { return localStorage.getItem(k) } catch { return null } },
  set(k, v) { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <Splash />
  if (recovering && session) return <NewPassword onDone={() => setRecovering(false)} />
  if (!session) return <Auth />
  return <Home user={session.user} />
}

function Splash() {
  return (
    <div className="splash">
      <div className="logo-mark big"><img src="/icon.svg" alt="" /></div>
    </div>
  )
}

function Home({ user }) {
  const [families, setFamilies] = useState(null)
  const [familyId, setFamilyId] = useState(store.get('aitf.family'))
  const [profiles, setProfiles] = useState({})
  const [members, setMembers] = useState([])
  const [tab, setTab] = useState(store.get('aitf.tab') || 'calendar')
  const [adding, setAdding] = useState(false)

  const loadFamilies = useCallback(async () => {
    const { data } = await supabase.from('families').select('*').order('created_at')
    setFamilies(data || [])
    return data || []
  }, [])

  const loadPeople = useCallback(async (fid) => {
    if (!fid) return
    const [{ data: profs }, { data: mems }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('family_members').select('*').eq('family_id', fid).order('joined_at'),
    ])
    const map = {}
    ;(profs || []).forEach((p) => { map[p.id] = p })
    setProfiles(map)
    setMembers(mems || [])
  }, [])

  useEffect(() => { loadFamilies() }, [loadFamilies])

  const family = families?.find((f) => f.id === familyId) || families?.[0]

  useEffect(() => {
    if (family) {
      store.set('aitf.family', family.id)
      loadPeople(family.id)
    }
  }, [family?.id, loadPeople])

  useEffect(() => { store.set('aitf.tab', tab) }, [tab])

  if (families === null) return <Splash />

  if (!families.length || adding) {
    return (
      <FamilySetup
        canCancel={families.length > 0}
        onCancel={() => setAdding(false)}
        onDone={async (fid) => {
          await loadFamilies()
          setFamilyId(fid)
          setAdding(false)
          setTab('calendar')
        }}
      />
    )
  }

  const me = profiles[user.id]
  const ctx = { family, user, me, profiles, members, reloadPeople: () => loadPeople(family.id) }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="logo-mark"><img src="/icon.svg" alt="" /></div>
          <div>
            <div className="brand-name">All in the Family</div>
            {families.length > 1 ? (
              <select className="family-switch" value={family.id} onChange={(e) => setFamilyId(e.target.value)} aria-label="Switch family">
                {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            ) : (
              <div className="family-name">{family.name}</div>
            )}
          </div>
        </div>
        <nav className="tabs-top">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} /> {t.label}
            </button>
          ))}
        </nav>
        {me && (
          <button className="me-chip" onClick={() => setTab('family')} title="Your profile">
            <span className="avatar" style={{ background: me.color }}>{me.display_name[0]?.toUpperCase()}</span>
          </button>
        )}
      </header>

      <main className="content" key={family.id}>
        {tab === 'calendar' && <Calendar {...ctx} />}
        {tab === 'lists' && <Lists {...ctx} />}
        {tab === 'polls' && <Polls {...ctx} />}
        {tab === 'family' && (
          <Family
            {...ctx}
            onAddFamily={() => setAdding(true)}
            onFamilyChanged={async () => {
              const fs = await loadFamilies()
              if (!fs.find((f) => f.id === family.id)) setFamilyId(fs[0]?.id || null)
            }}
          />
        )}
      </main>

      <nav className="tabs-bottom">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
