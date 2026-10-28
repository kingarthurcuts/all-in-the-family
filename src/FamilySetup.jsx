import { useState } from 'react'
import { supabase, errMsg } from './supabase'
import { Icon } from './ui'

export default function FamilySetup({ onDone, canCancel, onCancel }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function create(e) {
    e.preventDefault()
    setBusy('create'); setError('')
    const { data, error } = await supabase.rpc('create_family', { family_name: name })
    setBusy('')
    if (error) setError(errMsg(error))
    else onDone(data)
  }
  async function join(e) {
    e.preventDefault()
    setBusy('join'); setError('')
    const { data, error } = await supabase.rpc('join_family', { code })
    setBusy('')
    if (error) setError(errMsg(error))
    else onDone(data)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="logo-mark big"><img src="/icon.svg" alt="" /></div>
        <h1>Let’s find your family</h1>
        <p>Start a new family space, or join one with the 6-letter code someone shared with you.</p>
      </div>
      <div className="setup-grid">
        <form className="card" onSubmit={join}>
          <h2>Join with a code</h2>
          <label>Invite code
            <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6} required />
          </label>
          <button className="btn primary wide" disabled={!!busy}>{busy === 'join' ? 'Joining…' : 'Join family'}</button>
        </form>
        <form className="card" onSubmit={create}>
          <h2>Start a new family</h2>
          <label>Family name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Martinez Crew" maxLength={50} required />
          </label>
          <button className="btn secondary wide" disabled={!!busy}>{busy === 'create' ? 'Creating…' : 'Create family'}</button>
        </form>
      </div>
      {error && <div className="error center">{error}</div>}
      <div className="auth-links">
        {canCancel && <button className="link" onClick={onCancel}>Back</button>}
        <button className="link muted" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  )
}
