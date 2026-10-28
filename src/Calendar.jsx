import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, errMsg } from './supabase'
import { MONTHS, DOW, dayKey, fromDayKey, monthGrid, eventDays, prettyTime, prettyDay, shortDay, combine, timeStr } from './dates'
import { Icon, Avatar, Sheet, Empty } from './ui'
import { useLive } from './useLive'

export default function Calendar({ family, profiles }) {
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState(dayKey(today))
  const [events, setEvents] = useState([])
  const [editing, setEditing] = useState(null) // {} for new, event for edit

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

  useEffect(() => { load() }, [load])
  useLive(family.id, ['events'], load)

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
        <div className="cal-grid">
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
                    <span key={ev.id} className="chip" style={{ '--c': profiles[ev.created_by]?.color || '#FF7A59' }}>{ev.title}</span>
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
              {selEvents.map((ev) => <EventRow key={ev.id} ev={ev} profiles={profiles} onClick={() => setEditing(ev)} />)}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="eyebrow">Coming up</div>
          {upcoming.length === 0 ? (
            <Empty emoji="🗓️" title="A clear calendar">Add birthdays, practices, trips — anything the family should know about.</Empty>
          ) : (
            <ul className="event-list">
              {upcoming.map((ev) => <EventRow key={ev.id} ev={ev} profiles={profiles} showDate onClick={() => setEditing(ev)} />)}
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
          onClose={() => setEditing(null)}
          onSaved={(k) => { setEditing(null); load(); if (k) { setSelected(k); const d = fromDayKey(k); setCursor({ y: d.getFullYear(), m: d.getMonth() }) } }}
        />
      )}
    </div>
  )
}

function EventRow({ ev, profiles, showDate, onClick }) {
  const s = new Date(ev.starts_at)
  const e = ev.ends_at ? new Date(ev.ends_at) : null
  const who = profiles[ev.created_by]
  return (
    <li>
      <button className="event-row" onClick={onClick} style={{ '--c': who?.color || '#FF7A59' }}>
        <span className="bar" />
        <span className="ev-main">
          <span className="ev-title">{ev.title}</span>
          <span className="ev-meta">
            {showDate && <>{shortDay(s)} · </>}
            {ev.all_day ? 'All day' : <>{prettyTime(s)}{e && ` – ${prettyTime(e)}`}</>}
            {ev.location && <> · {ev.location}</>}
          </span>
        </span>
        <Avatar profile={who} size={26} />
      </button>
    </li>
  )
}

function EventForm({ initial, family, profiles, onClose, onSaved }) {
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
      <form className="form" onSubmit={save}>
        <label>What’s happening?
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leo’s soccer game" required maxLength={120} autoFocus />
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
        <label>Where <span className="opt">optional</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Riverside Park, field 3" maxLength={160} />
        </label>
        <label>Notes <span className="opt">optional</span>
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
