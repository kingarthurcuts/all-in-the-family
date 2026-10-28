import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// Re-run `reload` whenever any of `tables` changes for this family (plus on tab focus).
export function useLive(familyId, tables, reload) {
  const ref = useRef(reload)
  ref.current = reload
  useEffect(() => {
    if (!familyId) return
    let t
    const bump = () => { clearTimeout(t); t = setTimeout(() => ref.current(), 150) }
    const ch = supabase.channel(`live-${familyId}-${tables.join('-')}-${Math.random().toString(36).slice(2)}`)
    tables.forEach((table) => {
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` }, bump)
      ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, bump)
    })
    ch.subscribe()
    const onVis = () => document.visibilityState === 'visible' && bump()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(t)
      supabase.removeChannel(ch)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [familyId, tables.join(',')])
}
