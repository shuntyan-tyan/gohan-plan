// プラン画面: プランの情報と、3つの入り口(アイデア・日ごとの案・確定した予定)、家族との共有

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, Check, ChevronLeft, Copy, Lightbulb, Share2 } from 'lucide-react'
import { useStore } from '../store'
import { formatDateLabel } from '../logic'

// 家族に送る共有リンクの、前半部分(公開しているアプリのアドレス)
const PUBLIC_URL = 'https://shuntyan-tyan.github.io/gohan-plan/'

export default function PlanDetail() {
  const { planId } = useParams()
  const { data, sharePlan, syncError } = useStore()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const plan = data.plans.find((p) => p.id === planId)

  if (!plan) {
    return (
      <div className="page">
        <p>このプランは見つかりませんでした。</p>
        <Link to="/">ホームへ戻る</Link>
      </div>
    )
  }

  const currentPlanId = plan.id
  const shareUrl = plan.sharedId ? `${PUBLIC_URL}#/shared/${plan.sharedId}` : ''

  // 「家族と共有する」を押したとき
  async function handleShare() {
    const ok = window.confirm(
      'このプランを、インターネット上で共有しますか?\n共有リンクを知っている人は、誰でも、このプランを見て、編集できます。家族以外には、リンクを送らないでください。',
    )
    if (!ok) return
    setBusy(true)
    setMessage('')
    try {
      await sharePlan(currentPlanId)
    } catch {
      setMessage('共有できませんでした。通信の状態を確認して、もう一度ためしてください。')
    } finally {
      setBusy(false)
    }
  }

  // リンクをコピーする
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setMessage('リンクをコピーしました。')
    } catch {
      setMessage('コピーできませんでした。リンクの欄を長押しして、コピーしてください。')
    }
  }

  const ideaCount = data.ideas.filter((i) => i.planId === plan.id).length
  const dayIds = new Set(
    data.dayPlans.filter((d) => d.planId === plan.id).map((d) => d.id),
  )
  const confirmedSlots = new Set(
    data.assignments
      .filter((a) => a.isConfirmed && dayIds.has(a.dayPlanId))
      .map((a) => `${a.dayPlanId}/${a.categoryId}`),
  ).size

  let period = '日程未定'
  if (plan.startDate && plan.endDate) {
    period =
      plan.startDate === plan.endDate
        ? formatDateLabel(plan.startDate)
        : `${formatDateLabel(plan.startDate)} 〜 ${formatDateLabel(plan.endDate)}`
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">
        <ChevronLeft size={18} />
        ホーム
      </Link>

      <h1 className="app-title">{plan.title}</h1>
      <p className="plan-period">{period}</p>
      {plan.memo && <p className="plan-memo">{plan.memo}</p>}

      {syncError && (
        <p className="error-banner" role="alert">
          {syncError}
        </p>
      )}

      <ul className="menu-list">
        <li>
          <Link to={`/plan/${plan.id}/ideas`} className="menu-item">
            <Lightbulb size={24} />
            <span className="menu-text">
              <strong>アイデア置き場</strong>
              <small>行きたいお店をためておく({ideaCount}件)</small>
            </span>
          </Link>
        </li>
        <li>
          <Link to={`/plan/${plan.id}/days`} className="menu-item">
            <CalendarDays size={24} />
            <span className="menu-text">
              <strong>日ごとの案</strong>
              <small>アイデアを、日と食事の枠に振り分ける({dayIds.size}日)</small>
            </span>
          </Link>
        </li>
        <li>
          <Link to={`/plan/${plan.id}/confirmed`} className="menu-item">
            <Check size={24} />
            <span className="menu-text">
              <strong>確定した予定</strong>
              <small>行くお店だけを見る(確定済みの枠: {confirmedSlots})</small>
            </span>
          </Link>
        </li>
      </ul>

      <div className="form">
        <h2>家族と共有</h2>
        {plan.sharedId ? (
          <>
            <p className="hint">
              共有中です。このリンクを開いた人は、同じプランを、一緒に編集できます。リンクを知っている人は、誰でも見て、編集できるので、家族以外には送らないでください。
            </p>
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              aria-label="共有リンク"
            />
            <div className="form-buttons">
              <button type="button" className="button-primary" onClick={handleCopy}>
                <Copy size={16} /> リンクをコピー
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="hint">
              共有すると、家族が同じプランを、それぞれのスマホから、一緒に編集できます。データは、インターネット上(Firebase)にも保存されます。
            </p>
            <div className="form-buttons">
              <button
                type="button"
                className="button-primary"
                disabled={busy}
                onClick={handleShare}
              >
                <Share2 size={16} /> {busy ? '共有しています…' : '家族と共有する'}
              </button>
            </div>
          </>
        )}
        {message && <p className="hint">{message}</p>}
      </div>
    </div>
  )
}