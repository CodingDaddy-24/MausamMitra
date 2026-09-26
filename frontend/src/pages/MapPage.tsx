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
  return <div className="page-stack"><section className="page-intro"><div><div className="section-kicker"><MapPinned size={14} /> SPATIAL FORECAST LAYER</div><h2>Weather map</h2><p>District boundaries with live point forecast values from the selected model source.</p></div></section><LocationControls context={context} /><section className="panel full-map-panel"><div className="panel-head"><div><div className="section-kicker">INDIA · ADMINISTRATIVE LEVEL 2</div><h3>{context.selection.district}, {context.selection.state}</h3></div><div className="map-selectors"><label className="compact-select"><span>MODEL</span><select aria-label="Map model" value={model} onChange={event => setModel(event.target.value)}><option value="blended">Blended</option><option value="gfs">NCEP GFS</option><option value="ifs">ECMWF IFS</option><option value="aifs">ECMWF AIFS</option><option value="gfs_ensemble">GFS Ensemble</option></select></label><label className="compact-select"><span>VARIABLE</span><select aria-label="Map variable" value={variable} onChange={event => setVariable(event.target.value as Variable)}>{variables.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div></div><Suspense fallback={<div className="data-state">Loading map layer…</div>}><WeatherMap selection={context.selection} variable={variable} model={model} height="min(66vh, 640px)" /></Suspense><div className="legend-row"><span className="legend-chip" style={{ background: '#208fc1' }} /> low <span className="legend-chip" style={{ background: '#eab308' }} /> elevated <span className="legend-chip" style={{ background: '#ea580c' }} /> high <span className="legend-chip" style={{ background: '#b91c1c' }} /> severe <span className="legend-unit">{variables.find(item => item.id === variable)?.unit}</span></div><p className="map-limitation">Only the selected district is shaded from a forecast at its geocoded representative place. This MVP does not interpolate model fields into a district-wide grid.</p></section></div>
}
