import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon, Avatar, buzz } from './ui'
import { prettyTime, dayKey } from './dates'
import { isGif } from './images'
import GifPicker from './GifPicker'

function when(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (dayKey(d) === dayKey(now)) return prettyTime(d)
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (dayKey(d) === dayKey(y)) return 'Yesterday'
  if (now - d < 6 * 86400000) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
function dayLabel(d) {
  const now = new Date()
  if (dayKey(d) === dayKey(now)) return 'Today'
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (dayKey(d) === dayKey(y)) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function Chat({ family, user, profiles, members, chat, thread, setThread }) {
  if (thread) {
    return <Thread key={thread} thread={thread} family={family} user={user} profiles={profiles} members={members} chat={chat} onBack={() => setThread(null)} />
  }
  return <Inbox family={family} user={user} profiles={profiles} members={members} chat={chat} onOpen={setThread} />
}

function Inbox({ family, user, profiles, members, chat, onOpen }) {
  const others = members.filter((m) => m.user_id !== user.id)
  const rows = [
    { key: 'group', name: family.name, group: true },
    ...others.map((m) => ({ key: m.user_id, name: profiles[m.user_id]?.display_name || 'Member', profile: profiles[m.user_id] })),
  ]
  // conversations with recent messages float to the top; the family chat stays first
  const dm = rows.slice(1).sort((a, b) => {
    const la = chat.threads[a.key]?.last?.created_at || ''
    const lb = chat.threads[b.key]?.last?.created_at || ''
    return lb.localeCompare(la) || a.name.localeCompare(b.name)
  })

  return (
    <div className="page narrow">
      <div className="page-head"><h1>Chat</h1></div>
      <div className="card chat-list">
        <InboxRow row={rows[0]} t={chat.threads.group} user={user} profiles={profiles} members={members} onOpen={onOpen} />
      </div>
      <div className="eyebrow chat-eyebrow">Private messages</div>
      {dm.length === 0 ? (
        <div className="card"><p className="quiet center pad">Once someone joins your family with your invite code, you can message them privately here.</p></div>
      ) : (
        <div className="card chat-list">
          {dm.map((r) => <InboxRow key={r.key} row={r} t={chat.threads[r.key]} user={user} profiles={profiles} members={members} onOpen={onOpen} />)}
        </div>
      )}
      <p className="quiet small center">🔒 Private messages are only seen by the two of you.</p>
    </div>
  )
}

function InboxRow({ row, t, user, profiles, members, onOpen }) {
  const last = t?.last
  let preview = row.group ? 'Everyone in the family' : 'Say hi 👋'
  if (last) {
    const who = last.sender_id === user.id ? 'You' : row.group ? profiles[last.sender_id]?.display_name : null
    const what = last.body?.trim() || (last.gif_url || isGif(last.image_path) ? 'GIF' : '📷 Photo')
    preview = (who ? who + ': ' : '') + what
  }
  return (
    <button className={`inbox-row ${t?.unread ? 'has-unread' : ''}`} onClick={() => onOpen(row.key)}>
      {row.group ? <GroupAvatar members={members} profiles={profiles} /> : <Avatar profile={row.profile} size={46} />}
      <span className="inbox-main">
        <span className="inbox-top">
          <span className="inbox-name">{row.group ? 'Family chat' : row.name}</span>
          {last && <span className="inbox-time">{when(last.created_at)}</span>}
        </span>
        <span className="inbox-bottom">
          <span className="inbox-preview">{preview}</span>
          {t?.unread > 0 && <span className="unread">{t.unread > 99 ? '99+' : t.unread}</span>}
        </span>
      </span>
    </button>
  )
}

function GroupAvatar({ members, profiles }) {
  const ps = members.slice(0, 3).map((m) => profiles[m.user_id]).filter(Boolean)
  return (
    <span className="group-avatar" aria-hidden="true">
      {ps.map((p, i) => <span key={p.id} className={`ga ga${i}`}><Avatar profile={p} size={ps.length === 1 ? 46 : 28} /></span>)}
    </span>
  )
}

function Thread({ thread, family, user, profiles, members, chat, onBack }) {
  const isGroup = thread === 'group'
  const other = isGroup ? null : profiles[thread]
  const stillMember = isGroup || members.some((m) => m.user_id === thread)
  const msgs = chat.threads[thread]?.messages || []
  const [text, setText] = useState('')
  const [picked, setPicked] = useState(null)
  const [file, setFile] = useState(null) // photo waiting to be sent
  const [filePreview, setFilePreview] = useState(null)
  const [viewing, setViewing] = useState(null)
  const fileInput = useRef(null)
  const [gifOpen, setGifOpen] = useState(false)
  const scroller = useRef(null)
  const input = useRef(null)
  const lastId = msgs[msgs.length - 1]?.id

  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastId])

  useEffect(() => {
    if (chat.threads[thread]?.unread) chat.markRead(thread)
  }, [lastId, thread]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { chat.markRead(thread) }, [thread]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body && !file) return
    const f = file
    setText(''); setFile(null); setFilePreview(null)
    if (input.current) input.current.style.height = 'auto'
    buzz(8)
    if (!f) input.current?.focus()
    await chat.send(thread, body, f)
  }

  const items = []
  let prevDay = null
  msgs.forEach((m, i) => {
    const d = new Date(m.created_at)
    const k = dayKey(d)
    if (k !== prevDay) { items.push({ sep: true, key: 'd' + k, label: dayLabel(d) }); prevDay = k }
    const prev = msgs[i - 1]
    const next = msgs[i + 1]
    const sameAsPrev = prev && prev.sender_id === m.sender_id && dayKey(new Date(prev.created_at)) === k && d - new Date(prev.created_at) < 5 * 60000
    const sameAsNext = next && next.sender_id === m.sender_id && dayKey(new Date(next.created_at)) === k && new Date(next.created_at) - d < 5 * 60000
    items.push({ m, first: !sameAsPrev, last: !sameAsNext })
  })

  return (
    <div className="thread">
      <div className="thread-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back to chats"><Icon name="left" /></button>
        {isGroup ? <GroupAvatar members={members} profiles={profiles} /> : <Avatar profile={other} size={38} />}
        <div className="thread-title">
          <div className="thread-name">{isGroup ? 'Family chat' : other?.display_name || 'Member'}</div>
          <div className="quiet small">{isGroup ? `${members.length} ${members.length === 1 ? 'person' : 'people'} · ${family.name}` : '🔒 Private between you two'}</div>
        </div>
      </div>

      <div className="thread-scroll" ref={scroller} onClick={(e) => { if (e.target === e.currentTarget) setPicked(null) }}>
        {msgs.length === 0 && (
          <div className="thread-empty">
            <div className="empty-emoji">{isGroup ? '👨‍👩‍👧‍👦' : '💬'}</div>
            <p>{isGroup ? 'Everyone in the family will see messages here.' : `Start a private conversation with ${other?.display_name || 'them'}.`}</p>
          </div>
        )}
        {items.map((it) =>
          it.sep ? (
            <div key={it.key} className="day-sep"><span>{it.label}</span></div>
          ) : (
            <Bubble key={it.m.id} m={it.m} mine={it.m.sender_id === user.id} first={it.first} last={it.last}
              showName={isGroup} profile={profiles[it.m.sender_id]}
              src={it.m.gif_url || it.m.local_url || chat.urls[it.m.image_path]} onView={setViewing}
              picked={picked === it.m.id} onPick={() => setPicked(picked === it.m.id ? null : it.m.id)}
              onDelete={() => { chat.remove(it.m.id); setPicked(null) }} />
          )
        )}
      </div>

      {stillMember ? (
        <form className="composer" onSubmit={submit}>
          {filePreview && (
            <div className="attach-preview">
              <img src={filePreview} alt="Photo to send" />
              <button type="button" className="attach-x" aria-label="Remove photo" onClick={() => { setFile(null); setFilePreview(null) }}><Icon name="x" size={14} /></button>
            </div>
          )}
          <div className="composer-row">
          <input ref={fileInput} type="file" accept="image/*" hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              if (f.size > 15 * 1024 * 1024) { alert('That file is over 15 MB. Try a smaller photo or GIF.'); return }
              setFile(f); setFilePreview(URL.createObjectURL(f))
            }} />
          <button type="button" className="attach" aria-label="Add a photo" onClick={() => fileInput.current?.click()}><Icon name="image" size={22} /></button>
          <button type="button" className="attach gif-btn" aria-label="Send a GIF" onClick={() => setGifOpen(true)}>GIF</button>
          <textarea ref={input} value={text} rows={1} maxLength={4000}
            placeholder={file ? 'Add a caption…' : isGroup ? 'Message the family…' : `Message ${other?.display_name || ''}…`}
            aria-label="Message"
            enterKeyHint="send"
            onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) submit(e)
            }} />
          <button className="send" disabled={!text.trim() && !file} aria-label="Send"><Icon name="send" size={20} /></button>
          </div>
        </form>
      ) : (
        <div className="composer gone quiet small">This person is no longer in the family.</div>
      )}
      {gifOpen && (
        <GifPicker onClose={() => setGifOpen(false)}
          onPick={(g) => { setGifOpen(false); buzz(8); chat.send(thread, '', null, g) }} />
      )}
      {viewing && (
        <div className="viewer" onClick={() => setViewing(null)} role="dialog" aria-label="Photo">
          <img src={viewing.src} alt="" />
          <button className="viewer-x" aria-label="Close"><Icon name="x" size={22} /></button>
          {viewing.m.sender_id === user.id && !viewing.m.pending && (
            <button className="viewer-del" onClick={(e) => { e.stopPropagation(); chat.remove(viewing.m.id); setViewing(null) }}>
              <Icon name="trash" size={18} /> Delete photo
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Bubble({ m, mine, first, last, showName, profile, picked, onPick, onDelete, src, onView }) {
  const hasImg = m.image_path || m.local_url || m.gif_url
  const ratio = m.image_w && m.image_h ? m.image_w / m.image_h : 1
  return (
    <div className={`msg ${mine ? 'mine' : 'theirs'} ${first ? 'first' : ''} ${last ? 'last' : ''}`}>
      {!mine && <span className="msg-av">{last && <Avatar profile={profile} size={28} />}</span>}
      <div className="msg-col">
        {!mine && showName && first && <span className="msg-name" style={{ color: profile?.color }}>{profile?.display_name || 'Member'}</span>}
        {hasImg && (
          <button type="button" className={`photo ${m.pending ? 'sending' : ''}`} style={{ aspectRatio: String(Math.max(0.5, Math.min(2, ratio))) }}
            onClick={() => (src ? onView({ src, m }) : null)} onContextMenu={(e) => { e.preventDefault(); onPick() }} aria-label="Open photo">
            {src ? <img src={src} alt="" loading="lazy" draggable="false" /> : <span className="photo-wait" />}
            {(m.gif_url || isGif(m.image_path)) && <span className="gif-tag">GIF</span>}
          </button>
        )}
        {m.body?.trim() && <button type="button" className="bubble" onClick={onPick}>{m.body}</button>}
        {(last || picked) && (
          <span className="msg-meta">
            {m.failed ? 'Not sent — check your connection' : m.pending ? 'Sending…' : prettyTime(new Date(m.created_at))}
            {picked && mine && !m.pending && <button type="button" className="link small danger" onClick={onDelete}>Delete</button>}
          </span>
        )}
      </div>
    </div>
  )
}
