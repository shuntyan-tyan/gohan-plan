// アプリのルール(計算や確認)をまとめたファイルです。

import type { Assignment, Category, IdeaGroup } from './types'

// ---- ID(ひとつひとつの目印)と時刻 ----

// 重ならない目印の文字を作る
export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

// 今の時刻を文字にする
export function nowIso(): string {
  return new Date().toISOString()
}

// ---- 日付 ----

// 1つのプランで作れる日数の上限(間違って何年分も作らないため)
const MAX_DAYS = 366

// "2026-11-01" のような文字を、日付に直す
function parseDate(text: string): Date {
  const [year, month, day] = text.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// 日付を "2026-11-01" のような文字にする
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 開始日から終了日までの日付を、順番に並べて返す
// 日付が未定のとき、終了日が開始日より前のときは、空の一覧を返す
export function getDateRange(start: string | null, end: string | null): string[] {
  if (!start || !end || end < start) return []
  const result: string[] = []
  const current = parseDate(start)
  const last = parseDate(end)
  while (current <= last && result.length < MAX_DAYS) {
    result.push(formatDate(current))
    current.setDate(current.getDate() + 1)
  }
  return result
}

// "2026-11-01" を "11/1(日)" のように、見やすくする
export function formatDateLabel(text: string): string {
  const date = parseDate(text)
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  return `${date.getMonth() + 1}/${date.getDate()}(${weekdays[date.getDay()]})`
}

// ---- URL ----

// http:// か https:// で始まる正しいURLかを確認する
export function isValidUrl(text: string): boolean {
  try {
    const url = new URL(text.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

// ---- 最初に用意するもの ----

// 新しいプランに入れる、最初の「枠の種類」
export function createDefaultCategories(planId: string): Category[] {
  const items: { name: string; multiple: boolean }[] = [
    { name: '朝ごはん', multiple: false },
    { name: '昼ごはん', multiple: false },
    { name: '夜ごはん', multiple: false },
    { name: '食べ歩き', multiple: true },
    { name: '軽食', multiple: false },
    { name: 'カフェ・おやつ', multiple: false },
    { name: 'デザート・スイーツ', multiple: false },
    { name: 'ドリンク', multiple: false },
    { name: 'その他', multiple: false },
  ]
  return items.map((item, index) => ({
    id: createId(),
    planId,
    name: item.name,
    displayOrder: index,
    allowsMultipleConfirmedPlaces: item.multiple,
  }))
}

// 新しいプランに入れる、最初のアイデアのまとまり
export function createDefaultIdeaGroups(planId: string): IdeaGroup[] {
  return ['ごはん', '間食'].map((name, index) => ({
    id: createId(),
    planId,
    name,
    displayOrder: index,
  }))
}

// ---- 確定のルール ----

// 同じ日・同じ枠で、すでに確定しているほかの案を返す
// (複数確定を許可している枠では、いつも空)
export function findConflictingConfirmed(
  assignments: Assignment[],
  categories: Category[],
  targetId: string,
): Assignment[] {
  const target = assignments.find((a) => a.id === targetId)
  if (!target) return []
  const category = categories.find((c) => c.id === target.categoryId)
  if (!category || category.allowsMultipleConfirmedPlaces) return []
  return assignments.filter(
    (a) =>
      a.id !== target.id &&
      a.dayPlanId === target.dayPlanId &&
      a.categoryId === target.categoryId &&
      a.isConfirmed,
  )
}

// 「ここに行く」で確定する
// 1店舗だけの枠では、前に確定していた案は、確定を外して候補に戻す(消さない)
export function confirmAssignment(
  assignments: Assignment[],
  categories: Category[],
  targetId: string,
  now: string = nowIso(),
): Assignment[] {
  const target = assignments.find((a) => a.id === targetId)
  if (!target) return assignments
  const category = categories.find((c) => c.id === target.categoryId)
  const onlyOne = !!category && !category.allowsMultipleConfirmedPlaces
  return assignments.map((a) => {
    if (a.id === targetId) return { ...a, isConfirmed: true, updatedAt: now }
    const sameSlot = a.dayPlanId === target.dayPlanId && a.categoryId === target.categoryId
    if (onlyOne && sameSlot && a.isConfirmed) {
      return { ...a, isConfirmed: false, updatedAt: now }
    }
    return a
  })
}

// 確定を取り消す(案は候補に戻る)
export function unconfirmAssignment(
  assignments: Assignment[],
  targetId: string,
  now: string = nowIso(),
): Assignment[] {
  return assignments.map((a) =>
    a.id === targetId ? { ...a, isConfirmed: false, updatedAt: now } : a,
  )
}