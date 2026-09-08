import { useEffect, useRef, useState } from 'react'
import liff from '@line/liff'
import { Html5Qrcode } from 'html5-qrcode'
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore'
import { db } from './firebase'

const LIFF_ID = '2011462958-11DZOAg4'
const SCAN_COOLDOWN_MS = 5000

function calcLevel(points) {
  if (points >= 100) return 5
  if (points >= 60) return 4
  if (points >= 30) return 3
  if (points >= 10) return 2
  return 1
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

    try {
      const ref = doc(db, 'customers', uid)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        setLastResult({ ok: false, message: '登録されていない顧客です' })
        return
      }
      await updateDoc(ref, { points: increment(1) })
      const newSnap = await getDoc(ref)
      const data = newSnap.data()
      setLastResult({
        ok: true,
        name: data.name,
        points: data.points,
        level: calcLevel(data.points),
      })
    } catch (e) {
      console.error(e)
      setLastResult({ ok: false, message: '処理に失敗しました' })
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
                +1pt（現在 {lastResult.points}pt / Lv.{lastResult.level}）
              </p>
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
  resultOk: { marginTop: '20px', padding: '16px', background: '#e6f7ee', borderRadius: '10px' },
  resultNg: { marginTop: '20px', padding: '16px', background: '#fdeaea', borderRadius: '10px', color: '#c0392b' },
  resultName: { fontSize: '18px', fontWeight: 'bold', margin: 0 },
  resultPoints: { fontSize: '15px', margin: '4px 0 0' },
}

export default ScanApp
