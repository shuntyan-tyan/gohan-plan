// アプリで扱うデータの「形」を決めるファイルです。
//
// 流れ:
//  1. アイデア置き場: 「ごはん」「間食」などのまとまり(IdeaGroup)に、お店のアイデア(Idea)を入れる
//  2. 日ごとの案: アイデアを「1日目の昼ごはん」などの枠(Assignment)に振り分ける
//  3. 確定: 枠の案の中から「ここに行く」を選ぶ(isConfirmed)

// 旅行やお出かけの計画ひとつ分
export type Plan = {
  id: string
  title: string
  startDate: string | null // 例: "2026-11-01"。未定のときは null
  endDate: string | null
  memo: string
  createdAt: string
  updatedAt: string
}

// アイデア置き場のまとまり(例: ごはん、間食)
export type IdeaGroup = {
  id: string
  planId: string
  name: string
  displayOrder: number
}

// お店のアイデアひとつ分(お店の情報は、ここに1回だけ入力する)
export type Idea = {
  id: string
  planId: string
  groupId: string // どのまとまり(IdeaGroup)に入っているか
  name: string
  address: string
  sourceURL: string
  mapURL: string
  cuisine: string
  budget: string
  memo: string
  reservationMemo: string
  createdAt: string
  updatedAt: string
}

// 日ごとの枠の種類(例: 朝ごはん、昼ごはん、夜ごはん、食べ歩き、カフェ)
export type Category = {
  id: string
  planId: string
  name: string
  displayOrder: number
  allowsMultipleConfirmedPlaces: boolean // 複数のお店を確定してよいか
}

// プランの中の「ある1日」
export type DayPlan = {
  id: string
  planId: string
  date: string // 例: "2026-11-01"
  categoryIds: string[] // この日に使う枠の種類
}

// 「1日目の昼ごはん」の案に、アイデアを入れたもの
// 同じアイデアを、別の日や別の枠にも入れてよい
export type Assignment = {
  id: string
  dayPlanId: string
  categoryId: string
  ideaId: string
  isConfirmed: boolean // 「ここに行く」で確定したら true
  createdAt: string
  updatedAt: string
}

// 保存するデータ全体
export type AppData = {
  version: 1
  plans: Plan[]
  ideaGroups: IdeaGroup[]
  ideas: Idea[]
  categories: Category[]
  dayPlans: DayPlan[]
  assignments: Assignment[]
}