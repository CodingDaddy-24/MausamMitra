import { LocationControls } from '../components/LocationControls'
import { ForecastCards } from '../components/ForecastCards'
import { RiskAlert } from '../components/RiskAlert'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'
import { useMemo, useState } from 'react'
import { lazy, Suspense } from 'react'
import type { AppContextValue } from '../App'

const WeatherMap = lazy(() => import('../components/WeatherMap'))

const label: Record<string, string> = { gfs: 'NCEP GFS', ifs: 'ECMWF IFS HRES', aifs: 'ECMWF AIFS', gfs_ensemble: 'GFS Ensemble mean' }
export function Dashboard({ context }: { context: AppContextValue }) {
  const [mapVariable, setMapVariable] = useState<'rainfall' | 'temperature'>('rainfall')
  const providers = context.forecast?.providers || []
  const available = useMemo(() => providers.filter(item => item.available), [providers])
  return <div className="page-stack">
    <section className="page-intro"><div><div className="section-kicker"><span className="status-led" /> MULTI-MODEL BLEND <span className="run-tag">24 / 48 / 72 H</span></div><h2>Weather Forecast Dashboard</h2><p>Adaptive, multi-model guidance for {context.selection.district || 'your selected location'}.</p></div><div className="intro-coord">{context.forecast ? <><span>GRID COORDINATE</span><strong>{context.forecast.location.latitude.toFixed(3)}° N&nbsp; {context.forecast.location.longitude.toFixed(3)}° E</strong></> : null}</div></section>
    <LocationControls context={context} />
    {context.error ? <ErrorState message={context.error} retry={() => void context.refresh()} /> : null}
    {context.forecast?.current ? <section className="panel current-conditions"><div><div className="section-kicker">CURRENT CONDITIONS · OPEN-METEO</div><strong>{context.forecast.current.temperature_c?.toFixed(1) ?? '—'} °C</strong><span>Feels {context.forecast.current.apparent_temperature_c?.toFixed(1) ?? '—'} °C</span></div><div><span>RAIN</span><strong>{context.forecast.current.rainfall_mm?.toFixed(1) ?? '—'} mm</strong></div><div><span>WIND</span><strong>{context.forecast.current.wind_speed_kmh?.toFixed(1) ?? '—'} km/h</strong></div><div><span>HUMIDITY</span><strong>{context.forecast.current.relative_humidity_percent?.toFixed(0) ?? '—'}%</strong></div><div className="current-time">Observed {context.forecast.current.time ? new Date(context.forecast.current.time).toLocaleString() : 'time unavailable'}</div></section> : null}
    {context.forecast?.risks ? <RiskAlert risks={context.forecast.risks} /> : null}
    <ForecastCards forecast={context.forecast} loading={context.loading} />
    {context.forecast ? <>
      <div className="content-grid dashboard-grid">
        <section className="panel map-panel"><div className="panel-head"><div><div className="section-kicker">DISTRICT OUTLOOK</div><h3>Forecast map</h3></div><div className="segmented" role="group" aria-label="Map variable"><button className={mapVariable === 'rainfall' ? 'selected' : ''} onClick={() => setMapVariable('rainfall')}>Rainfall</button><button className={mapVariable === 'temperature' ? 'selected' : ''} onClick={() => setMapVariable('temperature')}>Temperature</button></div></div><Suspense fallback={<div className="data-state" style={{ height: 330 }}>Loading map layer…</div>}><WeatherMap selection={context.selection} variable={mapVariable} height="330px" /></Suspense><div className="map-foot"><span>Selected district · representative place forecast</span><button className="text-button" onClick={() => { window.location.href = '/map' }}>Open full map →</button></div></section>
        <section className="panel contribution-panel"><div className="panel-head"><div><div className="section-kicker">TRANSPARENT BLENDING</div><h3>Model contribution</h3></div><span className="badge-neutral">{available.length} / 4 feeds</span></div>
          {!available.length ? <EmptyState title="No provider data" detail="Provider status will appear after a forecast request." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>MODEL</th><th>WEIGHT</th><th>STATUS</th></tr></thead><tbody>{providers.map(item => <tr key={item.provider}><td><span className={`provider-dot ${item.available ? 'up' : ''}`} />{label[item.provider] || item.label}</td><td className="mono">{item.available ? `${((context.forecast?.weights[item.provider] || 0) * 100).toFixed(1)}%` : '—'}</td><td><span className={`status-tag ${item.available ? 'ok' : 'down'}`}>{item.available ? 'AVAILABLE' : 'UNAVAILABLE'}</span></td></tr>)}</tbody></table></div>}
          {providers.some(item => !item.available) ? <div className="provider-notice"><Info size={14} />{providers.filter(item => !item.available).map(item => `${item.label}: ${item.error}`).join(' · ')}</div> : null}
          <div className="method-note"><strong>WEIGHTING METHOD</strong><p>{context.forecast?.weighting_note}</p></div>
        </section>
      </div>
      <section className="panel outlook-panel"><div className="panel-head"><div><div className="section-kicker">FORECAST WINDOW</div><h3>Period summary</h3></div><span className="badge-neutral">Next {context.selection.lead_hours} hours</span></div><div className="outlook-row"><div><span>ACCUMULATED RAIN</span><strong>{context.forecast.summary.rainfall_mm?.toFixed(1) ?? '—'} <small>mm</small></strong><p>Sum of hourly model precipitation</p></div><div><span>PERIOD HIGH</span><strong>{context.forecast.summary.temperature_c?.toFixed(1) ?? '—'} <small>°C</small></strong><p>Maximum 2 m air temperature</p></div><div><span>MAX WIND</span><strong>{context.forecast.summary.wind_speed_kmh?.toFixed(1) ?? '—'} <small>km/h</small></strong><p>10 m wind speed · {context.forecast.summary.wind_direction_deg ?? '—'}°</p></div><div><span>MODEL COVERAGE</span><strong>{available.length}<small> / 4</small></strong><p>Unavailable feeds excluded per timestamp</p></div></div></section>
      <div className="explain-note"><Info size={15} /><span><strong>Explainability.</strong> Forecasts use the latest responses returned by each provider. Open-Meteo's standard forecast response does not expose model initialization runs; the system does not imply that source cycles are synchronized. Verification scores have not yet been populated, so the dashboard uses the documented equal-weight fallback.</span></div>
    </> : context.loading ? <LoadingState label="Fetching GFS, IFS, AIFS and ensemble feeds" /> : <EmptyState title="Select a location to begin" detail="Choose a region, state, and district, then request a forecast." />}
  </div>
}
import { Info } from 'lucide-react'
