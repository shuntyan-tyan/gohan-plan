// 確定した予定: 行くお店だけを、日付順に見やすく並べる画面

import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { useStore } from '../store'
import { formatDateLabel, isValidUrl } from '../logic'

export default function Confirmed() {
  const { planId } = useParams()
  const { data, dispatch } = useStore()
  const plan = data.plans.find((p) => p.id === planId)

  if (!plan) {
    return (
      <div className="page">
        <p>このプランは見つかりませんでした。</p>
        <Link to="/">ホームへ戻る</Link>
      </div>
    )
  }

  const categories = data.categories
    .filter((c) => c.planId === plan.id)
    .sort((a, b) => a.displayOrder - b.displayOrder)
  const days = data.dayPlans
    .filter((d) => d.planId === plan.id)
    .sort((a, b) => a.date.localeCompare(b.date))
  const ideaById = new Map(data.ideas.map((i) => [i.id, i]))

  // 確定を取り消す
  function handleUnconfirm(assignmentId: string, name: string) {
    if (window.confirm(`「${name}」の確定を取り消しますか?\n(候補には残ります)`)) {
      dispatch({ type: 'unconfirm', id: assignmentId })
    }
  }

  return (
    <div className="page">
      <Link to={`/plan/${plan.id}`} className="back-link">
        <ChevronLeft size={18} />
        {plan.title}
      </Link>
      <h1 className="app-title">確定した予定</h1>

      {days.length === 0 && (
        <p className="empty">このプランは、日程が未定のため、日がありません。</p>
      )}

      {days.map((day, index) => {
        const slots = categories.filter((c) => day.categoryIds.includes(c.id))
        return (
          <section key={day.id} className="confirmed-day">
            <h2>
              {index + 1}日目 {formatDateLabel(day.date)}
            </h2>

            {slots.map((cat) => {
              const confirmed = data.assignments.filter(
                (a) => a.dayPlanId === day.id && a.categoryId === cat.id && a.isConfirmed,
              )
              return (
                <div key={cat.id} className="confirmed-slot">
                  <h3>{cat.name}</h3>
                  {confirmed.length === 0 && <p className="unconfirmed">未確定</p>}
                  <ul className="confirmed-list">
                    {confirmed.map((a) => {
                      const idea = ideaById.get(a.ideaId)
                      if (!idea) return null
                      return (
                        <li key={a.id} className="confirmed-card">
                          <strong className="confirmed-name">{idea.name}</strong>
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
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => handleUnconfirm(a.id, idea.name)}
                          >
                            確定を取り消す
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </section>
        )
      })}

      <p className="hint">
        お店を変えたいときは、<Link to={`/plan/${plan.id}/days`}>日ごとの案</Link>
        で、別のお店の「ここに行く」を押してください。
      </p>
    </div>
  )
}