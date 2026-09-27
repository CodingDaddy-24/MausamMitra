import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { getDistricts, getMap, getMapBoundaries } from '../api'
import { LoadingState } from './DataState'
import type { LocationSelection, Variable } from '../types'

const tileUrl = import.meta.env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const indiaCenter: [number, number] = [22.8, 79]
type ForecastFeature = Feature<Geometry, { Name?: string; NAME?: string; forecast_value?: number | null; unit?: string; wind_direction_deg?: number | null }>
type MapPayload = FeatureCollection<Geometry, ForecastFeature['properties']>
const riskCopy = ['No Alert / Normal Conditions', 'Yellow Alert (Be Aware / Moderate Risk)', 'Orange Alert (Be Prepared / High Risk)', 'Red Alert (Take Action / Extreme Risk)']

function thresholds(variable: Variable) {
  if (variable === 'rainfall') return [
    { color: '#99CCFF', range: '< 64.5 mm', label: 'Normal' },
    { color: '#00B0F0', range: '64.5–115.5 mm', label: 'Yellow alert' },
    { color: '#0070C0', range: '115.6–204.4 mm', label: 'Orange alert' },
    { color: '#002060', range: '> 204.4 mm', label: 'Red alert' },
  ]
  if (variable === 'temperature') return [
    { color: '#00B050', range: '< 40°C', label: 'Normal' },
    { color: '#FFFF00', range: '40–<42°C', label: 'Yellow alert' },
    { color: '#FFC000', range: '42–45°C', label: 'Orange alert' },
    { color: '#FF0000', range: '> 45°C', label: 'Red alert' },
  ]
  return [
    { color: '#99CCFF', range: 'Low', label: 'Low' },
    { color: '#00B0F0', range: 'Moderate', label: 'Moderate' },
    { color: '#0070C0', range: 'High', label: 'High' },
    { color: '#002060', range: 'Severe', label: 'Severe' },
  ]
}
function metricColor(variable: Variable, value: number) {
  if (variable === 'rainfall') return value > 204.4 ? '#002060' : value >= 115.6 ? '#0070C0' : value >= 64.5 ? '#00B0F0' : '#99CCFF'
  if (variable === 'temperature') return value > 45 ? '#FF0000' : value >= 42 ? '#FFC000' : value >= 40 ? '#FFFF00' : '#00B050'
  return value >= 80 ? '#002060' : value >= 60 ? '#0070C0' : value >= 40 ? '#00B0F0' : '#99CCFF'
}
function centerOf(feature: Feature): [number, number] | null {
  const geometry = feature.geometry
  if (!geometry) return null
  const rings: number[][][] = geometry.type === 'Polygon' ? [geometry.coordinates[0].map(point => [point[0], point[1]])] : geometry.type === 'MultiPolygon' ? geometry.coordinates.flatMap(polygon => polygon[0] ? [polygon[0].map(point => [point[0], point[1]])] : []) : []
  const points = rings.flat()
  if (!points.length) return null
  return [points.reduce((sum, point) => sum + point[1], 0) / points.length, points.reduce((sum, point) => sum + point[0], 0) / points.length]
}
function FitFeatures({ data, fallback }: { data: FeatureCollection | null; fallback: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    if (!data?.features.length) { map.setView(fallback, 5); return }
    const bounds = L.geoJSON(data).getBounds()
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.08), { animate: true, maxZoom: 8 })
  }, [data, fallback, map])
  return null
}
function severity(value: number, variable: Variable) {
  if (variable === 'rainfall') return value > 204.4 ? 3 : value >= 115.6 ? 2 : value >= 64.5 ? 1 : 0
  if (variable === 'temperature') return value > 45 ? 3 : value >= 42 ? 2 : value >= 40 ? 1 : 0
  return 0
}
function forecastValue(feature: ForecastFeature | undefined) {
  const value = feature?.properties?.forecast_value
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
}

