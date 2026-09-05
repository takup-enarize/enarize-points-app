import { useEffect, useState } from 'react'
import liff from '@line/liff'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { QRCodeSVG } from 'qrcode.react'
import { db } from './firebase'

const LIFF_ID = '2011462958-BfEUxgLC'

function calcLevel(points) {
  if (points >= 100) return 5
  if (points >= 60) return 4
  if (points >= 30) return 3
  if (points >= 10) return 2
  return 1
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
            level: 1,
            isMember: false,
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
      <div style={styles.container}>
        <h2 style={styles.title}>ENARIZE マイページ</h2>
        <p style={styles.text}>
          この機能はENARIZE MEMBERS会員限定です。<br />
          ご入会いただくと、ポイントカードとレベルアップ機能がご利用いただけます。
        </p>
      </div>
    )
  }

  const level = calcLevel(customer.points)

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>ENARIZE マイページ</h2>
      <p style={styles.name}>{customer.name} さん</p>

      <div style={styles.qrBox}>
        <QRCodeSVG value={profile.userId} size={220} />
      </div>

      <div style={styles.statsBox}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>ポイント</span>
          <span style={styles.statValue}>{customer.points} pt</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>レベル</span>
          <span style={styles.statValue}>Lv.{level}</span>
        </div>
      </div>

      <p style={styles.hint}>
        レッスン参加時に、このQRコードをインストラクターに提示してください。
      </p>
    </div>
  )
}

const styles = {
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' },
  container: { fontFamily: 'sans-serif', padding: '24px', textAlign: 'center', maxWidth: '420px', margin: '0 auto' },
  title: { fontSize: '20px', marginBottom: '4px' },
  name: { fontSize: '16px', color: '#555', marginBottom: '20px' },
  qrBox: { display: 'inline-block', padding: '16px', background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '24px' },
  statsBox: { display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '24px' },
  stat: { display: 'flex', flexDirection: 'column' },
  statLabel: { fontSize: '12px', color: '#888' },
  statValue: { fontSize: '22px', fontWeight: 'bold' },
  text: { fontSize: '14px', lineHeight: '1.6', color: '#555' },
  hint: { fontSize: '12px', color: '#999' },
}

export default App
