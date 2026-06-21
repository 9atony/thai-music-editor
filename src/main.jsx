import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// 1. ต้องมีการ import ตัวนี้เข้ามา
import { MusicProvider } from './contexts/MusicContext.jsx' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 2. ต้องมี MusicProvider ครอบ App เอาไว้แบบนี้ครับ */}
    <MusicProvider> 
      <App />
    </MusicProvider>
  </React.StrictMode>,
)