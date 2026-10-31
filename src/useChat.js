import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useLive } from './useLive'

// Thread keys: 'group' for the family chat, otherwise the other person's user id.
export function threadOf(m, myId) {
  if (!m.recipient_id) return 'group'
  return m.sender_id === myId ? m.recipient_id : m.sender_id
}

export function useChat(familyId, myId) {
  const [messages, setMessages] = useState([])
  const [reads, setReads] = useState({})
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!familyId) return
    const [{ data: msgs }, { data: rs }] = await Promise.all([
      // the database only returns the group chat plus your own private conversations
      supabase.from('messages').select('*').eq('family_id', familyId).order('created_at', { ascending: false }).limit(1000),
      supabase.from('chat_reads').select('*').eq('family_id', familyId),
    ])
    setMessages((msgs || []).reverse())
    const map = {}
    ;(rs || []).forEach((r) => { map[r.thread] = r.last_read_at })
    setReads(map)
    setLoaded(true)
  }, [familyId])

  useEffect(() => { setLoaded(false); setMessages([]); setReads({}); load() }, [load])
  useLive(familyId, ['messages'], load)

  const threads = useMemo(() => {
    const t = {}
    for (const m of messages) {
      const k = threadOf(m, myId)
      const th = (t[k] ||= { key: k, messages: [], unread: 0, last: null })
      th.messages.push(m)
      th.last = m
      if (m.sender_id !== myId && (!reads[k] || m.created_at > reads[k])) th.unread++
    }
    return t
  }, [messages, reads, myId])

  const totalUnread = Object.values(threads).reduce((n, t) => n + t.unread, 0)

  const markRead = useCallback(async (thread) => {
    const at = new Date().toISOString()
    setReads((r) => ({ ...r, [thread]: at }))
    await supabase.from('chat_reads').upsert({ family_id: familyId, thread, last_read_at: at, user_id: myId })
  }, [familyId, myId])

  const send = useCallback(async (thread, body) => {
    const row = { family_id: familyId, sender_id: myId, recipient_id: thread === 'group' ? null : thread, body }
    const temp = { ...row, id: 'temp-' + Math.random(), created_at: new Date().toISOString(), pending: true }
    setMessages((ms) => [...ms, temp])
    const { data, error } = await supabase.from('messages').insert(row).select().single()
    setMessages((ms) => ms.map((m) => (m.id === temp.id ? (error ? { ...m, pending: false, failed: true } : data) : m)))
    return !error
  }, [familyId, myId])

  const remove = useCallback(async (id) => {
    setMessages((ms) => ms.filter((m) => m.id !== id))
    await supabase.from('messages').delete().eq('id', id)
  }, [])

  return { loaded, threads, totalUnread, markRead, send, remove }
}
