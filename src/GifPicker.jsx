import { useEffect, useRef, useState } from 'react'
import { Sheet, isTouch } from './ui'

// GIPHY keys of this kind are designed to be used from the browser.
const KEY = import.meta.env.VITE_GIPHY_KEY || 'a5uoBMOd0kJc3JwlA8dHsE6zku71KqbZ'
const RATING = 'pg' // family-friendly results only

const SUGGESTIONS = ['Happy birthday', 'Love you', 'Thank you', 'LOL', 'On my way', 'Yes', 'Dinner', 'Good night']

async function fetchGifs(q, signal) {
  const base = q ? 'https://api.giphy.com/v1/gifs/search' : 'https://api.giphy.com/v1/gifs/trending'
  const params = new URLSearchParams({ api_key: KEY, limit: '30', rating: RATING, bundle: 'messaging_non_clips' })
  if (q) params.set('q', q)
  const res = await fetch(`${base}?${params}`, { signal })
  if (res.status === 429) throw new Error('busy')
  if (!res.ok) throw new Error('bad')
  const json = await res.json()
  return (json.data || []).map((g) => {
    const im = g.images?.fixed_width || g.images?.downsized || g.images?.original
    const thumb = g.images?.fixed_width_small || im
    return {
      id: g.id,
      title: g.title || 'GIF',
      url: im?.url,
      w: Number(im?.width) || 200,
      h: Number(im?.height) || 150,
      thumb: thumb?.webp || thumb?.url,
    }
  }).filter((g) => g.url)
}

export default function GifPicker({ onPick, onClose }) {
  const [q, setQ] = useState('')
  const [gifs, setGifs] = useState(null)
  const [error, setError] = useState('')
  const input = useRef(null)

  useEffect(() => { if (!isTouch()) input.current?.focus() }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    // wait until people stop typing so we don't burn through GIPHY's hourly limit
    const t = setTimeout(async () => {
      try {
        setError('')
        setGifs(await fetchGifs(q.trim(), ctrl.signal))
      } catch (e) {
        if (e.name === 'AbortError') return
        setGifs([])
        setError(e.message === 'busy'
          ? 'Lots of GIF searches this hour — try again in a little while.'
          : 'GIF search isn’t working right now. Check your connection and try again.')
      }
    }, q ? 550 : 0)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q])

  return (
    <Sheet title="Send a GIF" onClose={onClose}>
      <div className="gif-picker">
        <input ref={input} className="gif-search" type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search GIFs…" enterKeyHint="search" aria-label="Search GIFs" />
        {!q && (
          <div className="gif-chips">
            {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => setQ(s)}>{s}</button>)}
          </div>
        )}
        {error && <div className="error">{error}</div>}
        <div className="gif-scroll">
        <div className="gif-grid">
          {gifs === null && Array.from({ length: 8 }).map((_, i) => <span key={i} className="gif-cell skeleton" />)}
          {gifs?.map((g) => (
            <button key={g.id} type="button" className="gif-cell" onClick={() => onPick(g)} aria-label={`Send ${g.title}`}>
              <img src={g.thumb} alt="" loading="lazy" />
            </button>
          ))}
          {gifs?.length === 0 && !error && <p className="quiet center gif-none">No GIFs found. Try another word.</p>}
        </div>
        </div>
        <div className="giphy-credit">Powered by <b>GIPHY</b></div>
      </div>
    </Sheet>
  )
}
