// データをブラウザの中に保存したり、読み込んだりするファイルです。

import type { AppData } from './types'

// ブラウザの中で、このアプリのデータにつける名前
const STORAGE_KEY = 'gohan-plan-data'
// 壊れたデータが見つかったときの、避難場所の名前
const BROKEN_KEY = 'gohan-plan-data-broken'

// 何も入っていない、まっさらなデータ
export function createEmptyData(): AppData {
  return {
    version: 1,
    plans: [],
    ideaGroups: [],
    ideas: [],
    categories: [],
    dayPlans: [],
    assignments: [],
  }
}

// 「id を持つものの一覧」になっているかを確認する
function isListWithId(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { id?: unknown }).id === 'string',
    )
  )
}

// データの形が正しいかを確認する。正しければそのデータを、正しくなければ null を返す
export function validateData(value: unknown): AppData | null {
  if (typeof value !== 'object' || value === null) return null
  const data = value as Record<string, unknown>
  if (data.version !== 1) return null
  const keys = ['plans', 'ideaGroups', 'ideas', 'categories', 'dayPlans', 'assignments']
  for (const key of keys) {
    if (!isListWithId(data[key])) return null
  }
  return data as unknown as AppData
}

// 保存してあるデータを読み込む
// 何もなければ、まっさらなデータを返す。
// 壊れていたら、元の文字を別の場所に残してから、まっさらなデータを返す
export function loadData(): AppData {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    if (text === null) return createEmptyData()
    try {
      const checked = validateData(JSON.parse(text))
      if (checked) return checked
    } catch {
      // 文字が壊れていた場合は、下の避難処理に進む
    }
    localStorage.setItem(BROKEN_KEY, text)
    return createEmptyData()
  } catch {
    return createEmptyData()
  }
}

// 保存の結果
export type SaveResult = { ok: true } | { ok: false; message: string }

// データを保存する。失敗したら、分かりやすい文章を返す
export function saveData(data: AppData): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return { ok: true }
  } catch (error) {
    const isFull = error instanceof DOMException && error.name === 'QuotaExceededError'
    return {
      ok: false,
      message: isFull
        ? '保存できる量がいっぱいです。不要なデータを消すか、バックアップを取ってください。'
        : 'データを保存できませんでした。ブラウザの設定(プライベートモードなど)を確認してください。',
    }
  }
}

// バックアップ用に、データを文字にする
export function exportToJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

// 読み込み(インポート)の結果
export type ImportResult = { ok: true; data: AppData } | { ok: false; message: string }

// バックアップの文字を、データに戻す。形が正しいかも確認する
export function parseImportText(text: string): ImportResult {
  try {
    const checked = validateData(JSON.parse(text))
    if (checked) return { ok: true, data: checked }
    return { ok: false, message: 'このファイルは、ごはんプランのバックアップではありません。' }
  } catch {
    return { ok: false, message: 'ファイルを読み込めませんでした。文字が壊れているかもしれません。' }
  }
}