// 共有リンクを開いたときの画面: 共有プランを取り込んで、プラン画面へ移る

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'

export default function SharedJoin() {
  const { sharedId } = useParams()
  const { joinSharedPlan } = useStore()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return // 2回続けて取り込まないようにする
    started.current = true

    // 共有用の名前は、英数字32文字のはず
    if (!sharedId || !/^[0-9a-f]{32}$/.test(sharedId)) {
      setError('この共有リンクは正しくありません。リンクを、もう一度確認してください。')
      return
    }

    joinSharedPlan(sharedId)
      .then((planId) => {
        if (planId) {
          navigate(`/plan/${planId}`, { replace: true })
        } else {
          setError('共有プランが見つかりませんでした。リンクが正しいか、確認してください。')
        }
      })
      .catch(() => {
        setError('共有プランを読み込めませんでした。通信の状態を確認してください。')
      })
  }, [sharedId, joinSharedPlan, navigate])

  return (
    <div className="page">
      <h1 className="app-title">ごはんプラン</h1>
      {error ? (
        <>
          <p className="error-text" role="alert">
            {error}
          </p>
          <Link to="/">ホームへ戻る</Link>
        </>
      ) : (
        <p className="empty">共有プランを読み込んでいます…</p>
      )}
    </div>
  )
}