// アプリ全体のデータを預かって、操作を受け付けるファイルです。
// データが変わるたびに、ブラウザへ自動で保存します。
// 「共有」しているプランは、Firebase(インターネット上)とも、自動で同期します。

import { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react'
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
import { createSharedId, fetchSharedPlan, saveSharedPlan, watchSharedPlan } from './firebase'
import type { PlanSlice } from './firebase'

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
  | { type: 'addDayCategory'; dayPlanId: string; categoryId: string }
  | { type: 'removeDayCategory'; dayPlanId: string; categoryId: string }
  | { type: 'setSharedId'; planId: string; sharedId: string }
  | { type: 'applyRemote'; slice: PlanSlice }
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

// ---- 共有のための道具 ----

// プラン1つ分のデータを取り出す
function buildSlice(data: AppData, planId: string): PlanSlice | null {
  const plan = data.plans.find((p) => p.id === planId)
  if (!plan) return null
  const dayPlans = data.dayPlans.filter((d) => d.planId === planId)
  const dayIds = new Set(dayPlans.map((d) => d.id))
  return {
    plan,
    ideaGroups: data.ideaGroups.filter((g) => g.planId === planId),
    ideas: data.ideas.filter((i) => i.planId === planId),
    categories: data.categories.filter((c) => c.planId === planId),
    dayPlans,
    assignments: data.assignments.filter((a) => dayIds.has(a.dayPlanId)),
  }
}

// プラン1つ分のデータを、まるごと入れ替える(なければ追加する)
function replacePlanSlice(data: AppData, slice: PlanSlice): AppData {
  const planId = slice.plan.id
  const oldDayIds = new Set(
    data.dayPlans.filter((d) => d.planId === planId).map((d) => d.id),
  )
  const exists = data.plans.some((p) => p.id === planId)
  return {
    ...data,
    plans: exists
      ? data.plans.map((p) => (p.id === planId ? slice.plan : p))
      : [...data.plans, slice.plan],
    ideaGroups: [...data.ideaGroups.filter((g) => g.planId !== planId), ...slice.ideaGroups],
    ideas: [...data.ideas.filter((i) => i.planId !== planId), ...slice.ideas],
    categories: [...data.categories.filter((c) => c.planId !== planId), ...slice.categories],
    dayPlans: [...data.dayPlans.filter((d) => d.planId !== planId), ...slice.dayPlans],
    assignments: [
      ...data.assignments.filter((a) => !oldDayIds.has(a.dayPlanId)),
      ...slice.assignments,
    ],
  }
}

// 「最後にFirebaseと同じになったときの内容」を、ブラウザに覚えておく場所
const BASE_KEY = 'gohan-plan-sync-base'

function loadBases(): Record<string, string> {
  try {
    const text = localStorage.getItem(BASE_KEY)
    if (!text) return {}
    const value: unknown = JSON.parse(text)
    return typeof value === 'object' && value !== null ? (value as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function setBase(bases: Record<string, string>, sharedId: string, json: string) {
  bases[sharedId] = json
  try {
    localStorage.setItem(BASE_KEY, JSON.stringify(bases))
  } catch {
    // 覚えられなくても、アプリの動作は続ける
  }
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
    case 'addDayCategory':
      return {
        ...data,
        dayPlans: data.dayPlans.map((d) =>
          d.id === action.dayPlanId && !d.categoryIds.includes(action.categoryId)
            ? { ...d, categoryIds: [...d.categoryIds, action.categoryId] }
            : d,
        ),
      }
    case 'removeDayCategory': {
      // 案が入っている枠は、外せない(消えてしまうのを防ぐため)
      const hasItems = data.assignments.some(
        (a) => a.dayPlanId === action.dayPlanId && a.categoryId === action.categoryId,
      )
      if (hasItems) return data
      return {
        ...data,
        dayPlans: data.dayPlans.map((d) =>
          d.id === action.dayPlanId
            ? { ...d, categoryIds: d.categoryIds.filter((id) => id !== action.categoryId) }
            : d,
        ),
      }
    }
    case 'setSharedId':
      return {
        ...data,
        plans: data.plans.map((p) =>
          p.id === action.planId ? { ...p, sharedId: action.sharedId } : p,
        ),
      }
    case 'applyRemote':
      return replacePlanSlice(data, action.slice)
    case 'replaceAll':
      return action.data
    default:
      return data
  }
}

type StoreValue = {
  data: AppData
  dispatch: Dispatch<Action>
  saveError: string | null // この端末への保存に失敗したときの文章
  syncError: string | null // 共有プランの同期に失敗したときの文章
  sharePlan: (planId: string) => Promise<string> // プランを共有して、共有用の名前を返す
  joinSharedPlan: (sharedId: string) => Promise<string | null> // 共有プランを取り込んで、プランのidを返す
}

const StoreContext = createContext<StoreValue | null>(null)

// アプリ全体を包んで、データを配る部品
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, null, () => loadData())
  const [saveError, setSaveError] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  // 共有プランごとの「最後にFirebaseと同じになったときの内容」
  const [bases] = useState<Record<string, string>>(() => loadBases())

  // 見張り役の中から、いつでも最新のデータを見られるようにする
  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  }, [data])

  // データが変わるたびに、この端末に保存する
  useEffect(() => {
    const result = saveData(data)
    setSaveError(result.ok ? null : result.message)
  }, [data])

  // 自分の変更を、Firebaseに送る
  useEffect(() => {
    for (const plan of data.plans) {
      const sid = plan.sharedId
      if (!sid) continue
      const base = bases[sid]
      if (base === undefined) continue // 最初の同期が終わるまで待つ(古いデータで上書きしないため)
      const slice = buildSlice(data, plan.id)
      if (!slice) continue
      const json = JSON.stringify(slice)
      if (json === base) continue
      setBase(bases, sid, json)
      saveSharedPlan(sid, slice)
        .then(() => setSyncError(null))
        .catch(() => {
          setBase(bases, sid, base) // 失敗したので、次の機会にもう一度送る
          setSyncError('共有プランを送れませんでした。通信の状態を確認してください。')
        })
    }
  }, [data, bases])

  // 共有プランの名前の一覧(増えたり減ったりしたときだけ、見張りを作り直す)
  const sharedKey = data.plans
    .map((p) => p.sharedId ?? '')
    .filter(Boolean)
    .sort()
    .join(',')

  // 家族の変更を、Firebaseから受け取る
  useEffect(() => {
    if (!sharedKey) return
    const unsubscribers = sharedKey.split(',').map((sid) =>
      watchSharedPlan(
        sid,
        (remote, isLocalChange) => {
          if (isLocalChange) return // 自分が送ったものなので、無視する
          const plan = dataRef.current.plans.find((p) => p.sharedId === sid)
          const local = plan ? buildSlice(dataRef.current, plan.id) : null
          const localJson = local ? JSON.stringify(local) : null
          const remoteJson = JSON.stringify(remote)
          const base = bases[sid]

          // すでに同じ内容
          if (remoteJson === localJson) {
            setBase(bases, sid, remoteJson)
            setSyncError(null)
            return
          }
          // 自分だけが変更していた(たとえば、電波のない場所で編集した)→ 送る
          if (
            local &&
            localJson !== null &&
            base !== undefined &&
            remoteJson === base &&
            localJson !== base
          ) {
            setBase(bases, sid, localJson)
            saveSharedPlan(sid, local).catch(() => {
              setBase(bases, sid, base)
              setSyncError('共有プランを送れませんでした。通信の状態を確認してください。')
            })
            return
          }
          // それ以外は、共有側の内容を取り込む
          setBase(bases, sid, remoteJson)
          dispatch({ type: 'applyRemote', slice: remote })
          setSyncError(null)
        },
        (message) => setSyncError(message),
      ),
    )
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [sharedKey, bases])

  // プランを共有する(共有用の名前を作って、Firebaseに保存する)
  async function sharePlan(planId: string): Promise<string> {
    const slice = buildSlice(dataRef.current, planId)
    if (!slice) throw new Error('プランが見つかりません')
    const sharedId = createSharedId()
    const shared: PlanSlice = { ...slice, plan: { ...slice.plan, sharedId } }
    await saveSharedPlan(sharedId, shared)
    setBase(bases, sharedId, JSON.stringify(shared))
    dispatch({ type: 'setSharedId', planId, sharedId })
    return sharedId
  }

  // 共有リンクから、共有プランをこの端末に取り込む
  async function joinSharedPlan(sharedId: string): Promise<string | null> {
    const slice = await fetchSharedPlan(sharedId)
    if (!slice) return null
    setBase(bases, sharedId, JSON.stringify(slice))
    dispatch({ type: 'applyRemote', slice })
    return slice.plan.id
  }

  return (
    <StoreContext.Provider
      value={{ data, dispatch, saveError, syncError, sharePlan, joinSharedPlan }}
    >
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