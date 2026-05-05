import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import InsuranceApp from './InsuranceApp.jsx'

// Path-based industry routing — Vercel's catch-all rewrite serves
// /index.html for any path, and React picks the right component here.
// /insurance and any /insurance/* path → InsuranceApp; everything else → App.
const path = typeof window !== 'undefined' ? window.location.pathname : '/'
const isInsurance = path === '/insurance' || path.startsWith('/insurance/')
const RootComponent = isInsurance ? InsuranceApp : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>,
)
