import { lazy, Suspense, useState } from 'react'
import { MapPinned } from 'lucide-react'
import { LocationControls } from '../components/LocationControls'
import type { AppContextValue } from '../App'
import type { Variable } from '../types'

const WeatherMap = lazy(() => import('../components/WeatherMap'))

const variables: { id: Variable; name: string; unit: string }[] = [{ id: 'rainfall', name: 'Rainfall', unit: 'mm' }, { id: 'temperature', name: 'Temperature', unit: '°C' }, { id: 'wind', name: 'Wind speed', unit: 'km/h' }]
export function MapPage({ context }: { context: AppContextValue }) {
  const [variable, setVariable] = useState<Variable>('rainfall')
  const [model, setModel] = useState('blended')
  const locationLabel = context.selection.district ? `${context.selection.district}, ${context.selection.state}` : context.selection.state || 'India overview'
  return <div className="page-stack"><section className="page-intro"><div><div className="section-kicker"><MapPinned size={14} /> SPATIAL FORECAST LAYER</div><h2>Weather map</h2><p>Explore India, state boundaries, and selected-state district forecasts.</p></div></section><LocationControls context={context} /><section className="panel full-map-panel"><div className="panel-head"><div><div className="section-kicker">INDIA · ADMINISTRATIVE BOUNDARIES</div><h3>{locationLabel}</h3></div><div className="map-selectors"><label className="compact-select"><span>MODEL</span><select aria-label="Map model" value={model} onChange={event => setModel(event.target.value)}><option value="blended">Blended</option><option value="gfs">NCEP GFS</option><option value="ifs">ECMWF IFS</option><option value="aifs">ECMWF AIFS</option><option value="gfs_ensemble">GFS Ensemble</option></select></label><label className="compact-select"><span>VARIABLE</span><select aria-label="Map variable" value={variable} onChange={event => setVariable(event.target.value as Variable)}>{variables.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div></div><Suspense fallback={<div className="data-state">Loading map layer…</div>}><WeatherMap selection={context.selection} variable={variable} model={model} height="min(66vh, 640px)" /></Suspense><p className="map-limitation">{context.selection.district ? 'Selected district forecast and risk are shown on the map.' : context.selection.state ? 'Showing every district in the selected state. Choose a district for its granular forecast.' : 'Choose a state above to load regional district forecasts.'}</p></section></div>
}
