// 画面の切り替えを決めるファイルです。

import { Link, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import PlanDetail from './pages/PlanDetail'
import IdeaBoard from './pages/IdeaBoard'
import DayBoard from './pages/DayBoard'
import Confirmed from './pages/Confirmed'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/plan/:planId" element={<PlanDetail />} />
      <Route path="/plan/:planId/ideas" element={<IdeaBoard />} />
      <Route path="/plan/:planId/days" element={<DayBoard />} />
      <Route path="/plan/:planId/confirmed" element={<Confirmed />} />
      <Route
        path="*"
        element={
          <div className="page">
            <p>このページは、まだ作っていません。</p>
            <Link to="/">ホームへ戻る</Link>
          </div>
        }
      />
    </Routes>
  )
}