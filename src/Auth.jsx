import { useState } from 'react'
import { supabase, errMsg } from './supabase'
import { Icon } from './ui'

export default function Auth() {
  const [mode, setMode] = useState('signin') // signin | signup | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) {
          setNotice('Almost there! We sent a confirmation link to ' + email + '. Tap it, then come back and sign in.')
          setMode('signin')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setNotice('If that email has an account, a reset link is on its way.')
        setMode('signin')
      }
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="logo-mark big"><img src="/icon.svg" alt="" /></div>
        <h1>All in the Family</h1>
        <p>One calendar, shared lists, and quick votes for the whole crew.</p>
        <div className="hero-dots" aria-hidden="true">
          <span style={{ background: '#FF7A59' }} /><span style={{ background: '#2EC4B6' }} /><span style={{ background: '#FFB703' }} /><span style={{ background: '#8E7DBE' }} />
        </div>
      </div>

      <form className="card auth-card" onSubmit={submit}>
        <h2>{mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}</h2>
        {notice && <div className="notice">{notice}</div>}
        {mode === 'signup' && (
          <label>Your name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dad, Grandma, Leo" required maxLength={40} autoComplete="nickname" />
          </label>
        )}
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        {mode !== 'forgot' && (
          <label>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </label>
        )}
        {error && <div className="error">{error}</div>}
        <button className="btn primary wide" disabled={busy}>
          {busy ? 'One sec…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
        </button>
        <div className="auth-links">
          {mode === 'signin' ? (
            <>
              <button type="button" className="link" onClick={() => { setMode('signup'); setError('') }}>New here? Create an account</button>
              <button type="button" className="link muted" onClick={() => { setMode('forgot'); setError('') }}>Forgot password?</button>
            </>
          ) : (
            <button type="button" className="link" onClick={() => { setMode('signin'); setError('') }}>Back to sign in</button>
          )}
        </div>
      </form>
    </div>
  )
}

export function NewPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(errMsg(error))
    else onDone()
  }
  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h2>Choose a new password</h2>
        <label>New password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoComplete="new-password" />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn primary wide" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </div>
  )
}
