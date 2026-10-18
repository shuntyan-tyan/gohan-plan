// アプリ全体のデータを預かって、操作を受け付けるファイルです。
// データが変わるたびに、ブラウザへ自動で保存します。

import { createContext, useContext, useEffect, useReducer, useState } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { AppData, Idea, Plan } from './types'
import {
  confirmAssignment,
  createDefaultCategories,
  createDefaultIdeaGroups,
  createId,
  getDateRange,
  nowIso,
  unconfirmAssignment,
} from './logic'
import { loadData, saveData } from './storage'

// プランを作る・直すときに渡す情報
export type PlanInput = Pick<Plan, 'title' | 'startDate' | 'endDate' | 'memo'>

// お店のアイデアを作る・直すときに渡す情報
export type IdeaInput = Omit<Idea, 'id' | 'createdAt' | 'updatedAt'>

// アプリにできる操作の一覧
export type Action =
  | { type: 'addPlan'; input: PlanInput }
  | { type: 'updatePlan'; id: string; input: PlanInput }
  | { type: 'deletePlan'; id: string }
  | { type: 'addIdea'; input: IdeaInput }
  | { type: 'updateIdea'; id: string; input: Partial<IdeaInput> }
  | { type: 'deleteIdea'; id: string }
  | { type: 'addAssignment'; dayPlanId: string; categoryId: string; ideaId: string }
  | { type: 'removeAssignment'; id: string }
  | { type: 'confirm'; id: string }
  | { type: 'unconfirm'; id: string }
  | { type: 'replaceAll'; data: AppData }

// プランの日程に合わせて、足りない日を追加する(すでにある日は消さない)
function addMissingDays(data: AppData, plan: Plan): AppData {
  const dates = getDateRange(plan.startDate, plan.endDate)
  const existing = new Set(
    data.dayPlans.filter((d) => d.planId === plan.id).map((d) => d.date),
  )
  // 新しい日には、最初の3つの枠(朝・昼・夜)を入れておく
  const defaultCategoryIds = data.categories
    .filter((c) => c.planId === plan.id)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, 3)
    .map((c) => c.id)
  const added = dates
    .filter((date) => !existing.has(date))
    .map((date) => ({
      id: createId(),
      planId: plan.id,
      date,
      categoryIds: defaultCategoryIds,
    }))
  return { ...data, dayPlans: [...data.dayPlans, ...added] }
}

// 操作を受けて、新しいデータを作る
function reducer(data: AppData, action: Action): AppData {
  const now = nowIso()
  switch (action.type) {
    case 'addPlan': {
      const plan: Plan = { id: createId(), ...action.input, createdAt: now, updatedAt: now }
      const withPlan: AppData = {
        ...data,
        plans: [...data.plans, plan],
        categories: [...data.categories, ...createDefaultCategories(plan.id)],
        ideaGroups: [...data.ideaGroups, ...createDefaultIdeaGroups(plan.id)],
      }
      return addMissingDays(withPlan, plan)
    }
    case 'updatePlan': {
      const old = data.plans.find((p) => p.id === action.id)
      if (!old) return data
      const plan: Plan = { ...old, ...action.input, updatedAt: now }
      const withPlan: AppData = {
        ...data,
        plans: data.plans.map((p) => (p.id === plan.id ? plan : p)),
      }
      return addMissingDays(withPlan, plan)
    }
    case 'deletePlan': {
      const dayIds = new Set(
        data.dayPlans.filter((d) => d.planId === action.id).map((d) => d.id),
      )
      return {
        ...data,
        plans: data.plans.filter((p) => p.id !== action.id),
        ideaGroups: data.ideaGroups.filter((g) => g.planId !== action.id),
        ideas: data.ideas.filter((i) => i.planId !== action.id),
        categories: data.categories.filter((c) => c.planId !== action.id),
        dayPlans: data.dayPlans.filter((d) => d.planId !== action.id),
        assignments: data.assignments.filter((a) => !dayIds.has(a.dayPlanId)),
      }
    }
    case 'addIdea': {
      const idea: Idea = { id: createId(), ...action.input, createdAt: now, updatedAt: now }
      return { ...data, ideas: [...data.ideas, idea] }
    }
    case 'updateIdea':
      return {
        ...data,
        ideas: data.ideas.map((i) =>
          i.id === action.id ? { ...i, ...action.input, updatedAt: now } : i,
        ),
      }
    case 'deleteIdea':
      return {
        ...data,
        ideas: data.ideas.filter((i) => i.id !== action.id),
        assignments: data.assignments.filter((a) => a.ideaId !== action.id),
      }
    case 'addAssignment': {
      const already = data.assignments.some(
        (a) =>
          a.dayPlanId === action.dayPlanId &&
          a.categoryId === action.categoryId &&
          a.ideaId === action.ideaId,
      )
      if (already) return data
      return {
        ...data,
        assignments: [
          ...data.assignments,
          {
            id: createId(),
            dayPlanId: action.dayPlanId,
            categoryId: action.categoryId,
            ideaId: action.ideaId,
            isConfirmed: false,
            createdAt: now,
            updatedAt: now,
          },
        ],
      }
    }
    case 'removeAssignment':
      return { ...data, assignments: data.assignments.filter((a) => a.id !== action.id) }
    case 'confirm':
      return {
        ...data,
        assignments: confirmAssignment(data.assignments, data.categories, action.id, now),
      }
    case 'unconfirm':
      return { ...data, assignments: unconfirmAssignment(data.assignments, action.id, now) }
    case 'replaceAll':
      return action.data
    default:
      return data
  }
}

type StoreValue = {
  data: AppData
  dispatch: Dispatch<Action>
  saveError: string | null // 保存に失敗したときの文章。成功していれば null
}

const StoreContext = createContext<StoreValue | null>(null)

// アプリ全体を包んで、データを配る部品
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, null, () => loadData())
  const [saveError, setSaveError] = useState<string | null>(null)

  // データが変わるたびに保存する
  useEffect(() => {
    const result = saveData(data)
    setSaveError(result.ok ? null : result.message)
  }, [data])

  return (
    <StoreContext.Provider value={{ data, dispatch, saveError }}>
      {children}
    </StoreContext.Provider>
  )
}

// 画面の部品から、データと操作を使うための道具
export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) {
    throw new Error('useStore は StoreProvider の中で使ってください')
  }
  return value
}