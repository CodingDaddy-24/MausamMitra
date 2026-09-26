import { CloudRain, Thermometer, Wind } from 'lucide-react'
import type { Forecast } from '../types'

function Card({ title, value, unit, icon: Icon, tone, detail }: { title: string; value: string; unit: string; icon: typeof CloudRain; tone: string; detail: string }) {
  return <article className="forecast-card"><div className={`metric-icon ${tone}`}><Icon size={17} /></div><div className="metric-heading">{title}<span className="metric-scope">SELECTED LEAD</span></div><div className="metric-value">{value}<span>{unit}</span></div><div className="metric-detail">{detail}</div></article>
}
export function ForecastCards({ forecast, loading }: { forecast: Forecast | null; loading: boolean }) {
  const summary = forecast?.summary
  const direction = summary?.wind_direction_deg == null ? '—' : `${Math.round(summary.wind_direction_deg)}°`
  if (loading && !forecast) return <div className="forecast-grid">{[1, 2, 3].map(key => <div className="forecast-card skeleton-card" key={key}><div className="skeleton-line short" /><div className="skeleton-line value" /><div className="skeleton-line" /></div>)}</div>
  return <div className="forecast-grid">
    <Card title="RAINFALL ACCUMULATION" value={summary?.rainfall_mm == null ? '—' : summary.rainfall_mm.toFixed(1)} unit="mm" icon={CloudRain} tone="blue" detail={`${forecast?.lead_hours || 24} hour total`} />
    <Card title="MAX AIR TEMPERATURE" value={summary?.temperature_c == null ? '—' : summary.temperature_c.toFixed(1)} unit="°C" icon={Thermometer} tone="amber" detail="2 m above surface · period maximum" />
    <Card title="PEAK WIND" value={summary?.wind_speed_kmh == null ? '—' : summary.wind_speed_kmh.toFixed(1)} unit="km/h" icon={Wind} tone="teal" detail={`10 m height · direction ${direction}`} />
  </div>
}
