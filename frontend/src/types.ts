export type LeadHours = 24 | 48 | 72
export type Variable = 'rainfall' | 'temperature' | 'wind'
export type LocationSelection = { region: string; state: string; district: string; lead_hours: LeadHours }
export type Risk = { parameter: string; severity: 'NORMAL' | 'YELLOW' | 'ORANGE' | 'RED'; value: number; unit: string; message: string }
export type HourlyPoint = { time: string; rainfall_mm: number | null; temperature_c: number | null; wind_speed_kmh: number | null; wind_direction_deg: number | null }
export type Provider = { provider: string; label: string; available: boolean; error: string | null; run_time: string | null; hourly: HourlyPoint[] }
export type Forecast = {
  location: { name: string; district: string; state: string; country: string; latitude: number; longitude: number; timezone: string }
  lead_hours: number; generated_at: string; source_run: string | null; blend_method: string; weighting_note: string
  providers: Provider[]; blended_hourly: HourlyPoint[]; summary: { rainfall_mm: number | null; temperature_c: number | null; wind_speed_kmh: number | null; wind_direction_deg: number | null; from: string | null; to: string | null }
  current?: { time: string | null; temperature_c: number | null; rainfall_mm: number | null; relative_humidity_percent: number | null; apparent_temperature_c: number | null; wind_speed_kmh: number | null; wind_direction_deg: number | null; wind_gusts_kmh: number | null; cloud_cover_percent: number | null } | null
  weights: Record<string, number>; variable_weights: Record<string, Record<string, number>>; risks: Risk[]
}
export type ModelMetric = { provider: string; mae: number; rmse: number; correlation: number | null; bias: number | null; sample_count: number; reference: string; updated_at: string }
