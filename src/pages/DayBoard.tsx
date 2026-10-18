// 日ごとの案: アイデアを「1日目の昼ごはん」などの枠に入れて、行くお店を確定する画面

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronLeft, X } from 'lucide-react'
import { useStore } from '../store'
import { findConflictingConfirmed, formatDateLabel } from '../logic'
import type { Category, Idea } from '../types'

// 枠の中で「アイデアを入れる」ための、小さな選択欄
function AddIdeaRow({
  ideas,
  onAdd,
}: {
  ideas: Idea[]
  onAdd: (ideaId: string) => void
}) {
  const [selected, setSelected] = useState('')

  if (ideas.length === 0) {
    return (
      <p className="hint">入れられるアイデアがありません。アイデア置き場で追加できます。</p>
    )
  }

  return (
    <div className="add-idea-row">
      <select value={selected} onChange={(e) => setSelected(e.target.value)}>
        <option value="">アイデアを選ぶ</option>
        {ideas.map((idea) => (
          <option key={idea.id} value={idea.id}>
            {idea.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="button-secondary"
        disabled={!selected}
        onClick={() => {
          onAdd(selected)
          setSelected('')
        }}
      >
        入れる
      </button>
    </div>
  )
}

// その日に「枠」(間食・カフェなど)を足すための、小さな選択欄
function AddSlotRow({
  categories,
  onAdd,
}: {
  categories: Category[]
  onAdd: (categoryId: string) => void
}) {
  const [selected, setSelected] = useState('')

  if (categories.length === 0) return null

  return (
    <div className="slot">
      <div className="add-idea-row">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">枠を足す(間食・カフェなど)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="button-secondary"
          disabled={!selected}
          onClick={() => {
            onAdd(selected)
            setSelected('')
          }}
        >
          足す
        </button>
      </div>
    </div>
  )
}

export default function DayBoard() {
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
  const ideas = data.ideas.filter((i) => i.planId === plan.id)
  const ideaById = new Map(ideas.map((i) => [i.id, i]))

  // 「ここに行く」
  function handleConfirm(assignmentId: string) {
    const conflicts = findConflictingConfirmed(data.assignments, data.categories, assignmentId)
    if (conflicts.length > 0) {
      const target = data.assignments.find((a) => a.id === assignmentId)
      const targetName = (target && ideaById.get(target.ideaId)?.name) ?? 'このお店'
      const oldNames = conflicts.map((a) => ideaById.get(a.ideaId)?.name ?? 'お店').join('、')
      const ok = window.confirm(
        `すでに「${oldNames}」を確定しています。\n「${targetName}」に変更しますか?\n(「${oldNames}」は候補に戻ります)`,
      )
      if (!ok) return
    }
    dispatch({ type: 'confirm', id: assignmentId })
  }

  // 確定を取り消す
  function handleUnconfirm(assignmentId: string, name: string) {
    if (window.confirm(`「${name}」の確定を取り消しますか?\n(候補には残ります)`)) {
      dispatch({ type: 'unconfirm', id: assignmentId })
    }
  }

  // 枠から外す
  function handleRemove(assignmentId: string, name: string) {
    if (
      window.confirm(`「${name}」を、この枠の案から外しますか?\n(アイデア置き場には残ります)`)
    ) {
      dispatch({ type: 'removeAssignment', id: assignmentId })
    }
  }

  return (
    <div className="page">
      <Link to={`/plan/${plan.id}`} className="back-link">
        <ChevronLeft size={18} />
        {plan.title}
      </Link>
      <h1 className="app-title">日ごとの案</h1>

      {days.length === 0 && (
        <p className="empty">このプランは、日程が未定のため、日がありません。</p>
      )}

      {days.map((day, index) => {
        const slots = categories.filter((c) => day.categoryIds.includes(c.id))
        const unusedCategories = categories.filter((c) => !day.categoryIds.includes(c.id))
        return (
          <details key={day.id} className="day-block" open={index === 0}>
            <summary>
              <strong>
                {index + 1}日目 {formatDateLabel(day.date)}
              </strong>
            </summary>

            {slots.map((cat) => {
              const list = data.assignments.filter(
                (a) => a.dayPlanId === day.id && a.categoryId === cat.id,
              )
              const confirmedCount = list.filter((a) => a.isConfirmed).length
              const usedIds = new Set(list.map((a) => a.ideaId))
              const available = ideas.filter((i) => !usedIds.has(i.id))
              return (
                <div key={cat.id} className="slot">
                  <h3>
                    {cat.name}
                    <span className={confirmedCount > 0 ? 'slot-status done' : 'slot-status'}>
                      {confirmedCount > 0 ? `確定 ${confirmedCount}` : '未確定'}
                    </span>
                    {list.length === 0 && (
                      <button
                        type="button"
                        className="icon-button"
                        style={{ marginLeft: 'auto' }}
                        aria-label={`${cat.name}の枠を外す`}
                        onClick={() =>
                          dispatch({
                            type: 'removeDayCategory',
                            dayPlanId: day.id,
                            categoryId: cat.id,
                          })
                        }
                      >
                        <X size={18} />
                      </button>
                    )}
                  </h3>

                  <ul className="assignment-list">
                    {list.map((a) => {
                      const idea = ideaById.get(a.ideaId)
                      if (!idea) return null
                      return (
                        <li
                          key={a.id}
                          className={a.isConfirmed ? 'assignment confirmed' : 'assignment'}
                        >
                          <div className="assignment-main">
                            {a.isConfirmed && (
                              <span className="badge-confirmed">
                                <Check size={14} /> 確定
                              </span>
                            )}
                            <strong className="idea-name">{idea.name}</strong>
                            {(idea.cuisine || idea.budget) && (
                              <span className="idea-sub">
                                {[idea.cuisine, idea.budget].filter(Boolean).join(' / ')}
                              </span>
                            )}
                          </div>
                          <div className="assignment-actions">
                            {a.isConfirmed ? (
                              <button
                                type="button"
                                className="button-secondary"
                                onClick={() => handleUnconfirm(a.id, idea.name)}
                              >
                                確定を取り消す
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="button-primary"
                                onClick={() => handleConfirm(a.id)}
                              >
                                ここに行く
                              </button>
                            )}
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`${idea.name}を枠から外す`}
                              onClick={() => handleRemove(a.id, idea.name)}
                            >
                              <X size={20} />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>

                  <AddIdeaRow
                    ideas={available}
                    onAdd={(ideaId) =>
                      dispatch({
                        type: 'addAssignment',
                        dayPlanId: day.id,
                        categoryId: cat.id,
                        ideaId,
                      })
                    }
                  />
                </div>
              )
            })}

            <AddSlotRow
              categories={unusedCategories}
              onAdd={(categoryId) =>
                dispatch({ type: 'addDayCategory', dayPlanId: day.id, categoryId })
              }
            />
          </details>
        )
      })}
    </div>
  )
}