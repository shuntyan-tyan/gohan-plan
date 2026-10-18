// プラン画面: プランの情報と、3つの入り口(アイデア・日ごとの案・確定した予定)

import { Link, useParams } from 'react-router-dom'
import { CalendarDays, Check, ChevronLeft, Lightbulb } from 'lucide-react'
import { useStore } from '../store'
import { formatDateLabel } from '../logic'

export default function PlanDetail() {
  const { planId } = useParams()
  const { data } = useStore()
  const plan = data.plans.find((p) => p.id === planId)

  if (!plan) {
    return (
      <div className="page">
        <p>このプランは見つかりませんでした。</p>
        <Link to="/">ホームへ戻る</Link>
      </div>
    )
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
    </div>
  )
}