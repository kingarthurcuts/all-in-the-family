import { useCallback, useEffect, useState } from 'react'
import { supabase, errMsg } from './supabase'
import { Icon, Avatar, Sheet, Empty } from './ui'
import { useLive } from './useLive'
import { relative, shortDay, prettyTime } from './dates'

export default function Polls({ family, user, profiles, members }) {
  const [polls, setPolls] = useState(null)
  const [options, setOptions] = useState([])
  const [votes, setVotes] = useState([])
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState('open')

  const load = useCallback(async () => {
    const [{ data: p }, { data: o }, { data: v }] = await Promise.all([
      supabase.from('polls').select('*').eq('family_id', family.id).order('created_at', { ascending: false }),
      supabase.from('poll_options').select('*').eq('family_id', family.id).order('created_at'),
      supabase.from('poll_votes').select('*').eq('family_id', family.id),
    ])
    setPolls(p || []); setOptions(o || []); setVotes(v || [])
  }, [family.id])

  useEffect(() => { load() }, [load])
  useLive(family.id, ['polls', 'poll_options', 'poll_votes'], load)

  if (polls === null) return null
  const isClosed = (p) => p.closed || (p.closes_at && new Date(p.closes_at) <= new Date())
  const shown = polls.filter((p) => (filter === 'open' ? !isClosed(p) : isClosed(p)))

  return (
    <div className="page narrow">
      <div className="page-head">
        <h1>Polls</h1>
        <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={18} /> New poll</button>
      </div>
      <div className="seg">
        <button className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>Open · {polls.filter((p) => !isClosed(p)).length}</button>
        <button className={filter === 'closed' ? 'on' : ''} onClick={() => setFilter('closed')}>Closed · {polls.filter(isClosed).length}</button>
      </div>
      {shown.length === 0 ? (
        <div className="card">
          {filter === 'open'
            ? <Empty emoji="🗳️" title="No open polls">Pizza or tacos? Beach or mountains? Start a poll and let the family vote.</Empty>
            : <Empty emoji="📦" title="No closed polls yet">Finished polls show up here with their results.</Empty>}
        </div>
      ) : (
        <div className="stack">
          {shown.map((p) => (
            <PollCard key={p.id} poll={p} closed={isClosed(p)} user={user} profiles={profiles} memberCount={members.length}
              options={options.filter((o) => o.poll_id === p.id)} votes={votes.filter((v) => v.poll_id === p.id)}
              setVotes={setVotes} reload={load} />
          ))}
        </div>
      )}
      <button className="fab" onClick={() => setCreating(true)} aria-label="New poll"><Icon name="plus" size={26} /></button>
      {creating && <NewPoll family={family} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setFilter('open'); load() }} />}
    </div>
  )
}

