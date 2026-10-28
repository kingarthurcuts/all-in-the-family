export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad = (n) => String(n).padStart(2, '0')

// yyyy-mm-dd for a local date
export function dayKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function fromDayKey(k) {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function timeStr(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export function combine(dateKey, time) {
  const d = fromDayKey(dateKey)
  const [h, m] = (time || '00:00').split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}
export function prettyTime(d) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
export function prettyDay(d) {
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}
export function shortDay(d) {
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}
export function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  const days = []
  for (let i = 0; i < 42; i++) days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  // trim a trailing empty week
  if (days[35].getMonth() !== month) days.length = 35
  return days
}
// every local day an event covers
export function eventDays(ev) {
  const s = new Date(ev.starts_at)
  const e = ev.ends_at ? new Date(ev.ends_at) : s
  const keys = []
  const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate())
  const last = new Date(e.getFullYear(), e.getMonth(), e.getDate())
  let guard = 0
  while (cur <= last && guard++ < 62) {
    keys.push(dayKey(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return keys.length ? keys : [dayKey(s)]
}
export function relative(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
