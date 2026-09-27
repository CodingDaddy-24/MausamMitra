import { useEffect, useMemo, useState } from 'react'
import { History, Info } from 'lucide-react'
import { getHistorical, errorMessage } from '../api'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { SeriesChart } from '../components/SeriesChart'
import type { AppContextValue } from '../App'

type Historical = { reference_series: { time: string; value: number }[]; model_series: { time: string; provider: string; value: number }[]; weight_history: { time: string; provider: string; variable: string; weight: number }[]; empty_reason?: string }
const names: Record<string, string> = { gfs: 'GFS', ifs: 'IFS HRES', aifs: 'AIFS', gfs_ensemble: 'GFS Ensemble' }
export function HistoricalPage({ context }: { context: AppContextValue }) {
  const [data, setData] = useState<Historical | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const [weightVariable, setWeightVariable] = useState('temperature')
  useEffect(() => { let active = true; if (!context.selection.district) { setData(null); setError(''); setLoading(false); return () => { active = false } }; setLoading(true); setError(''); getHistorical(context.selection).then(result => { if (active) setData(result as Historical) }).catch(reason => { if (active) setError(errorMessage(reason)) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [context.selection.state, context.selection.district])
  const weights = useMemo(() => {
    const rows = (data?.weight_history || []).filter(item => item.variable === weightVariable); const byTime = new Map<string, Record<string, unknown>>()
    rows.forEach(item => { const key = new Date(item.time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); const row = byTime.get(key) || { time: key }; row[item.provider] = item.weight * 100; byTime.set(key, row) })
    return [...byTime.values()]
  }, [data?.weight_history, weightVariable])
  const weightKeys = [...new Set((data?.weight_history || []).filter(row => row.variable === weightVariable).map(row => row.provider))].map((key, index) => ({ key, label: names[key] || key, color: ['#1a5b9c', '#16877c', '#d99031', '#8068ae'][index % 4] }))
  return <div className="page-stack"><section className="page-intro"><div><div className="section-kicker"><History size={14} /> TEMPORAL VERIFICATION</div><h2>Historical analysis</h2><p>Model versus reference history and observed contribution weights for {context.selection.district}, {context.selection.state}.</p></div><span className="badge-neutral">Last 14 days</span></section>
    {error ? <ErrorState message={error} /> : null}
    <div className="notice-panel"><Info size={16} /><span>Reference series require archived forecasts aligned against a named observation or reanalysis source. The system shows an empty state until verified history has been stored.</span></div>
    <section className="panel"><div className="panel-head"><div><div className="section-kicker">VERIFIED OBSERVATIONS</div><h3>Model vs reference</h3></div><span className="badge-neutral">{data?.reference_series.length || 0} points</span></div>{loading ? <LoadingState /> : data?.reference_series.length ? <SeriesChart data={data.reference_series.map(row => ({ time: new Date(row.time).toLocaleDateString('en-IN'), reference: row.value }))} keys={[{ key: 'reference', label: 'Reference' }]} /> : <EmptyState title="No aligned history available" detail={data?.empty_reason || 'Verified model and reference observations have not been ingested.'} />}</section>
    <section className="panel"><div className="panel-head"><div><div className="section-kicker">ADAPTIVE CONTRIBUTION</div><h3>Weight evolution</h3></div><div className="map-selectors"><label className="compact-select"><span>VARIABLE</span><select aria-label="Weight variable" value={weightVariable} onChange={event => setWeightVariable(event.target.value)}><option value="rainfall">Rainfall</option><option value="temperature">Temperature</option><option value="wind">Wind</option></select></label><span className="badge-neutral">{data?.weight_history.filter(row => row.variable === weightVariable).length || 0} snapshots</span></div></div>{loading ? <LoadingState /> : weights.length ? <SeriesChart data={weights} keys={weightKeys} unit="%" /> : <EmptyState title="Weight history starts with forecasts" detail="Each forecast request records the current per-variable weights. Select a location and request forecasts over time to build the series." />}</section>
  </div>
}
