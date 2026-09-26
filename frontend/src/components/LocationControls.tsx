import { useEffect, useState } from 'react'
import { MapPin, RefreshCw } from 'lucide-react'
import { getDistricts, getRegions, getStates } from '../api'
import type { AppContextValue } from '../App'
import type { LeadHours } from '../types'

export function LocationControls({ context }: { context: AppContextValue }) {
  const [regions, setRegions] = useState<string[]>([])
  const [states, setStates] = useState<string[]>([])
  const [districts, setDistricts] = useState<string[]>([])
  const [lookupError, setLookupError] = useState('')
  useEffect(() => { getRegions().then(setRegions).catch(() => setLookupError('Location service unavailable')) }, [])
  useEffect(() => {
    if (!context.selection.region) { setStates([]); return }
    getStates(context.selection.region).then(options => { setLookupError(''); setStates(options); if (context.selection.state && !options.includes(context.selection.state)) context.setSelection({ ...context.selection, state: '', district: '' }) }).catch(() => setLookupError('Could not load states'))
  }, [context.selection.region])
  useEffect(() => {
    if (!context.selection.state) { setDistricts([]); return }
    getDistricts(context.selection.state).then(options => { setLookupError(''); setDistricts(options); if (context.selection.district && !options.includes(context.selection.district)) context.setSelection({ ...context.selection, district: '' }) }).catch(() => setLookupError('Could not load districts for this state'))
  }, [context.selection.state])
  const set = (key: keyof typeof context.selection, value: string) => {
    if (key === 'region') context.setSelection({ ...context.selection, region: value, state: '', district: '' })
    if (key === 'state') context.setSelection({ ...context.selection, state: value, district: '' })
    if (key === 'district') context.setSelection({ ...context.selection, district: value })
    if (key === 'lead_hours') context.setSelection({ ...context.selection, lead_hours: Number(value) as LeadHours })
  }
  return <form className="location-controls" onSubmit={event => { event.preventDefault(); if (context.selection.region && context.selection.state && context.selection.district) void context.refresh() }}>
    <div className="section-kicker"><MapPin size={14} /> LOCATION &amp; FORECAST WINDOW</div>
    <div className="control-row">
      <label className="select-field"><span>REGION</span><select aria-label="Region" required value={context.selection.region} onChange={event => set('region', event.target.value)}><option value="">Select region</option>{regions.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="select-field"><span>STATE / UT</span><select aria-label="State" required disabled={!states.length} value={context.selection.state} onChange={event => set('state', event.target.value)}><option value="">Select state</option>{states.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="select-field"><span>DISTRICT / CITY</span><select aria-label="District or city" required disabled={!districts.length} value={context.selection.district} onChange={event => set('district', event.target.value)}><option value="">Select district</option>{districts.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="select-field lead-field"><span>LEAD TIME</span><select aria-label="Lead time" value={context.selection.lead_hours} onChange={event => set('lead_hours', event.target.value)}>{[24, 48, 72].map(item => <option key={item} value={item}>{item} hours</option>)}</select></label>
      <button className="button-primary fetch-button" disabled={context.loading || !context.selection.district} type="submit">{context.loading ? <RefreshCw className="spin" size={15} /> : <RefreshCw size={15} />}{context.loading ? 'Loading' : 'Get forecast'}</button>
    </div>
    {lookupError ? <p className="inline-error">{lookupError}</p> : null}
  </form>
}
