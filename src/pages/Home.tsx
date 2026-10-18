// ホーム画面: プランの一覧と、新しいプランの作成

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { formatDateLabel } from '../logic'

export default function Home() {
  const { data, dispatch, saveError } = useStore()

  // 入力欄の中身
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState('')

  function resetForm() {
    setTitle('')
    setStartDate('')
    setEndDate('')
    setMemo('')
    setError('')
    setShowForm(false)
  }

  // 「作成」ボタンを押したとき
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError('プラン名を入力してください。')
      return
    }
    if (endDate && !startDate) {
      setError('終了日を入れるときは、開始日も入れてください。')
      return
    }
    // 開始日だけ入っているときは、1日だけのプランにする
    const finalEnd = startDate && !endDate ? startDate : endDate
    if (startDate && finalEnd < startDate) {
      setError('終了日は、開始日と同じか、あとの日にしてください。')
      return
    }
    dispatch({
      type: 'addPlan',
      input: {
        title: title.trim(),
        startDate: startDate || null,
        endDate: finalEnd || null,
        memo: memo.trim(),
      },
    })
    resetForm()
  }

  // 「削除」ボタンを押したとき
  function handleDelete(id: string, planTitle: string) {
    const ok = window.confirm(
      `「${planTitle}」を削除しますか?\nこのプランの日程・アイデア・確定した予定も、すべて削除されます。`,
    )
    if (ok) dispatch({ type: 'deletePlan', id })
  }

  // 日程を、見やすい文字にする
  function periodText(start: string | null, end: string | null): string {
    if (!start || !end) return '日程未定'
    if (start === end) return formatDateLabel(start)
    return `${formatDateLabel(start)} 〜 ${formatDateLabel(end)}`
  }

  // 確定済みの枠が、いくつあるかを数える
  function countConfirmedSlots(planId: string): number {
    const dayIds = new Set(
      data.dayPlans.filter((d) => d.planId === planId).map((d) => d.id),
    )
    const slots = new Set(
      data.assignments
        .filter((a) => a.isConfirmed && dayIds.has(a.dayPlanId))
        .map((a) => `${a.dayPlanId}/${a.categoryId}`),
    )
    return slots.size
  }

  // 新しく作ったプランが、上に来るようにする
  const plans = [...data.plans].reverse()

  return (
    <div className="page">
      <h1 className="app-title">ごはんプラン</h1>

      {saveError && (
        <p className="error-banner" role="alert">
          {saveError}
        </p>
      )}

      {plans.length === 0 && !showForm && (
        <p className="empty">まだプランがありません。下のボタンから作りましょう。</p>
      )}

      <ul className="plan-list">
        {plans.map((plan) => (
          <li key={plan.id} className="plan-card">
            <Link to={`/plan/${plan.id}`} className="plan-card-link">
              <span className="plan-title">{plan.title}</span>
              <span className="plan-period">{periodText(plan.startDate, plan.endDate)}</span>
              <span className="plan-count">
                確定済みの枠: {countConfirmedSlots(plan.id)}
              </span>
            </Link>
            <button
              type="button"
              className="icon-button"
              aria-label={`${plan.title}を削除`}
              onClick={() => handleDelete(plan.id, plan.title)}
            >
              <Trash2 size={20} />
            </button>
          </li>
        ))}
      </ul>

      {showForm && (
        <form className="form" onSubmit={handleSubmit}>
          <h2>新しいプラン</h2>
          <label>
            プラン名(必須)
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 京都旅行"
            />
          </label>
          <label>
            開始日
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            終了日
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <p className="hint">日程が決まっていなければ、空のままで大丈夫です。</p>
          <label>
            メモ
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} />
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="form-buttons">
            <button type="button" className="button-secondary" onClick={resetForm}>
              キャンセル
            </button>
            <button type="submit" className="button-primary">
              作成
            </button>
          </div>
        </form>
      )}

      {!showForm && (
        <button type="button" className="fab" onClick={() => setShowForm(true)}>
          <Plus size={20} />
          新しいプラン
        </button>
      )}
    </div>
  )
}