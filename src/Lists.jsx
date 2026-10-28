import { useCallback, useEffect, useState } from 'react'
import { supabase, errMsg } from './supabase'
import { Icon, Avatar, Sheet, Empty } from './ui'
import { useLive } from './useLive'

const EMOJIS = ['📝', '🛒', '✅', '🎬', '🍕', '🧹', '🎁', '✈️', '📚', '🏡', '🎉', '💡']

export default function Lists({ family, user, profiles }) {
  const [lists, setLists] = useState(null)
  const [items, setItems] = useState([])
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const [{ data: ls }, { data: its }] = await Promise.all([
      supabase.from('lists').select('*').eq('family_id', family.id).order('created_at'),
      supabase.from('list_items').select('*').eq('family_id', family.id).order('created_at'),
    ])
    setLists(ls || [])
    setItems(its || [])
  }, [family.id])

  useEffect(() => { load() }, [load])
  useLive(family.id, ['lists', 'list_items'], load)

  if (lists === null) return null
  const open = lists.find((l) => l.id === openId)

  if (open) {
    return <ListDetail list={open} items={items.filter((i) => i.list_id === open.id)} setItems={setItems}
      user={user} profiles={profiles} onBack={() => setOpenId(null)} reload={load} />
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Lists</h1>
        <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" size={18} /> New list</button>
      </div>
      {lists.length === 0 ? (
        <div className="card"><Empty emoji="🛒" title="No lists yet">Groceries, chores, movies to watch, packing for a trip — make a list and everyone can add to it.</Empty></div>
      ) : (
        <div className="list-grid">
          {lists.map((l) => {
            const its = items.filter((i) => i.list_id === l.id)
            const done = its.filter((i) => i.done).length
            const pct = its.length ? Math.round((done / its.length) * 100) : 0
            return (
              <button key={l.id} className="card list-tile" onClick={() => setOpenId(l.id)}>
                <span className="tile-emoji">{l.emoji}</span>
                <span className="tile-name">{l.name}</span>
                <span className="tile-meta">{its.length === 0 ? 'Empty' : `${its.length - done} to go · ${done} done`}</span>
                <span className="progress"><span style={{ width: pct + '%' }} /></span>
              </button>
            )
          })}
        </div>
      )}
      <button className="fab" onClick={() => setCreating(true)} aria-label="New list"><Icon name="plus" size={26} /></button>
      {creating && <NewList family={family} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); load(); setOpenId(id) }} />}
    </div>
  )
}

function NewList({ family, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📝')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(e) {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.from('lists').insert({ family_id: family.id, name: name.trim(), emoji }).select().single()
    setBusy(false)
    if (error) setError(errMsg(error))
    else onCreated(data.id)
  }
  return (
    <Sheet title="New list" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>List name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Groceries" required maxLength={60} autoFocus />
        </label>
        <div className="field-label">Pick an icon</div>
        <div className="emoji-pick">
          {EMOJIS.map((em) => (
            <button type="button" key={em} className={em === emoji ? 'on' : ''} onClick={() => setEmoji(em)}>{em}</button>
          ))}
        </div>
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>Create list</button>
        </div>
      </form>
    </Sheet>
  )
}

function ListDetail({ list, items, setItems, user, profiles, onBack, reload }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [armed, setArmed] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(list.name)

  const todo = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)

  async function add(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setText('')
    const { error } = await supabase.from('list_items').insert({ list_id: list.id, family_id: list.family_id, text: t })
    if (error) setError(errMsg(error))
    reload()
  }
  async function toggle(item) {
    const next = !item.done
    setItems((all) => all.map((i) => (i.id === item.id ? { ...i, done: next, done_by: next ? user.id : null } : i)))
    await supabase.from('list_items').update({ done: next, done_by: next ? user.id : null }).eq('id', item.id)
  }
  async function removeItem(item) {
    setItems((all) => all.filter((i) => i.id !== item.id))
    await supabase.from('list_items').delete().eq('id', item.id)
  }
  async function clearDone() {
    setItems((all) => all.filter((i) => !(i.list_id === list.id && i.done)))
    await supabase.from('list_items').delete().eq('list_id', list.id).eq('done', true)
  }
  async function deleteList() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return }
    await supabase.from('lists').delete().eq('id', list.id)
    onBack(); reload()
  }
  async function rename(e) {
    e.preventDefault()
    await supabase.from('lists').update({ name: name.trim() }).eq('id', list.id)
    setRenaming(false); reload()
  }

  return (
    <div className="page narrow">
      <button className="back" onClick={onBack}><Icon name="left" size={18} /> All lists</button>
      <div className="card">
        <div className="list-title">
          <span className="tile-emoji">{list.emoji}</span>
          {renaming ? (
            <form onSubmit={rename} className="rename">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus />
              <button className="btn primary small">Save</button>
            </form>
          ) : (
            <h1 onClick={() => setRenaming(true)} title="Tap to rename">{list.name}</h1>
          )}
          {!renaming && <button className="icon-btn" onClick={() => setRenaming(true)} aria-label="Rename list"><Icon name="edit" size={18} /></button>}
        </div>

        <form className="add-row" onSubmit={add}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add something…" maxLength={200} aria-label="New item" />
          <button className="btn primary" aria-label="Add item"><Icon name="plus" size={20} /></button>
        </form>
        {error && <div className="error">{error}</div>}

        {items.length === 0 && <p className="quiet center pad">Nothing here yet — add the first thing above.</p>}

        <ul className="items">
          {todo.map((i) => <Item key={i.id} item={i} profiles={profiles} onToggle={toggle} onDelete={removeItem} />)}
        </ul>

        {done.length > 0 && (
          <>
            <div className="done-head">
              <span className="eyebrow">Done · {done.length}</span>
              <button className="link small" onClick={clearDone}>Clear done</button>
            </div>
            <ul className="items done">
              {done.map((i) => <Item key={i.id} item={i} profiles={profiles} onToggle={toggle} onDelete={removeItem} />)}
            </ul>
          </>
        )}
      </div>
      <div className="center">
        <button className={`btn danger ghosty ${armed ? 'armed' : ''}`} onClick={deleteList}>
          <Icon name="trash" size={18} /> {armed ? 'Tap again to delete this list' : 'Delete list'}
        </button>
      </div>
    </div>
  )
}

function Item({ item, profiles, onToggle, onDelete }) {
  const adder = profiles[item.created_by]
  const doer = profiles[item.done_by]
  return (
    <li className="item">
      <button className={`check ${item.done ? 'on' : ''}`} onClick={() => onToggle(item)} aria-label={item.done ? 'Mark not done' : 'Mark done'}>
        {item.done && <Icon name="check" size={16} />}
      </button>
      <span className="item-text">
        <span>{item.text}</span>
        <span className="item-meta">
          {item.done && doer ? `Done by ${doer.display_name}` : `Added by ${adder?.display_name || 'someone'}`}
        </span>
      </span>
      <Avatar profile={item.done && doer ? doer : adder} size={24} />
      <button className="icon-btn tiny" onClick={() => onDelete(item)} aria-label="Delete item"><Icon name="x" size={16} /></button>
    </li>
  )
}
