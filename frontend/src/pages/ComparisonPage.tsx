import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Database, Info } from 'lucide-react'
import { getModelComparison, errorMessage } from '../api'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { SeriesChart } from '../components/SeriesChart'
import type { AppContextValue } from '../App'
import type { HourlyPoint, ModelMetric, Variable } from '../types'

const labels: Record<string, string> = { gfs: 'GFS', ifs: 'IFS HRES', aifs: 'AIFS', gfs_ensemble: 'GFS Ensemble' }
export function ComparisonPage({ context }: { context: AppContextValue }) {
  const [variable, setVariable] = useState<Variable>('temperature')
  const [data, setData] = useState<Awaited<ReturnType<typeof getModelComparison>> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => { let active = true; if (!context.selection.district) { setData(null); setError(''); setLoading(false); return () => { active = false } }; setLoading(true); setError(''); getModelComparison(context.selection, variable).then(result => { if (active) setData(result) }).catch(reason => { if (active) setError(errorMessage(reason)) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [context.selection.region, context.selection.state, context.selection.district, context.selection.lead_hours, variable])
  const series = useMemo(() => {
    const allTimes = data?.blended_hourly.map(point => point.time) || []
    return allTimes.map((time, index) => {
      const read = (point: HourlyPoint | undefined) => variable === 'rainfall' ? point?.rainfall_mm : variable === 'temperature' ? point?.temperature_c : point?.wind_speed_kmh
      const row: Record<string, unknown> = { time: new Date(time).toLocaleTimeString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit' }), blended: read(data?.blended_hourly[index]) }
      data?.providers.forEach(provider => { row[provider.provider] = read(provider.hourly[index]) })
      return row
    })
  }, [data, variable])
  const keys = [{ key: 'blended', label: 'Blended forecast', color: '#143d60', width: 3 }, ...(data?.providers || []).filter(provider => provider.available).map((provider, index) => ({ key: provider.provider, label: labels[provider.provider] || provider.label, color: ['#278c8a', '#d99031', '#8068ae', '#b65148'][index % 4] }))]
  const unit = variable === 'temperature' ? ' °C' : variable === 'rainfall' ? ' mm' : ' km/h'
  const metricNames: (keyof Pick<ModelMetric, 'mae' | 'rmse' | 'correlation' | 'bias'>)[] = ['mae', 'rmse', 'correlation', 'bias']
  return <div className="page-stack"><section className="page-intro"><div><div className="section-kicker"><BarChart3 size={14} /> SOURCE OF TRUTH · MODEL METRICS</div><h2>Model comparison</h2><p>Hourly model forecasts and verified skill metrics for {context.selection.district}, {context.selection.state}.</p></div><label className="compact-select"><span>VARIABLE</span><select aria-label="Comparison variable" value={variable} onChange={event => setVariable(event.target.value as Variable)}><option value="temperature">Temperature</option><option value="rainfall">Rainfall</option><option value="wind">Wind speed</option></select></label></section>
    <div className="metric-grid">{metricNames.map(name => { const candidates = data?.metrics || []; const chosen = candidates.length ? name === 'correlation' ? [...candidates].filter(row => row[name] != null).sort((a, b) => (b[name] || 0) - (a[name] || 0))[0] : name === 'bias' ? [...candidates].filter(row => row[name] != null).sort((a, b) => Math.abs(a[name] || 0) - Math.abs(b[name] || 0))[0] : [...candidates].sort((a, b) => a[name] - b[name])[0] : undefined; return <article className="metric-box" key={name}><span>{name.toUpperCase()}</span><strong>{chosen?.[name] == null ? 'N/A' : chosen[name]!.toFixed(2)}</strong><small>{chosen ? `Best · ${labels[chosen.provider] || chosen.provider}` : 'No verified samples'}</small></article> })}</div>
    {!loading && !error && !data?.metrics_available ? <div className="notice-panel"><Info size={16} /><span><strong>Verification data not populated.</strong> Skill metrics are never fabricated. Add aligned forecast/reference observations to <code>model_skill_metrics</code> to activate MAE, RMSE, correlation, and bias.</span></div> : null}
    <section className="panel"><div className="panel-head"><div><div className="section-kicker">NEXT {context.selection.lead_hours} HOURS</div><h3>Forecast traces</h3></div><span className="badge-neutral"><Database size={12} /> Provider data</span></div>{loading ? <LoadingState label="Loading model traces" /> : error ? <ErrorState message={error} /> : series.length ? <SeriesChart data={series} keys={keys} unit={unit} /> : <EmptyState title="No traces available" detail="Model forecast traces will appear when one or more upstream feeds are available." />}</section>
    <section className="panel"><div className="panel-head"><div><div className="section-kicker">VERIFICATION RECORDS</div><h3>Model skill table</h3></div><span className="badge-neutral">{data?.metrics.length || 0} records</span></div>{data?.metrics.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>MODEL</th><th>MAE</th><th>RMSE</th><th>CORRELATION</th><th>BIAS</th><th>SAMPLES</th><th>REFERENCE</th></tr></thead><tbody>{data.metrics.map(row => <tr key={row.provider}><td>{labels[row.provider] || row.provider}</td><td className="mono">{row.mae.toFixed(2)}</td><td className="mono">{row.rmse.toFixed(2)}</td><td className="mono">{row.correlation?.toFixed(3) ?? '—'}</td><td className="mono">{row.bias?.toFixed(2) ?? '—'}</td><td>{row.sample_count}</td><td>{row.reference || '—'}</td></tr>)}</tbody></table></div> : <EmptyState title="No verification records yet" detail="This table reads stored metrics only. The MVP does not generate synthetic skill scores." />}</section>
  </div>
}
