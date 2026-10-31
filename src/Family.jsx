import { useState } from 'react'
import { InstallCard } from './Install'

import { supabase, errMsg, COLORS } from './supabase'
import { Icon, Avatar } from './ui'

export default function Family({ family, user, me, profiles, members, reloadPeople, onAddFamily, onFamilyChanged, onMessage }) {
  const [copied, setCopied] = useState(false)
  const [name, setName] = useState(me?.display_name || '')
  const [color, setColor] = useState(me?.color || COLORS[0])
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [famName, setFamName] = useState(family.name)
  const [armed, setArmed] = useState(false)

  const shareText = `Join our family on All in the Family! Sign up at ${window.location.origin} and enter code ${family.invite_code}`

  async function copy() {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'All in the Family', text: shareText })
      } else {
        await navigator.clipboard.writeText(shareText)
        setCopied(true); setTimeout(() => setCopied(false), 2000)
      }
    } catch { /* user cancelled */ }
  }

  async function saveProfile(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('profiles').update({ display_name: name.trim(), color }).eq('id', user.id)
    if (error) setError(errMsg(error))
    else { setSaved('profile'); setTimeout(() => setSaved(''), 1800); reloadPeople() }
  }
  async function saveFamily(e) {
    e.preventDefault()
    const { error } = await supabase.from('families').update({ name: famName.trim() }).eq('id', family.id)
    if (error) setError(errMsg(error))
    else { setSaved('family'); setTimeout(() => setSaved(''), 1800); onFamilyChanged() }
  }
  async function leave() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return }
    await supabase.from('family_members').delete().eq('family_id', family.id).eq('user_id', user.id)
    onFamilyChanged()
  }

  return (
    <div className="page narrow">
      <div className="page-head"><h1>{family.name}</h1></div>

      <section className="card invite">
        <div>
          <div className="eyebrow">Invite code</div>
          <div className="code">{family.invite_code.split('').map((c, i) => <span key={i}>{c}</span>)}</div>
          <p className="quiet small">Family members sign up, then enter this code to join.</p>
        </div>
        <button className="btn primary" onClick={copy}><Icon name="copy" size={18} /> {copied ? 'Copied!' : 'Share invite'}</button>
      </section>

      <InstallCard />

      <section className="card">
        <div className="eyebrow">Members · {members.length}</div>
        <ul className="members">
          {members.map((m) => {
            const p = profiles[m.user_id]
            return (
              <li key={m.user_id}>
                <Avatar profile={p} size={36} />
                <span className="m-name">{p?.display_name || 'Member'}{m.user_id === user.id && <span className="quiet"> (you)</span>}</span>
                {m.role === 'owner' && <span className="badge soft">Started it</span>}
                {m.user_id !== user.id && (
                  <button className="btn ghost small" onClick={() => onMessage(m.user_id)} aria-label={`Message ${p?.display_name || 'member'}`}>
                    <Icon name="chat" size={16} /> Message
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card">
        <h2>You</h2>
        <form className="form" onSubmit={saveProfile}>
          <label>Display name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
          </label>
          <div className="field-label"><span>Your color <span className="opt">shows on your events and votes</span></span></div>
          <div className="swatches">
            {COLORS.map((c) => (
              <button type="button" key={c} className={c === color ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Color ${c}`}>
                {c === color && <Icon name="check" size={16} />}
              </button>
            ))}
          </div>
          <div className="form-actions">
            <span className="quiet small">{user.email}</span>
            <span className="spacer" />
            <button className="btn primary">{saved === 'profile' ? 'Saved ✓' : 'Save'}</button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Family settings</h2>
        <form className="form" onSubmit={saveFamily}>
          <label>Family name
            <input value={famName} onChange={(e) => setFamName(e.target.value)} required maxLength={50} />
          </label>
          <div className="form-actions">
            <span className="spacer" />
            <button className="btn secondary">{saved === 'family' ? 'Saved ✓' : 'Rename'}</button>
          </div>
        </form>
        {error && <div className="error">{error}</div>}
        <div className="settings-links">
          <button className="btn ghost" onClick={onAddFamily}><Icon name="plus" size={18} /> Join or start another family</button>
          <button className={`btn danger ghosty ${armed ? 'armed' : ''}`} onClick={leave}>{armed ? 'Tap again to leave' : 'Leave this family'}</button>
        </div>
      </section>

      <div className="center">
        <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  )
}
