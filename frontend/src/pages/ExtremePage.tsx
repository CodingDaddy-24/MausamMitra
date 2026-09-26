import { lazy, Suspense, useEffect, useState } from 'react'
import { ShieldAlert, TriangleAlert } from 'lucide-react'
import { getExtremeWeather, errorMessage } from '../api'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { RiskAlert } from '../components/RiskAlert'
import type { AppContextValue } from '../App'
import type { Risk } from '../types'

type ExtremeData = { risks: Risk[]; thresholds: Record<string, { unit: string; yellow: number[]; orange: number[]; red: number[] }>; prototype_notice: string }
const WeatherMap = lazy(() => import('../components/WeatherMap'))
export function ExtremePage({ context }: { context: AppContextValue }) {
  const [data, setData] = useState<ExtremeData | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  useEffect(() => { let active = true; setLoading(true); setError(''); getExtremeWeather(context.selection).then(result => { if (active) setData(result as ExtremeData) }).catch(reason => { if (active) setError(errorMessage(reason)) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [context.selection.region, context.selection.state, context.selection.district, context.selection.lead_hours])
  const icons: Record<string, string> = { rainfall: 'RAIN', wind: 'WIND', heat: 'HEAT' }
  const risk = data?.risks || []
  return <div className="page-stack"><section className="page-intro"><div><div className="section-kicker"><ShieldAlert size={14} /> THRESHOLD SCREENING</div><h2>Extreme weather</h2><p>Backend-driven threshold indicators for {context.selection.district}, {context.selection.state}.</p></div></section>
    {data ? <RiskAlert risks={data.risks} /> : null}{error ? <ErrorState message={error} /> : null}
    <div className="risk-grid">{loading && !data ? <LoadingState label="Evaluating weather thresholds" /> : risk.length ? risk.map(item => { const ranges = data?.thresholds[item.parameter]; return <article className={`risk-card ${item.severity.toLowerCase()}`} key={item.parameter}><div className="risk-card-top"><span>{icons[item.parameter] || item.parameter.toUpperCase()} RISK</span><TriangleAlert size={17} /></div><strong>{item.value.toFixed(1)} <small>{item.unit}</small></strong><span className={`risk-level ${item.severity.toLowerCase()}`}>{item.severity}</span><div className="risk-threshold"><span>Yellow {ranges?.yellow?.[0]}–{ranges?.yellow?.[1] ?? '∞'}</span><span>Orange {ranges?.orange?.[0]}–{ranges?.orange?.[1] ?? '∞'}</span><span>Red &gt;{ranges?.red?.[0]}</span></div></article> }) : <EmptyState title="Risk data unavailable" detail="Request a forecast to evaluate configured thresholds." />}</div>
    {data ? <div className="prototype-warning"><TriangleAlert size={17} /><span><strong>Prototype guidance only.</strong> {data.prototype_notice}</span></div> : null}
    <section className="panel"><div className="panel-head"><div><div className="section-kicker">SPATIAL THRESHOLD VIEW</div><h3>Selected district exposure</h3></div><span className="badge-neutral">Rainfall layer</span></div><Suspense fallback={<div className="data-state">Loading map layer…</div>}><WeatherMap selection={context.selection} variable="rainfall" height="400px" /></Suspense><p className="map-limitation">The available model returns a representative point forecast. This layer highlights only the selected district, not a gridded national risk field.</p></section>
  </div>
}
