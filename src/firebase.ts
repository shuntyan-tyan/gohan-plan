// Firebase(インターネット上のデータ置き場)とやり取りするファイルです。
// 共有したプランは、「sharedPlans」という場所に、1プランにつき1つ保存されます。

import { initializeApp } from 'firebase/app'
import { doc, getDoc, getFirestore, onSnapshot, setDoc } from 'firebase/firestore'
import type { Assignment, Category, DayPlan, Idea, IdeaGroup, Plan } from './types'

// アプリがFirebaseを見つけるための住所です(パスワードではありません)
const firebaseConfig = {
  apiKey: 'AIzaSyB0uoykH9JmZogbLKU0OiZJcOa4wsWhZRY',
  authDomain: 'gohan-plan.firebaseapp.com',
  projectId: 'gohan-plan',
  storageBucket: 'gohan-plan.firebasestorage.app',
  messagingSenderId: '859884408760',
  appId: '1:859884408760:web:046b2aa86311728518494d',
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const COLLECTION = 'sharedPlans'

// 共有するプラン1つ分のデータ
export type PlanSlice = {
  plan: Plan
  ideaGroups: IdeaGroup[]
  ideas: Idea[]
  categories: Category[]
  dayPlans: DayPlan[]
  assignments: Assignment[]
}

// 共有リンクに使う、推測できない長い名前を作る(32文字)
export function createSharedId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// 「id を持つものの一覧」になっているかを確認する
function isList(value: unknown): boolean {
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

// 保存されていた文字を、プランのデータに戻す。形が正しくなければ null
function parseSlice(json: unknown): PlanSlice | null {
  if (typeof json !== 'string') return null
  try {
    const value = JSON.parse(json) as Record<string, unknown>
    const plan = value.plan as { id?: unknown } | undefined
    if (!plan || typeof plan.id !== 'string') return null
    const keys = ['ideaGroups', 'ideas', 'categories', 'dayPlans', 'assignments']
    for (const key of keys) {
      if (!isList(value[key])) return null
    }
    return value as unknown as PlanSlice
  } catch {
    return null
  }
}

// プランをFirebaseに保存する(新しく作るときも、更新するときも使う)
export async function saveSharedPlan(sharedId: string, slice: PlanSlice): Promise<void> {
  await setDoc(doc(db, COLLECTION, sharedId), {
    json: JSON.stringify(slice),
    updatedAt: new Date().toISOString(),
  })
}

// 共有プランを1回だけ読み込む。見つからなければ null
export async function fetchSharedPlan(sharedId: string): Promise<PlanSlice | null> {
  const snap = await getDoc(doc(db, COLLECTION, sharedId))
  if (!snap.exists()) return null
  return parseSlice(snap.data().json)
}

// 共有プランを見張って、だれかが変更したら知らせる
// 戻り値は「見張りをやめる」ための関数
export function watchSharedPlan(
  sharedId: string,
  onChange: (slice: PlanSlice, isLocalChange: boolean) => void,
  onError: (message: string) => void,
): () => void {
  return onSnapshot(
    doc(db, COLLECTION, sharedId),
    (snap) => {
      if (!snap.exists()) return
      const slice = parseSlice(snap.data().json)
      if (slice) onChange(slice, snap.metadata.hasPendingWrites)
    },
    () => onError('共有プランを読み込めませんでした。通信の状態を確認してください。'),
  )
}