import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, ChevronDown, Clock3, CloudRain, History, LayoutDashboard, Map, Menu, TriangleAlert, X } from 'lucide-react'
import { errorMessage, getForecast } from './api'
import type { Forecast, LeadHours, LocationSelection } from './types'

const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })))
const MapPage = lazy(() => import('./pages/MapPage').then(module => ({ default: module.MapPage })))
const ComparisonPage = lazy(() => import('./pages/ComparisonPage').then(module => ({ default: module.ComparisonPage })))
const HistoricalPage = lazy(() => import('./pages/HistoricalPage').then(module => ({ default: module.HistoricalPage })))
const ExtremePage = lazy(() => import('./pages/ExtremePage').then(module => ({ default: module.ExtremePage })))

export type AppContextValue = { selection: LocationSelection; setSelection: (value: LocationSelection) => void; forecast: Forecast | null; loading: boolean; error: string; refresh: () => Promise<void> }
export const TITLES: Record<string, string> = { '/': 'Forecast dashboard', '/map': 'Weather map', '/comparison': 'Model comparison', '/extreme': 'Extreme weather', '/history': 'Historical analysis' }

function Shell() {
  const [selection, setSelection] = useState<LocationSelection>({ region: 'Western India', state: 'Maharashtra', district: 'Mumbai', lead_hours: 24 })
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try { setForecast(await getForecast(selection)) } catch (reason) { setError(errorMessage(reason)); setForecast(null) } finally { setLoading(false) }
  }, [selection])
  const updateSelection = useCallback((value: LocationSelection) => {
    setSelection(value)
    setError('')
    if (value.region !== selection.region || value.state !== selection.state || value.district !== selection.district || value.lead_hours !== selection.lead_hours) setForecast(null)
  }, [selection])
  useEffect(() => { void refresh() }, [])
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const context: AppContextValue = { selection, setSelection: updateSelection, forecast, loading, error, refresh }
  const links = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/map', label: 'Weather map', icon: Map },
    { to: '/comparison', label: 'Model comparison', icon: BarChart3 },
    { to: '/extreme', label: 'Extreme weather', icon: TriangleAlert },
    { to: '/history', label: 'Historical analysis', icon: History },
  ]
  const currentTime = forecast?.generated_at ? new Date(forecast.generated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Awaiting data'
  return <div className="app-shell">
    {mobileOpen ? <button aria-label="Close navigation" className="mobile-scrim" onClick={() => setMobileOpen(false)} /> : null}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><CloudRain size={21} /></div><div><strong>MausamMitra</strong><span>WEATHER INTELLIGENCE</span></div><button className="icon-button mobile-close" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <div className="nav-label">OPERATIONS</div>
      <nav className="nav-list" aria-label="Main navigation">{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{to === '/extreme' ? <span className="nav-live" /> : null}</NavLink>)}</nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-source"><div className="source-led" /> LIVE MODEL FEEDS <span>4</span></div>
      <div className="sidebar-foot"><div className="sidebar-foot-mark">MM</div><div><strong>SIH 26081</strong><span>Hybrid AI · NWP system</span></div></div>
    </aside>
    <main className="main-shell">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
        <div className="topbar-title"><span className="eyebrow">INDIA WEATHER MONITOR</span><h1>{TITLES[location.pathname] || 'MausamMitra'}</h1></div>
        <div className="breadcrumb"><span>India</span><ChevronDown size={13} className="crumb-chevron" /><span>{selection.region || 'Region'}</span><ChevronDown size={13} className="crumb-chevron" /><span>{selection.state || 'State'}</span><ChevronDown size={13} className="crumb-chevron" /><strong>{selection.district || 'District'}</strong></div>
        <div className="topbar-time"><span><Clock3 size={14} /> FORECAST UPDATED</span><strong>{currentTime}</strong></div>
      </header>
      <div className="page-content"><Suspense fallback={<div className="data-state">Loading view…</div>}><Routes>
        <Route path="/" element={<Dashboard context={context} />} />
        <Route path="/map" element={<MapPage context={context} />} />
        <Route path="/comparison" element={<ComparisonPage context={context} />} />
        <Route path="/extreme" element={<ExtremePage context={context} />} />
        <Route path="/history" element={<HistoricalPage context={context} />} />
        <Route path="*" element={<div className="empty-state"><h2>Page not found</h2><button className="button-primary" onClick={() => navigate('/')}>Return to dashboard</button></div>} />
      </Routes></Suspense></div>
    </main>
  </div>
}

export function App() { return <BrowserRouter><Shell /></BrowserRouter> }
export type { LeadHours }