function PollCard({ poll, closed, options, votes, user, profiles, memberCount, setVotes, reload }) {
  const [busy, setBusy] = useState(false)
  const [armed, setArmed] = useState(false)
  const mine = new Set(votes.filter((v) => v.user_id === user.id).map((v) => v.option_id))
  const voters = new Set(votes.map((v) => v.user_id))
  const counts = Object.fromEntries(options.map((o) => [o.id, votes.filter((v) => v.option_id === o.id)]))
  const max = Math.max(0, ...Object.values(counts).map((a) => a.length))
  const author = profiles[poll.created_by]
  const isMine = poll.created_by === user.id

  async function vote(opt) {
    if (closed || busy) return
    setBusy(true)
    const base = { poll_id: poll.id, family_id: poll.family_id, user_id: user.id }
    if (mine.has(opt.id)) {
      setVotes((all) => all.filter((v) => !(v.option_id === opt.id && v.user_id === user.id)))
      await supabase.from('poll_votes').delete().eq('option_id', opt.id).eq('user_id', user.id)
    } else {
      if (!poll.allow_multiple && mine.size) {
        setVotes((all) => all.filter((v) => !(v.poll_id === poll.id && v.user_id === user.id)))
        await supabase.from('poll_votes').delete().eq('poll_id', poll.id).eq('user_id', user.id)
      }
      setVotes((all) => [...all, { ...base, option_id: opt.id }])
      const { error } = await supabase.from('poll_votes').insert({ ...base, option_id: opt.id })
      if (error) reload()
    }
    setBusy(false)
  }
  async function closePoll() {
    await supabase.from('polls').update({ closed: !poll.closed, closes_at: poll.closed ? null : poll.closes_at }).eq('id', poll.id)
    reload()
  }
  async function del() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return }
    await supabase.from('polls').delete().eq('id', poll.id)
    reload()
  }

  return (
    <article className={`card poll ${closed ? 'is-closed' : ''}`}>
      <div className="poll-head">
        <Avatar profile={author} size={30} />
        <div className="poll-by">
          <span><b>{author?.display_name || 'Someone'}</b> asked · {relative(poll.created_at)}</span>
          <span className="quiet small">
            {poll.allow_multiple ? 'Pick as many as you like' : 'Pick one'}
            {closed ? ' · Closed' : poll.closes_at ? ` · Closes ${shortDay(new Date(poll.closes_at))} ${prettyTime(new Date(poll.closes_at))}` : ''}
          </span>
        </div>
        {closed && <span className="badge"><Icon name="lock" size={14} /> Closed</span>}
      </div>
      <h2 className="poll-q">{poll.question}</h2>
      <ul className="options">
        {options.map((o) => {
          const vs = counts[o.id]
          const pct = voters.size ? Math.round((vs.length / voters.size) * 100) : 0
          const lead = closed && vs.length > 0 && vs.length === max
          return (
            <li key={o.id}>
              <button className={`option ${mine.has(o.id) ? 'mine' : ''} ${lead ? 'lead' : ''}`} onClick={() => vote(o)} disabled={closed}>
                <span className="fill" style={{ width: pct + '%' }} />
                <span className={`pick ${poll.allow_multiple ? 'sq' : ''}`}>{mine.has(o.id) && <Icon name="check" size={14} />}</span>
                <span className="opt-label">{lead && '🏆 '}{o.label}</span>
                <span className="opt-voters">{vs.slice(0, 5).map((v) => <Avatar key={v.user_id} profile={profiles[v.user_id]} size={20} />)}</span>
                <span className="opt-count">{vs.length}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="poll-foot">
        <span className="quiet small">{voters.size} of {memberCount} voted</span>
        <span className="spacer" />
        {isMine && (
          <>
            <button className="link small" onClick={closePoll}>{poll.closed ? 'Reopen' : closed ? '' : 'Close poll'}</button>
            <button className={`link small danger ${armed ? 'armed' : ''}`} onClick={del}>{armed ? 'Tap again to delete' : 'Delete'}</button>
          </>
        )}
      </div>
    </article>
  )
}

function NewPoll({ family, onClose, onCreated }) {
  const [question, setQuestion] = useState('')
  const [opts, setOpts] = useState(['', ''])
  const [multi, setMulti] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    const clean = [...new Set(opts.map((o) => o.trim()).filter(Boolean))]
    if (clean.length < 2) { setError('Add at least two choices.'); return }
    setBusy(true); setError('')
    const { data: poll, error } = await supabase.from('polls').insert({
      family_id: family.id, question: question.trim(), allow_multiple: multi,
      closes_at: deadline ? new Date(deadline).toISOString() : null,
    }).select().single()
    if (error) { setBusy(false); setError(errMsg(error)); return }
    const { error: e2 } = await supabase.from('poll_options').insert(clean.map((label) => ({ poll_id: poll.id, family_id: family.id, label })))
    setBusy(false)
    if (e2) setError(errMsg(e2))
    else onCreated()
  }

  return (
    <Sheet title="New poll" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>Question
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What should we do Saturday?" required maxLength={200} autoFocus />
        </label>
        <div className="field-label">Choices</div>
        {opts.map((o, i) => (
          <div className="opt-row" key={i}>
            <input value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Choice ${i + 1}`} maxLength={100} aria-label={`Choice ${i + 1}`} />
            {opts.length > 2 && <button type="button" className="icon-btn" onClick={() => setOpts(opts.filter((_, j) => j !== i))} aria-label="Remove choice"><Icon name="x" size={18} /></button>}
          </div>
        ))}
        {opts.length < 10 && <button type="button" className="link left" onClick={() => setOpts([...opts, ''])}>+ Add another choice</button>}
        <label className="toggle">
          <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
          <span className="switch" /> Let people pick more than one
        </label>
        <label>Voting ends <span className="opt">optional</span>
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Posting…' : 'Post poll'}</button>
        </div>
      </form>
    </Sheet>
  )
}
