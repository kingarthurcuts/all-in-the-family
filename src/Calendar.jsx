import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, errMsg } from './supabase'
import { MONTHS, DOW, dayKey, fromDayKey, monthGrid, eventDays, prettyTime, prettyDay, shortDay, combine, timeStr } from './dates'
import { Icon, Avatar, Sheet, Empty, isTouch, buzz } from './ui'
import { useLive } from './useLive'

// Event types. `rsvp` = whether new events of this type ask for RSVPs by default.
export const CATEGORIES = [
  { id: 'general', label: 'Plans', emoji: '📅' },
  { id: 'birthday', label: 'Birthday', emoji: '🎂', rsvp: true },
  { id: 'party', label: 'Party', emoji: '🎉', rsvp: true },
  { id: 'dinner', label: 'Dinner', emoji: '🍽️', rsvp: true },
  { id: 'sports', label: 'Practice / Game', emoji: '⚽' },
  { id: 'appointment', label: 'Appointment', emoji: '🩺' },
  { id: 'trip', label: 'Trip', emoji: '✈️', rsvp: true },
  { id: 'school', label: 'School', emoji: '🎒' },
]
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))
const catOf = (ev) => CAT[ev.category] || CAT.general
const RSVP_CHOICES = [
  { id: 'yes', label: 'Going', emoji: '👍' },
  { id: 'maybe', label: 'Maybe', emoji: '🤔' },
  { id: 'no', label: 'Can’t make it', emoji: '🙅' },
]

