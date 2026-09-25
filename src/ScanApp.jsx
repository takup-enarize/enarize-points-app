import { useEffect, useRef, useState } from 'react'
import liff from '@line/liff'
import { Html5Qrcode } from 'html5-qrcode'
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore'
import { db } from './firebase'

const LIFF_ID = '2011462958-11DZOAg4'
const SCAN_COOLDOWN_MS = 5000

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

function calcLevel(points) {
  let name = LEVELS[0].name
  for (const l of LEVELS) {
    if (points >= l.pt) name = l.name
  }
  return name
}

function ScanApp() {
  const [status, setStatus] = useState('起動中...')
  const [lastResult, setLastResult] = useState(null)
  const scannerRef = useRef(null)
  const lastScanRef = useRef({ uid: null, time: 0 })

  useEffect(() => {
    async function init() {
      try {
        await liff.init({ liffId: LIFF_ID })
        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }
        startScanner()
      } catch (e) {
        console.error(e)
        setStatus('起動に失敗しました。ページを再読み込みしてください。')
      }
    }
    init()
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  function startScanner() {
    const scanner = new Html5Qrcode('reader')
    scannerRef.current = scanner
    setStatus('QRコードを読み取ってください')

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        onScanSuccess,
        () => {}
      )
      .catch((e) => {
        console.error(e)
        setStatus('カメラを起動できませんでした。カメラの許可設定をご確認ください。')
      })
  }

  async function onScanSuccess(decodedText) {
    const uid = decodedText.trim()
    const now = Date.now()

    if (lastScanRef.current.uid === uid && now - lastScanRef.current.time < SCAN_COOLDOWN_MS) {
      return
    }
    lastScanRef.current = { uid, time: now }

    await refreshAfterScan(uid, true)
  }

  async function refreshAfterScan(uid, addPoint) {
    try {
      const ref = doc(db, 'customers', uid)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        setLastResult({ ok: false, message: '登録されていない顧客です' })
        return
      }
      if (addPoint) {
        await updateDoc(ref, { points: increment(1) })
      }
      const newSnap = await getDoc(ref)
      const data = newSnap.data()
      setLastResult({
        ok: true,
        uid,
        name: data.name,
        points: data.points,
        level: calcLevel(data.points),
        rewardsUsed: data.rewardsUsed || {},
      })
    } catch (e) {
      console.error(e)
      setLastResult({ ok: false, message: '処理に失敗しました' })
    }
  }

  async function markRewardUsed(rewardKey) {
    if (!lastResult?.uid) return
    try {
      const ref = doc(db, 'customers', lastResult.uid)
      const usedMap = { ...(lastResult.rewardsUsed || {}) }
      usedMap[rewardKey] = true
      await updateDoc(ref, { rewardsUsed: usedMap })
      await refreshAfterScan(lastResult.uid, false)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>ENARIZE スキャン</h2>
      <p style={styles.status}>{status}</p>

      <div id="reader" style={styles.reader}></div>

      {lastResult && (
        <div style={lastResult.ok ? styles.resultOk : styles.resultNg}>
          {lastResult.ok ? (
            <>
              <p style={styles.resultName}>{lastResult.name} さん</p>
              <p style={styles.resultPoints}>
                現在 {lastResult.points}pt ／ {lastResult.level}
              </p>

              <div style={styles.rewardsList}>
                {REWARDS.filter((r) => lastResult.points >= r.pt).map((r) => {
                  const used = lastResult.rewardsUsed?.[r.key]
                  return (
                    <div key={r.key} style={styles.rewardRow}>
                      <span style={styles.rewardLabel}>{r.label}</span>
                      {used ? (
                        <span style={styles.usedTag}>使用済み</span>
                      ) : (
                        <button style={styles.useButton} onClick={() => markRewardUsed(r.key)}>
                          使用済みにする
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p>{lastResult.message}</p>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { fontFamily: 'sans-serif', padding: '16px', textAlign: 'center', maxWidth: '420px', margin: '0 auto' },
  title: { fontSize: '20px', marginBottom: '8px' },
  status: { fontSize: '13px', color: '#888', marginBottom: '12px' },
  reader: { width: '100%', maxWidth: '360px', margin: '0 auto' },
  resultOk: { marginTop: '20px', padding: '16px', background: '#e6f7ee', borderRadius: '10px', textAlign: 'left' },
  resultNg: { marginTop: '20px', padding: '16px', background: '#fdeaea', borderRadius: '10px', color: '#c0392b' },
  resultName: { fontSize: '18px', fontWeight: 'bold', margin: 0, textAlign: 'center' },
  resultPoints: { fontSize: '15px', margin: '4px 0 12px', textAlign: 'center' },
  rewardsList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  rewardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '8px 12px', borderRadius: '8px' },
  rewardLabel: { fontSize: '13px', fontWeight: 'bold', color: '#333' },
  usedTag: { fontSize: '12px', color: '#999' },
  useButton: { background: '#E31E24', color: '#fff', border: 'none', borderRadius: '999px', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold' },
}

export default ScanApp
