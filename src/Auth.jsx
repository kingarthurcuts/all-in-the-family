import { useRef, useState } from 'react'
import { supabase, errMsg } from './supabase'

const remember = {
  get(k) { try { return localStorage.getItem(k) || '' } catch { return '' } },
  set(k, v) { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
}

// No passwords: enter your name + email, then type the code we email you.
export default function Auth() {
  const [step, setStep] = useState('email') // email | code
  const [name, setName] = useState(remember.get('aitf.name'))
  const [email, setEmail] = useState(remember.get('aitf.email'))
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const codeRef = useRef(null)

  async function sendCode(e) {
    e?.preventDefault()
    setBusy(true); setError(''); setNotice('')
    const cleanEmail = email.trim().toLowerCase()
    remember.set('aitf.name', name.trim())
    remember.set('aitf.email', cleanEmail)
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        data: { display_name: name.trim() },
        emailRedirectTo: window.location.origin,
      },
    })
    setBusy(false)
    if (error) { setError(errMsg(error)); return }
    setEmail(cleanEmail)
    setCode('')
    setStep('code')
    setTimeout(() => codeRef.current?.focus(), 50)
  }

  async function verify(e) {
    e?.preventDefault()
    const token = code.replace(/\D/g, '')
    if (token.length < 6) return
    setBusy(true); setError('')
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    setBusy(false)
    if (error) setError(/expired|invalid/i.test(error.message) ? 'That code didn’t work or has expired. Check it, or send a new one.' : errMsg(error))
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

      {step === 'email' ? (
        <form className="card auth-card" onSubmit={sendCode}>
          <h2>Sign in</h2>
          <p className="quiet small">No password needed — we’ll email you a code.</p>
          <label>Your name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dad, Grandma, Leo" required maxLength={40} autoComplete="nickname" enterKeyHint="next" />
          </label>
          <label>Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" autoCapitalize="none" enterKeyHint="send" />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn primary wide" disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</button>
        </form>
      ) : (
        <form className="card auth-card" onSubmit={verify}>
          <h2>Check your email</h2>
          <p className="quiet">We sent a code to <b>{email}</b>. Type it below.</p>
          {notice && <div className="notice">{notice}</div>}
          <label>Code
            <input ref={codeRef} className="code-input otp" value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 10)
                setCode(v)
              }}
              inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" placeholder="••••••" required />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn primary wide" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Sign in'}</button>
          <div className="auth-links">
            <button type="button" className="link" onClick={() => { setStep('email'); setError('') }}>Use a different email</button>
            <button type="button" className="link muted" disabled={busy}
              onClick={async () => { await sendCode(); setNotice('A new code is on its way.') }}>Send a new code</button>
          </div>
          <p className="quiet small center">Can’t find it? Check spam. The email may also have a sign-in link — tapping it works too, but it opens in your browser rather than the home-screen app.</p>
        </form>
      )}
    </div>
  )
}