export function WeatherMap({ selection, variable, model = 'blended', height = '420px' }: { selection: LocationSelection; variable: Variable; model?: string; height?: string }) {
  const [boundaries, setBoundaries] = useState<MapPayload | null>(null)
  const [districts, setDistricts] = useState<ForecastFeature[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let alive = true
    setError(''); setDistricts([]); setBoundaries(null); setLoading(true)
    const load = async () => {
      if (!selection.state) {
        const national = await getMapBoundaries('states') as MapPayload
        if (alive) setBoundaries(national)
        return
      }
      if (!selection.district) {
        const [outlines, names] = await Promise.all([getMapBoundaries('districts', selection.state), getDistricts(selection.state)])
        if (alive) setBoundaries(outlines as MapPayload)
        // All districts for the selected state are requested together; no district forecast is requested for the India overview.
        const results = await Promise.allSettled(names.map(district => getMap({ ...selection, district }, variable, model)))
        if (alive) setDistricts(results.flatMap(result => result.status === 'fulfilled' ? (result.value as MapPayload).features : []))
        const failed = results.filter(result => result.status === 'rejected').length
        if (alive && failed) setError(`${failed} of ${names.length} district forecasts could not be loaded.`)
        return
      }
      const result = await getMap(selection, variable, model) as MapPayload
      if (alive) { setBoundaries(result); setDistricts(result.features) }
    }
    load().catch(reason => { if (alive) setError(reason?.response?.data?.detail || 'Map boundaries or forecasts could not be loaded') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [selection.region, selection.state, selection.district, selection.lead_hours, variable, model])

  const fitData = useMemo(() => selection.state && !selection.district && boundaries ? boundaries : boundaries, [boundaries, selection.state, selection.district])
  const legend = thresholds(variable)
  const selectedFeature = districts[0]
  const selectedValue = forecastValue(selectedFeature)
  const selectedLevel = Number.isFinite(selectedValue) ? severity(selectedValue, variable) : 0
  const stateOnly = Boolean(selection.state && !selection.district)
  return <div className="map-frame" style={{ height }}>
    <MapContainer center={indiaCenter} zoom={4} scrollWheelZoom className="leaflet-map">
      <FitFeatures data={fitData} fallback={indiaCenter} />
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url={tileUrl} />
      {boundaries && !stateOnly && !selection.district ? <GeoJSON key="india-states" data={boundaries} style={() => ({ color: '#315c7b', weight: 1.1, fillColor: '#d8e8f1', fillOpacity: 0.38 })} /> : null}
      {stateOnly && boundaries ? <GeoJSON key={`state-district-outlines-${selection.state}`} data={boundaries} style={() => ({ color: '#52728a', weight: 1, fillColor: '#e5edf2', fillOpacity: 0.32 })} /> : null}
      {districts.map((feature, index) => {
        const value = forecastValue(feature)
        const hasValue = Number.isFinite(value)
        return <GeoJSON key={`${selection.state}-${feature.properties?.Name || feature.properties?.NAME}-${index}-${variable}`} data={feature} style={() => ({ color: '#31556f', weight: selection.district ? 2 : 0.8, fillColor: hasValue ? metricColor(variable, value) : '#9baab5', fillOpacity: hasValue ? 0.66 : 0.18 })}>
          <Popup><strong>{feature.properties?.Name || feature.properties?.NAME || selection.district}</strong><br />{hasValue ? <>{value.toFixed(1)} {feature.properties?.unit}<br />{riskCopy[severity(value, variable)]}</> : 'Forecast unavailable'}</Popup>
        </GeoJSON>
      })}
      {stateOnly ? districts.map((feature, index) => {
        const point = centerOf(feature)
        const value = forecastValue(feature)
        if (!point) return null
        return <CircleMarker key={`district-dot-${index}`} center={point} radius={6} pathOptions={{ color: '#fff', weight: 1.5, fillColor: Number.isFinite(value) ? metricColor(variable, value) : '#738494', fillOpacity: 1 }}><Popup><strong>{feature.properties?.Name || feature.properties?.NAME}</strong><br />{Number.isFinite(value) ? `${value.toFixed(1)} ${feature.properties?.unit} · ${riskCopy[severity(value, variable)]}` : 'Forecast unavailable'}</Popup></CircleMarker>
      }) : null}
    </MapContainer>
    {!selection.state ? <div className="national-map-notice" role="status">Please select a State to view regional forecasts. Full national district generation is restricted to optimize performance.</div> : null}
    <div className="map-overlay"><span className="map-dot" /> {selection.district ? `${selection.district}, ${selection.state}` : selection.state || 'INDIA OVERVIEW'}</div>
    <div className="map-legend" aria-label={`${variable} map legend`}><strong>{variable === 'rainfall' ? 'RAINFALL' : variable === 'temperature' ? 'TEMPERATURE' : 'WIND'}</strong>{legend.slice().reverse().map(item => <div className="map-legend-item" key={item.range}><span style={{ backgroundColor: item.color }} /><div><b>{item.range}</b><small>{item.label}</small></div></div>)}</div>
    {loading ? <div className="map-loading"><LoadingState label={stateOnly ? 'Loading forecasts for this state’s districts' : 'Loading map boundaries and forecast'} /></div> : null}
    {error ? <div className="map-notice">{error}</div> : null}
    {selectedFeature && Number.isFinite(selectedValue) && selection.district ? <div className={`map-risk-badge ${['normal', 'yellow', 'orange', 'red'][selectedLevel]}`}>{riskCopy[selectedLevel]}</div> : null}
  </div>
}

export default WeatherMap
