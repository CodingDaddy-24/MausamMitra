import { useEffect, useState } from 'react'
import L from 'leaflet'
import { CircleMarker, GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import type { FeatureCollection } from 'geojson'
import { getMap } from '../api'
import { ErrorState, LoadingState } from './DataState'
import type { LocationSelection, Variable } from '../types'

const tileUrl = import.meta.env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const fallback: [number, number] = [19.076, 72.8777]
type MapPayload = FeatureCollection & { location?: { latitude: number; longitude: number } }
function Recenter({ center }: { center: [number, number] }) { const map = useMap(); useEffect(() => { map.setView(center, 8, { animate: false }) }, [center, map]); return null }
function color(variable: Variable, value: number) {
  if (variable === 'rainfall') return value > 115 ? '#b91c1c' : value > 64 ? '#ea580c' : value >= 15.5 ? '#eab308' : '#208fc1'
  if (variable === 'temperature') return value >= 40 ? '#dc4b35' : value >= 32 ? '#ed9a3e' : '#2b88aa'
  return value >= 80 ? '#b91c1c' : value >= 60 ? '#ef7d32' : value >= 40 ? '#ddbd3c' : '#14897d'
}
export function WeatherMap({ selection, variable, model = 'blended', height = '420px' }: { selection: LocationSelection; variable: Variable; model?: string; height?: string }) {
  const [data, setData] = useState<MapPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let alive = true
    setLoading(true); setError('')
    getMap(selection, variable, model).then(result => { if (alive) setData(result as MapPayload) }).catch(reason => { if (alive) setError(reason?.response?.data?.detail || 'Map forecast could not be loaded') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [selection.region, selection.state, selection.district, selection.lead_hours, variable, model])
  if (loading && !data) return <div style={{ height }}><LoadingState label="Loading district map and forecast layer" /></div>
  if (error && !data) return <div style={{ height }}><ErrorState message={error} /></div>
  const coordinates = data?.features[0]?.geometry?.type === 'Polygon' ? data.features[0].geometry.coordinates[0] : data?.features[0]?.geometry?.type === 'MultiPolygon' ? data.features[0].geometry.coordinates[0][0] : null
  const center: [number, number] = coordinates?.length ? [coordinates.reduce((s, point) => s + point[1], 0) / coordinates.length, coordinates.reduce((s, point) => s + point[0], 0) / coordinates.length] : fallback
  const rawValue = data?.features[0]?.properties?.forecast_value
  const val = typeof rawValue === 'number' ? rawValue : Number.NaN
  const rawDirection = data?.features[0]?.properties?.wind_direction_deg
  const direction = typeof rawDirection === 'number' ? rawDirection : undefined
  const point = data?.location && Number.isFinite(data.location.latitude) && Number.isFinite(data.location.longitude) ? [data.location.latitude, data.location.longitude] as [number, number] : undefined
  return <div className="map-frame" style={{ height }}>
    <MapContainer center={center} zoom={7} scrollWheelZoom={false} className="leaflet-map">
      <Recenter center={center} />
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url={tileUrl} />
      {data ? <GeoJSON key={`${selection.state}-${selection.district}-${variable}`} data={data} style={() => ({ color: '#1b547c', weight: 1.4, fillColor: Number.isFinite(val) ? color(variable, val) : '#aebcc9', fillOpacity: Number.isFinite(val) ? 0.62 : 0.2 })} onEachFeature={(feature, layer) => { layer.bindPopup(`<strong>${feature.properties?.Name || selection.district}</strong><br/>${Number.isFinite(val) ? `${val.toFixed(1)} ${feature.properties?.unit}` : 'No forecast value'}`) }} /> : null}
      {point && variable === 'wind' && direction !== undefined ? <Marker position={point} icon={L.divIcon({ className: 'wind-arrow-icon', html: `<span style="transform:rotate(${direction}deg)">↑</span>`, iconSize: [28, 28], iconAnchor: [14, 14] })}><Popup>{selection.district}<br />Wind {val.toFixed(1)} km/h · {Math.round(direction)}°</Popup></Marker> : point ? <CircleMarker center={point} radius={5} pathOptions={{ color: '#fff', weight: 2, fillColor: '#123b5d', fillOpacity: 1 }}><Popup>{selection.district}<br />Geocoded representative point</Popup></CircleMarker> : null}
    </MapContainer>
    <div className="map-overlay"><span className="map-dot" /> {selection.district.toUpperCase()}, {selection.state.toUpperCase()}</div>
    {error ? <div className="map-notice">{error}</div> : null}
  </div>
}

export default WeatherMap
