import { useEffect, useState } from 'react'
import { Sheet, Icon } from './ui'

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
const isAndroid = /Android/i.test(ua)
const inAppBrowser = /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|GSA\/|Messenger|LinkedInApp/i.test(ua)
const iosChrome = isIOS && /CriOS/i.test(ua)
const iosOther = isIOS && /FxiOS|EdgiOS|OPiOS/i.test(ua)

export function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}
const isPhoneish = () => isIOS || isAndroid || window.matchMedia?.('(pointer: coarse)').matches

const SNOOZE = 'aitf.installSnooze'
const snoozed = () => { try { return Number(localStorage.getItem(SNOOZE) || 0) > Date.now() } catch { return false } }
const snooze = (days) => { try { localStorage.setItem(SNOOZE, String(Date.now() + days * 86400000)) } catch { /* ignore */ } }

function useInstallPrompt() {
  const [prompt, setPrompt] = useState(window.__installPrompt || null)
  useEffect(() => {
    const on = () => setPrompt(window.__installPrompt)
    window.addEventListener('installable', on)
    return () => window.removeEventListener('installable', on)
  }, [])
  async function install() {
    if (!prompt) return false
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    window.__installPrompt = null
    setPrompt(null)
    return outcome === 'accepted'
  }
  return { canPrompt: !!prompt, install }
}

/* Bright banner across the top of every screen until the app is on the home screen. */
export function InstallBanner() {
  const [hidden, setHidden] = useState(() => isInstalled() || !isPhoneish() || snoozed())
  const [open, setOpen] = useState(false)
  const { canPrompt, install } = useInstallPrompt()
  if (hidden) return null
  return (
    <>
      <div className="install-banner" role="region" aria-label="Add to home screen">
        <img src="/icon.svg" alt="" className="ib-icon" />
        <button className="ib-main" onClick={async () => { if (canPrompt) { if (await install()) setHidden(true) } else setOpen(true) }}>
          <span className="ib-title">Add to Home Screen</span>
          <span className="ib-sub">{canPrompt ? 'Opens like a regular app' : '3 quick steps'}</span>
        </button>
        <button className="ib-go" onClick={async () => { if (canPrompt) { if (await install()) setHidden(true) } else setOpen(true) }}>
          {canPrompt ? 'Install' : 'Show me'}
        </button>
        <button className="ib-x" aria-label="Not now" onClick={() => { snooze(3); setHidden(true) }}><Icon name="x" size={16} /></button>
      </div>
      {open && <InstallGuide onClose={() => setOpen(false)} />}
    </>
  )
}

/* Card on the Family tab — always available (even after "Not now"). */
export function InstallCard() {
  const [open, setOpen] = useState(false)
  const { canPrompt, install } = useInstallPrompt()
  if (isInstalled()) return null
  return (
    <section className="card install">
      <img src="/icon.svg" alt="" className="install-icon" />
      <div className="install-text">
        <h2>Put it on your home screen</h2>
        <p className="quiet small">Opens full screen, just like a regular app.</p>
      </div>
      <button className="btn primary small" onClick={() => (canPrompt ? install() : setOpen(true))}>{canPrompt ? 'Install' : 'How?'}</button>
      {open && <InstallGuide onClose={() => setOpen(false)} />}
    </section>
  )
}

/* Small link for the sign-in screen. */
export function InstallLink() {
  const [open, setOpen] = useState(false)
  if (isInstalled() || !isPhoneish()) return null
  return (
    <>
      <button className="install-link" onClick={() => setOpen(true)}>📲 How to add this app to your home screen</button>
      {open && <InstallGuide onClose={() => setOpen(false)} />}
    </>
  )
}

const ShareIcon = () => (
  <svg className="ig" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18.5 10H17" />
  </svg>
)
const PlusSquare = () => (
  <svg className="ig" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" />
  </svg>
)
const Dots = ({ vertical }) => <span className="ig dots">{vertical ? '⋮' : '•••'}</span>

export function InstallGuide({ onClose }) {
  const { canPrompt, install } = useInstallPrompt()
  const [copied, setCopied] = useState(false)
  const url = window.location.origin

  let title = 'Add to your home screen'
  let steps
  if (inAppBrowser) {
    title = 'Open it in your browser first'
    steps = [
      <>This page is open inside another app, which can’t add it to your home screen.</>,
      <>Tap the <Dots /> or <ShareIcon /> menu in this app and choose <b>Open in {isIOS ? 'Safari' : 'Chrome'}</b> (or <b>Open in browser</b>).</>,
      <>Then open this guide again from the banner at the top.</>,
    ]
  } else if (isIOS && iosOther) {
    title = 'Use Safari to add it'
    steps = [
      <>Copy the link below and open it in <b>Safari</b>.</>,
      <>Tap the <b>Share</b> button <ShareIcon /> (on newer iPhones, tap <Dots /> first).</>,
      <>Choose <b>Add to Home Screen</b> <PlusSquare />, then tap <b>Add</b>.</>,
    ]
  } else if (iosChrome) {
    steps = [
      <>Tap the <b>Share</b> button <ShareIcon /> at the <b>top right</b>, next to the web address.</>,
      <>Scroll down and tap <b>Add to Home Screen</b> <PlusSquare />.</>,
      <>Tap <b>Add</b> in the top-right corner. Done!</>,
    ]
  } else if (isIOS) {
    steps = [
      <>At the <b>bottom</b> of Safari, tap the <b>Share</b> button <ShareIcon />. On newer iPhones, tap <Dots /> first, then <b>Share</b>.</>,
      <>Scroll down and tap <b>Add to Home Screen</b> <PlusSquare />. (Don’t see it? Tap <b>View More</b>.)</>,
      <>Make sure <b>Open as Web App</b> is on if you see it, then tap <b>Add</b>. Done!</>,
    ]
  } else if (isAndroid) {
    steps = [
      <>Tap the <Dots vertical /> menu at the <b>top right</b> of Chrome.</>,
      <>Tap <b>Add to Home screen</b> or <b>Install app</b>.</>,
      <>Tap <b>Install</b> (or <b>Add</b>). Done!</>,
    ]
  } else {
    steps = [
      <>Open this page on your <b>phone</b>: {url.replace(/^https?:\/\//, '')}</>,
      <>On iPhone: Safari → <b>Share</b> <ShareIcon /> → <b>Add to Home Screen</b>.</>,
      <>On Android: Chrome → <Dots vertical /> → <b>Install app</b>.</>,
    ]
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="guide">
        <div className="guide-preview" aria-hidden="true">
          <img src="/icon.svg" alt="" /><span>Family</span>
        </div>
        {canPrompt && !inAppBrowser ? (
          <>
            <p className="quiet center">Your phone can do it in one tap.</p>
            <button className="btn primary wide big-btn" onClick={async () => { if (await install()) onClose() }}>Install the app</button>
            <p className="quiet small center">Or do it yourself:</p>
          </>
        ) : null}
        <ol className="guide-steps">
          {steps.map((s, i) => (
            <li key={i}><span className="step-num">{i + 1}</span><span className="step-text">{s}</span></li>
          ))}
        </ol>
        {(inAppBrowser || iosOther) && (
          <button className="btn ghost wide" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true) } catch { /* ignore */ } }}>
            <Icon name="copy" size={18} /> {copied ? 'Link copied!' : 'Copy the link'}
          </button>
        )}
        <p className="quiet small center">After that, open <b>Family</b> from your home screen instead of the browser. You may need to sign in once more there.</p>
        <button className="btn ghost wide" onClick={onClose}>Got it</button>
      </div>
    </Sheet>
  )
}
