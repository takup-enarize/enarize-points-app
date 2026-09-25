import { useEffect, useState } from 'react'
import liff from '@line/liff'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { QRCodeSVG } from 'qrcode.react'
import { db } from './firebase'

const LIFF_ID = '2011462958-BfEUxgLC'

const LEVELS = [
  { pt: 0, name: '見習い' },
  { pt: 5, name: '平社員' },
  { pt: 10, name: '主任' },
  { pt: 20, name: '係長' },
  { pt: 35, name: '課長' },
  { pt: 50, name: '次長' },
  { pt: 70, name: '部長' },
  { pt: 95, name: '本部長' },
  { pt: 130, name: '取締役' },
  { pt: 180, name: '代表取締役社長' },
]

const REWARDS = [
  { key: 'r10', pt: 10, label: '¥500割引' },
  { key: 'r35', pt: 35, label: '¥800割引' },
  { key: 'r70', pt: 70, label: 'レッスン1回無料' },
]

function getLevelInfo(points) {
  let current = LEVELS[0]
  let next = LEVELS[1]
  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].pt) {
      current = LEVELS[i]
      next = LEVELS[i + 1] || null
    }
  }
  return { current, next, levelIndex: LEVELS.indexOf(current) + 1 }
}

function App() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function init() {
      try {
        await liff.init({ liffId: LIFF_ID })
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }
        const prof = await liff.getProfile()
        setProfile(prof)

        const ref = doc(db, 'customers', prof.userId)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          await setDoc(ref, {
            name: prof.displayName,
            points: 0,
            isMember: false,
            rewardsUsed: {},
            createdAt: new Date(),
          })
        }

        const unsub = onSnapshot(ref, (docSnap) => {
          setCustomer(docSnap.data())
          setLoading(false)
        })

        return () => unsub()
      } catch (e) {
        console.error(e)
        setError('読み込みに失敗しました。時間をおいて再度お試しください。')
        setLoading(false)
      }
    }
    init()
  }, [])

  if (loading) return <div style={styles.center}>読み込み中...</div>
  if (error) return <div style={styles.center}>{error}</div>

  if (!customer?.isMember) {
    return (
      <div style={styles.page}>
        <Header />
        <div style={styles.container}>
          <p style={styles.text}>
            この機能はENARIZEポイントカード会員限定です。<br />
            ご入会いただくと、ポイントカードとレベルアップ機能がご利用いただけます。
          </p>
        </div>
      </div>
    )
  }

  const points = customer.points || 0
  const { current, next, levelIndex } = getLevelInfo(points)
  const usedMap = customer.rewardsUsed || {}
  const progress = next ? Math.min(100, ((points - current.pt) / (next.pt - current.pt)) * 100) : 100

  return (
    <div style={styles.page}>
      <Header />
      <div style={styles.container}>
        <div style={styles.qrBox}>
          <QRCodeSVG value={profile.userId} size={190} />
          <p style={styles.name}>{customer.name} さん</p>
        </div>

        <div style={styles.levelBox}>
          <div style={styles.levelTop}>
            <span style={styles.levelBadge}>Lv.{levelIndex}</span>
            <span style={styles.levelName}>{current.name}</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <p style={styles.progressLabel}>
            {next ? `${next.name}まであと${next.pt - points}pt・現在${points}pt` : `最高位に到達・現在${points}pt`}
          </p>
        </div>

        <div style={styles.rewardsSection}>
          <p style={styles.rewardsTitle}>特典一覧</p>
          {REWARDS.map((r) => {
            const earned = points >= r.pt
            const used = usedMap[r.key]
            return (
              <div
                key={r.key}
                style={{
                  ...styles.rewardCard,
                  ...(used ? styles.rewardUsed : earned ? styles.rewardReady : styles.rewardLocked),
                }}
              >
                <div>
                  <p style={styles.rewardPt}>{r.pt}pt</p>
                  <p style={styles.rewardLabel}>{r.label}</p>
                </div>
                {used ? (
                  <span style={styles.usedTag}>使用済み</span>
                ) : earned ? (
                  <span style={styles.readyTag}>使えます</span>
                ) : (
                  <span style={styles.lockedTag}>未達成</span>
                )}
              </div>
            )
          })}
        </div>

        <p style={styles.hint}>
          レッスン参加時に、このQRコードをインストラクターに提示してください。<br />
          特典を使う場合は、インストラクターにお申し出ください。
        </p>
      </div>
    </div>
  )
}

function Header() {
  return (
    <div style={styles.header}>
      <img src="/logo.jpg" alt="ENARIZE" style={styles.logo} />
    </div>
  )
}

const COLORS = {
  navy: '#1B2A5C',
  gold: '#F5C518',
  red: '#E31E24',
  bgLight: '#F7F8FC',
}

const styles = {
  page: { fontFamily: 'sans-serif', background: COLORS.bgLight, minHeight: '100vh' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' },
  header: { background: COLORS.navy, padding: '16px', textAlign: 'center' },
  logo: { height: '70px', borderRadius: '8px' },
  container: { padding: '20px', textAlign: 'center', maxWidth: '420px', margin: '0 auto' },
  qrBox: { background: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(27,42,92,0.15)', marginBottom: '16px' },
  name: { fontSize: '14px', color: '#555', marginTop: '10px', marginBottom: 0 },
  levelBox: { background: COLORS.navy, borderRadius: '14px', padding: '16px 18px', marginBottom: '20px' },
  levelTop: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  levelBadge: { background: COLORS.gold, color: COLORS.navy, fontSize: '12px', fontWeight: 'bold', padding: '3px 12px', borderRadius: '999px' },
  levelName: { color: '#fff', fontSize: '17px', fontWeight: 'bold' },
  progressTrack: { background: 'rgba(255,255,255,0.2)', borderRadius: '999px', height: '8px', overflow: 'hidden' },
  progressFill: { background: COLORS.gold, height: '100%', borderRadius: '999px', transition: 'width 0.3s' },
  progressLabel: { fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '8px', marginBottom: 0 },
  rewardsSection: { textAlign: 'left', marginBottom: '20px' },
  rewardsTitle: { fontSize: '15px', fontWeight: 'bold', color: COLORS.navy, marginBottom: '10px' },
  rewardCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '10px', marginBottom: '8px' },
  rewardReady: { background: '#FFF7E0', border: `1.5px solid ${COLORS.gold}` },
  rewardUsed: { background: '#f0f0f0', opacity: 0.6 },
  rewardLocked: { background: '#fafafa', border: '1px solid #eee' },
  rewardPt: { fontSize: '11px', color: '#999', margin: 0 },
  rewardLabel: { fontSize: '14px', fontWeight: 'bold', margin: '2px 0 0', color: '#333' },
  usedTag: { fontSize: '12px', color: '#999' },
  readyTag: { fontSize: '12px', color: COLORS.red, fontWeight: 'bold' },
  lockedTag: { fontSize: '12px', color: '#bbb' },
  text: { fontSize: '14px', lineHeight: '1.6', color: '#555', padding: '20px 0' },
  hint: { fontSize: '12px', color: '#999', lineHeight: '1.6' },
}

export default App
