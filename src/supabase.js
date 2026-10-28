import { createClient } from '@supabase/supabase-js'

// The publishable key is safe to ship in the browser — row-level security in the
// database decides who can see what. Env vars override these if set on Vercel.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://dglqtnirlvlzzndkeuol.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_LKscd_TpQ0mf5W4x885BqA_rux58TK4'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const COLORS = ['#FF7A59', '#2EC4B6', '#FFB703', '#8E7DBE', '#EF476F', '#06A77D', '#3A86FF', '#F4845F']

export function errMsg(e) {
  if (!e) return ''
  const m = e.message || String(e)
  if (/Invalid login credentials/i.test(m)) return 'That email and password don’t match. Try again?'
  if (/Email not confirmed/i.test(m)) return 'Check your inbox — you need to confirm your email first.'
  if (/rate limit/i.test(m)) return 'Too many emails sent recently. Wait a bit and try again.'
  return m
}
