// アイデア置き場: 行きたいお店を「ごはん」「間食」などのまとまりに入れておく画面

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, ExternalLink, Link as LinkIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { isValidUrl } from '../logic'
import type { Idea } from '../types'

type Mode = 'closed' | 'url' | 'form'

// 入力欄の中身
type FormState = {
  groupId: string
  name: string
  address: string
  sourceURL: string
  mapURL: string
  cuisine: string
  budget: string
  memo: string
  reservationMemo: string
}

function emptyForm(groupId: string): FormState {
  return {
    groupId,
    name: '',
    address: '',
    sourceURL: '',
    mapURL: '',
    cuisine: '',
    budget: '',
    memo: '',
    reservationMemo: '',
  }
}

export default function IdeaBoard() {
  const { planId } = useParams()
  const { data, dispatch } = useStore()
  const plan = data.plans.find((p) => p.id === planId)

  const groups = data.ideaGroups
    .filter((g) => g.planId === planId)
    .sort((a, b) => a.displayOrder - b.displayOrder)
  const ideas = data.ideas.filter((i) => i.planId === planId)
  const firstGroupId = groups[0]?.id ?? ''

  const [mode, setMode] = useState<Mode>('closed')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fromUrl, setFromUrl] = useState(false)
  const [urlText, setUrlText] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm(''))
  const [error, setError] = useState('')

  if (!plan) {
    return (
      <div className="page">
        <p>このプランは見つかりませんでした。</p>
        <Link to="/">ホームへ戻る</Link>
      </div>
    )
  }

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function closeAll() {
    setMode('closed')
    setEditingId(null)
    setFromUrl(false)
    setError('')
  }

  // 手入力で追加
  function openManual() {
    setForm(emptyForm(firstGroupId))
    setEditingId(null)
    setFromUrl(false)
    setError('')
    setMode('form')
  }

  // URLから追加(まずURLを入れてもらう)
  function openUrlStep() {
    setUrlText('')
    setError('')
    setMode('url')
  }

  // URLを確認して、入力画面へ進む
  function handleUrlNext(event: FormEvent) {
    event.preventDefault()
    const trimmed = urlText.trim()
    if (!isValidUrl(trimmed)) {
      setError('http:// か https:// で始まる、正しいURLを入力してください。')
      return
    }
    setForm({ ...emptyForm(firstGroupId), sourceURL: trimmed })
    setEditingId(null)
    setFromUrl(true)
    setError('')
    setMode('form')
  }

  // 編集を始める
  function startEdit(idea: Idea) {
    setForm({
      groupId: idea.groupId,
      name: idea.name,
      address: idea.address,
      sourceURL: idea.sourceURL,
      mapURL: idea.mapURL,
      cuisine: idea.cuisine,
      budget: idea.budget,
      memo: idea.memo,
      reservationMemo: idea.reservationMemo,
    })
    setEditingId(idea.id)
    setFromUrl(false)
    setError('')
    setMode('form')
  }

  // 保存
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const name = form.name.trim()
    const sourceURL = form.sourceURL.trim()
    const mapURL = form.mapURL.trim()
    if (!name) {
      setError('お店の名前を入力してください。')
      return
    }
    if (!form.groupId) {
      setError('まとまり(ごはん・間食など)を選んでください。')
      return
    }
    if (sourceURL && !isValidUrl(sourceURL)) {
      setError('お店のURLの形が正しくありません。http:// か https:// で始めてください。')
      return
    }
    if (mapURL && !isValidUrl(mapURL)) {
      setError('地図のURLの形が正しくありません。http:// か https:// で始めてください。')
      return
    }
    const values = {
      groupId: form.groupId,
      name,
      address: form.address.trim(),
      sourceURL,
      mapURL,
      cuisine: form.cuisine.trim(),
      budget: form.budget.trim(),
      memo: form.memo.trim(),
      reservationMemo: form.reservationMemo.trim(),
    }
    if (editingId) {
      dispatch({ type: 'updateIdea', id: editingId, input: values })
    } else {
      dispatch({ type: 'addIdea', input: { planId: plan!.id, ...values } })
    }
    closeAll()
  }

  // 削除
  function handleDelete(idea: Idea) {
    const used = data.assignments.filter((a) => a.ideaId === idea.id).length
    const extra = used > 0 ? `\n日ごとの案に入れている ${used} 件からも外れます。` : ''
    if (window.confirm(`「${idea.name}」を削除しますか?${extra}`)) {
      dispatch({ type: 'deleteIdea', id: idea.id })
    }
  }

  return (
    <div className="page">
      <Link to={`/plan/${plan.id}`} className="back-link">
        <ChevronLeft size={18} />
        {plan.title}
      </Link>
      <h1 className="app-title">アイデア置き場</h1>

      {ideas.length === 0 && mode === 'closed' && (
        <p className="empty">まだアイデアがありません。下のボタンから追加しましょう。</p>
      )}

      {groups.map((group) => {
        const list = ideas.filter((i) => i.groupId === group.id)
        return (
          <section key={group.id} className="idea-group">
            <h2>
              {group.name}({list.length})
            </h2>
            {list.length === 0 && <p className="hint">まだありません</p>}
            <ul className="idea-list">
              {list.map((idea) => (
                <li key={idea.id} className="idea-card">
                  <div className="idea-main">
                    <strong className="idea-name">{idea.name}</strong>
                    {(idea.cuisine || idea.budget) && (
                      <span className="idea-sub">
                        {[idea.cuisine, idea.budget].filter(Boolean).join(' / ')}
                      </span>
                    )}
                    {idea.address && <span className="idea-sub">{idea.address}</span>}
                    {idea.memo && <span className="idea-sub">メモ: {idea.memo}</span>}
                    {idea.reservationMemo && (
                      <span className="idea-sub">予約: {idea.reservationMemo}</span>
                    )}
                    <span className="idea-links">
                      {isValidUrl(idea.sourceURL) && (
                        <a href={idea.sourceURL} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={14} /> お店のページ
                        </a>
                      )}
                      {isValidUrl(idea.mapURL) && (
                        <a href={idea.mapURL} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={14} /> 地図
                        </a>
                      )}
                    </span>
                  </div>
                  <div className="idea-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`${idea.name}を編集`}
                      onClick={() => startEdit(idea)}
                    >
                      <Pencil size={20} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`${idea.name}を削除`}
                      onClick={() => handleDelete(idea)}
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {mode === 'url' && (
        <form className="form" onSubmit={handleUrlNext}>
          <h2>URLから追加</h2>
          <label>
            お店のページのURLを貼り付けてください
            <input
              type="url"
              value={urlText}
              onChange={(e) => setUrlText(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <p className="hint">
            URLからお店の名前や住所を、自動で取ることはできません。次の画面で、手で入力してください。
          </p>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="form-buttons">
            <button type="button" className="button-secondary" onClick={closeAll}>
              キャンセル
            </button>
            <button type="submit" className="button-primary">
              次へ
            </button>
          </div>
        </form>
      )}

      {mode === 'form' && (
        <form className="form" onSubmit={handleSubmit}>
          <h2>{editingId ? 'アイデアを編集' : 'アイデアを追加'}</h2>
          {fromUrl && (
            <p className="hint">
              URLを保存しました。お店の名前などは、自動では取得できていないので、手で入力してください。
            </p>
          )}
          <label>
            まとまり
            <select value={form.groupId} onChange={(e) => setField('groupId', e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            お店の名前(必須)
            <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} />
          </label>
          <label>
            住所
            <input
              type="text"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
            />
          </label>
          <label>
            お店のページのURL
            <input
              type="url"
              value={form.sourceURL}
              onChange={(e) => setField('sourceURL', e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label>
            地図のURL
            <input
              type="url"
              value={form.mapURL}
              onChange={(e) => setField('mapURL', e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label>
            料理のジャンル
            <input
              type="text"
              value={form.cuisine}
              onChange={(e) => setField('cuisine', e.target.value)}
              placeholder="例: ラーメン"
            />
          </label>
          <label>
            予算の目安
            <input
              type="text"
              value={form.budget}
              onChange={(e) => setField('budget', e.target.value)}
              placeholder="例: 1,000円くらい"
            />
          </label>
          <label>
            メモ
            <textarea value={form.memo} onChange={(e) => setField('memo', e.target.value)} rows={3} />
          </label>
          <label>
            予約に関するメモ
            <textarea
              value={form.reservationMemo}
              onChange={(e) => setField('reservationMemo', e.target.value)}
              rows={2}
            />
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="form-buttons">
            <button type="button" className="button-secondary" onClick={closeAll}>
              キャンセル
            </button>
            <button type="submit" className="button-primary">
              保存
            </button>
          </div>
        </form>
      )}

      {mode === 'closed' && (
        <div className="fab-row">
          <button type="button" className="fab" onClick={openManual}>
            <Plus size={20} />
            手入力で追加
          </button>
          <button type="button" className="fab" onClick={openUrlStep}>
            <LinkIcon size={20} />
            URLから追加
          </button>
        </div>
      )}
    </div>
  )
}