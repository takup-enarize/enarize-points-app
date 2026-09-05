import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBrfhwjPrGZ85NHPlil0KyziizHWY01t_A",
  authDomain: "enarize-points.firebaseapp.com",
  projectId: "enarize-points",
  storageBucket: "enarize-points.firebasestorage.app",
  messagingSenderId: "740657242075",
  appId: "1:740657242075:web:87340ad7b65c0371a411fe"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