export default function Calendar({ family, user, profiles, members }) {
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState(dayKey(today))
  const [events, setEvents] = useState([])
  const [rsvps, setRsvps] = useState([])
  const [editing, setEditing] = useState(null) // {} for new, event for edit
  const swipe = useRef(null)

  const days = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor])
  const rangeStart = days[0]
  const rangeEnd = new Date(days[days.length - 1].getTime() + 86400000)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('family_id', family.id)
      .lt('starts_at', rangeEnd.toISOString())
      .or(`ends_at.gte.${rangeStart.toISOString()},and(ends_at.is.null,starts_at.gte.${rangeStart.toISOString()})`)
      .order('starts_at')
    setEvents(data || [])
  }, [family.id, rangeStart.getTime(), rangeEnd.getTime()])

  const loadRsvps = useCallback(async () => {
    const { data } = await supabase.from('event_rsvps').select('*').eq('family_id', family.id)
    setRsvps(data || [])
  }, [family.id])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadRsvps() }, [loadRsvps])
  useLive(family.id, ['events'], load)
  useLive(family.id, ['event_rsvps'], loadRsvps)

  const rsvpsFor = (id) => rsvps.filter((r) => r.event_id === id)

  const byDay = useMemo(() => {
    const map = {}
    events.forEach((ev) => eventDays(ev).forEach((k) => { (map[k] ||= []).push(ev) }))
    return map
  }, [events])

  const [upcoming, setUpcoming] = useState([])
  const loadUpcoming = useCallback(async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('events').select('*').eq('family_id', family.id)
      .gte('starts_at', start.toISOString()).order('starts_at').limit(6)
    setUpcoming(data || [])
  }, [family.id])
  useEffect(() => { loadUpcoming() }, [loadUpcoming, events])

  const shift = (n) => setCursor(({ y, m }) => {
    const d = new Date(y, m + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const goToday = () => { setCursor({ y: today.getFullYear(), m: today.getMonth() }); setSelected(dayKey(today)) }

  const selDate = fromDayKey(selected)
  const selEvents = byDay[selected] || []
  const todayKey = dayKey(today)

  return (
    <div className="cal-layout">
      <section className="card cal-card">
        <div className="cal-head">
          <h1>{MONTHS[cursor.m]} <span className="muted-num">{cursor.y}</span></h1>
          <div className="cal-nav">
            <button className="btn ghost small" onClick={goToday}>Today</button>
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="left" /></button>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><Icon name="right" /></button>
          </div>
        </div>
        <div className="cal-grid"
          onTouchStart={(e) => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
          onTouchEnd={(e) => {
            const s = swipe.current; swipe.current = null
            if (!s) return
            const dx = e.changedTouches[0].clientX - s.x
            const dy = e.changedTouches[0].clientY - s.y
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1)
          }}>
          {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
          {days.map((d) => {
            const k = dayKey(d)
            const evs = byDay[k] || []
            const out = d.getMonth() !== cursor.m
            return (
              <button key={k}
                className={`day ${out ? 'out' : ''} ${k === todayKey ? 'today' : ''} ${k === selected ? 'sel' : ''}`}
                onClick={() => setSelected(k)}
                onDoubleClick={() => setEditing({ date: k })}
                aria-label={`${prettyDay(d)}, ${evs.length} events`}>
                <span className="num">{d.getDate()}</span>
                <span className="chips">
                  {evs.slice(0, 3).map((ev) => (
                    <span key={ev.id} className="chip" style={{ '--c': profiles[ev.created_by]?.color || '#FF7A59' }}>{catOf(ev).emoji} {ev.title}</span>
                  ))}
                  {evs.length > 3 && <span className="more">+{evs.length - 3}</span>}
                </span>
                <span className="dots">
                  {evs.slice(0, 4).map((ev) => <i key={ev.id} style={{ background: profiles[ev.created_by]?.color || '#FF7A59' }} />)}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <aside className="cal-side">
        <section className="card">
          <div className="side-head">
            <div>
              <div className="eyebrow">{selected === todayKey ? 'Today' : 'Selected day'}</div>
              <h2>{prettyDay(selDate)}</h2>
            </div>
            <button className="btn primary small" onClick={() => setEditing({ date: selected })}><Icon name="plus" size={18} /> Add</button>
          </div>
          {selEvents.length === 0 ? (
            <p className="quiet">Nothing planned. Tap Add to put something on the calendar.</p>
          ) : (
            <ul className="event-list">
              {selEvents.map((ev) => <EventRow key={ev.id} ev={ev} profiles={profiles} rsvps={rsvpsFor(ev.id)} user={user} onClick={() => setEditing(ev)} />)}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="eyebrow">Coming up</div>
          {upcoming.length === 0 ? (
            <Empty emoji="🗓️" title="A clear calendar">Add birthdays, practices, trips — anything the family should know about.</Empty>
          ) : (
            <ul className="event-list">
              {upcoming.map((ev) => <EventRow key={ev.id} ev={ev} profiles={profiles} rsvps={rsvpsFor(ev.id)} user={user} showDate onClick={() => setEditing(ev)} />)}
            </ul>
          )}
        </section>
      </aside>

      <button className="fab" onClick={() => setEditing({ date: selected })} aria-label="Add event"><Icon name="plus" size={26} /></button>

      {editing && (
        <EventForm
          initial={editing}
          family={family}
          profiles={profiles}
          user={user}
          members={members}
          rsvps={editing.id ? rsvpsFor(editing.id) : []}
          setRsvps={setRsvps}
          onClose={() => setEditing(null)}
          onSaved={(k) => { setEditing(null); load(); if (k) { setSelected(k); const d = fromDayKey(k); setCursor({ y: d.getFullYear(), m: d.getMonth() }) } }}
        />
      )}
    </div>
  )
}

function EventRow({ ev, profiles, rsvps, user, showDate, onClick }) {
  const s = new Date(ev.starts_at)
  const e = ev.ends_at ? new Date(ev.ends_at) : null
  const who = profiles[ev.created_by]
  return (
    <li>
      <button className="event-row" onClick={onClick} style={{ '--c': who?.color || '#FF7A59' }}>
        <span className="bar" />
        <span className="ev-main">
          <span className="ev-title"><span className="ev-emoji" aria-label={catOf(ev).label}>{catOf(ev).emoji}</span> {ev.title}</span>
          <span className="ev-meta">
            {showDate && <>{shortDay(s)} · </>}
            {ev.all_day ? 'All day' : <>{prettyTime(s)}{e && ` – ${prettyTime(e)}`}</>}
            {ev.location && <> · {ev.location}</>}
          </span>
          {ev.rsvp && <RsvpSummary rsvps={rsvps} user={user} />}
        </span>
        <Avatar profile={who} size={26} />
      </button>
    </li>
  )
}

function RsvpSummary({ rsvps = [], user }) {
  const going = rsvps.filter((r) => r.status === 'yes').length
  const maybe = rsvps.filter((r) => r.status === 'maybe').length
  const mine = rsvps.find((r) => r.user_id === user?.id)
  return (
    <span className="ev-rsvp">
      {going} going{maybe > 0 && ` · ${maybe} maybe`}
      {mine ? <span className="rsvp-you"> · you: {RSVP_CHOICES.find((c) => c.id === mine.status)?.label}</span>
        : <span className="rsvp-ask"> · RSVP</span>}
    </span>
  )
}

function RsvpPanel({ event, user, members, profiles, rsvps, setRsvps }) {
  const [error, setError] = useState('')
  const mine = rsvps.find((r) => r.user_id === user.id)?.status
  async function answer(status) {
    setError('')
    buzz()
    const prev = rsvps
    if (mine === status) {
      setRsvps((all) => all.filter((r) => !(r.event_id === event.id && r.user_id === user.id)))
      const { error } = await supabase.from('event_rsvps').delete().eq('event_id', event.id).eq('user_id', user.id)
      if (error) { setError(errMsg(error)); setRsvps((all) => [...all, ...prev.filter((r) => r.user_id === user.id)]) }
      return
    }
    const row = { event_id: event.id, family_id: event.family_id, user_id: user.id, status, updated_at: new Date().toISOString() }
    setRsvps((all) => [...all.filter((r) => !(r.event_id === event.id && r.user_id === user.id)), row])
    const { error } = await supabase.from('event_rsvps').upsert(row, { onConflict: 'event_id,user_id' })
    if (error) setError(errMsg(error))
  }
  const by = (st) => rsvps.filter((r) => r.status === st)
  const answered = new Set(rsvps.map((r) => r.user_id))
  const waiting = members.filter((m) => !answered.has(m.user_id))
  return (
    <section className="rsvp-panel">
      <div className="field-label">Are you coming?</div>
      <div className="rsvp-btns">
        {RSVP_CHOICES.map((c) => (
          <button type="button" key={c.id} className={`rsvp-btn ${mine === c.id ? 'on ' + c.id : ''}`} onClick={() => answer(c.id)} aria-pressed={mine === c.id}>
            <span aria-hidden="true">{c.emoji}</span> {c.label}
          </button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      <ul className="rsvp-list">
        {RSVP_CHOICES.map((c) => by(c.id).length > 0 && (
          <li key={c.id}><span className="rsvp-k">{c.label} · {by(c.id).length}</span>
            <span className="rsvp-people">{by(c.id).map((r) => <span key={r.user_id} className="rsvp-person"><Avatar profile={profiles[r.user_id]} size={22} />{profiles[r.user_id]?.display_name || 'Member'}</span>)}</span></li>
        ))}
        {waiting.length > 0 && (
          <li><span className="rsvp-k">No answer yet · {waiting.length}</span>
            <span className="rsvp-people">{waiting.map((m) => <span key={m.user_id} className="rsvp-person quiet"><Avatar profile={profiles[m.user_id]} size={22} />{profiles[m.user_id]?.display_name || 'Member'}</span>)}</span></li>
        )}
      </ul>
    </section>
  )
}

function EventForm({ initial, family, profiles, user, members, rsvps, setRsvps, onClose, onSaved }) {
  const isNew = !initial.id
  const s = initial.starts_at ? new Date(initial.starts_at) : null
  const e = initial.ends_at ? new Date(initial.ends_at) : null
  const [title, setTitle] = useState(initial.title || '')
  const [date, setDate] = useState(s ? dayKey(s) : initial.date)
  const [endDate, setEndDate] = useState(e ? dayKey(e) : (s ? dayKey(s) : initial.date))
  const [allDay, setAllDay] = useState(initial.all_day ?? false)
  const [start, setStart] = useState(s && !initial.all_day ? timeStr(s) : '17:00')
  const [end, setEnd] = useState(e && !initial.all_day ? timeStr(e) : '18:00')
  const [location, setLocation] = useState(initial.location || '')
  const [notes, setNotes] = useState(initial.notes || '')
  const [category, setCategory] = useState(initial.category || 'general')
  const [rsvp, setRsvp] = useState(initial.rsvp ?? false)
  const [rsvpTouched, setRsvpTouched] = useState(!isNew)
  const pickCategory = (id) => { setCategory(id); if (!rsvpTouched) setRsvp(!!CAT[id]?.rsvp) }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(ev) {
    ev.preventDefault()
    setError('')
    const endD = endDate < date ? date : endDate
    const startsAt = allDay ? combine(date, '00:00') : combine(date, start)
    let endsAt = allDay ? combine(endD, '23:59') : combine(endD, end)
    if (endsAt < startsAt) { setError('The end time is before the start time.'); return }
    setBusy(true)
    const row = {
      title: title.trim(), location: location.trim() || null, notes: notes.trim() || null,
      category, rsvp,
      all_day: allDay, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
    }
    const q = isNew
      ? supabase.from('events').insert({ ...row, family_id: family.id })
      : supabase.from('events').update(row).eq('id', initial.id)
    const { error } = await q
    setBusy(false)
    if (error) setError(errMsg(error))
    else onSaved(date)
  }

  async function remove() {
    if (!confirmDelete()) return
    setBusy(true)
    const { error } = await supabase.from('events').delete().eq('id', initial.id)
    setBusy(false)
    if (error) setError(errMsg(error))
    else onSaved()
  }

  const [armed, setArmed] = useState(false)
  function confirmDelete() {
    if (armed) return true
    setArmed(true)
    setTimeout(() => setArmed(false), 3000)
    return false
  }

  return (
    <Sheet title={isNew ? 'New event' : 'Edit event'} onClose={onClose}>
      {!isNew && initial.rsvp && (
        <RsvpPanel event={initial} user={user} members={members} profiles={profiles} rsvps={rsvps} setRsvps={setRsvps} />
      )}
      <form className="form" onSubmit={save}>
        <div>
          <div className="field-label">Type of event</div>
          <div className="cat-pick" role="radiogroup" aria-label="Type of event">
            {CATEGORIES.map((c) => (
              <button type="button" key={c.id} role="radio" aria-checked={category === c.id}
                className={`cat-chip ${category === c.id ? 'on' : ''}`} onClick={() => pickCategory(c.id)}>
                <span aria-hidden="true">{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>
        </div>
        <label>What’s happening?
          <input value={title} onChange={(e) => setTitle(e.target.value)}  placeholder={category === 'birthday' ? 'Grandma’s 70th birthday' : category === 'dinner' ? 'Sunday family dinner' : 'Soccer practice'} required maxLength={120} autoFocus={isNew && !isTouch()} enterKeyHint="next" />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span className="switch" /> All day
        </label>
        <div className="row2">
          <label>Starts
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value) }} required />
          </label>
          {!allDay && <label>Time<input type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></label>}
        </div>
        <div className="row2">
          <label>Ends
            <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} required />
          </label>
          {!allDay && <label>Time<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required /></label>}
        </div>
        <label><span>Where <span className="opt">optional</span></span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Riverside Park, field 3" maxLength={160} />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={rsvp} onChange={(e) => { setRsvp(e.target.checked); setRsvpTouched(true) }} />
          <span className="switch" /> Ask everyone to RSVP
        </label>
        <label><span>Notes <span className="opt">optional</span></span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Bring snacks and the blue jersey" maxLength={2000} />
        </label>
        {!isNew && (
          <p className="quiet small">Added by {profiles[initial.created_by]?.display_name || 'someone'}.</p>
        )}
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          {!isNew && (
            <button type="button" className={`btn danger ${armed ? 'armed' : ''}`} onClick={remove} disabled={busy}>
              <Icon name="trash" size={18} /> {armed ? 'Tap again to delete' : 'Delete'}
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Sheet>
  )
}
