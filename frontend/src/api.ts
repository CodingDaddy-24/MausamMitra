import axios from 'axios'
import type { Forecast, LocationSelection, ModelMetric, Variable } from './types'

const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin)
export const api = axios.create({ baseURL: apiBaseUrl, timeout: 45_000 })
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) return error.response?.data?.detail || (error.code === 'ECONNABORTED' ? 'The weather service timed out. Try again.' : 'Could not reach the MausamMitra API. Check that the backend is running.')
  return 'Something went wrong. Please try again.'
}
export async function getRegions() { return (await api.get<{ regions: string[] }>('/api/locations/regions')).data.regions }
export async function getStates(region: string) { return (await api.get<{ states: string[] }>('/api/locations/states', { params: { region } })).data.states }
export async function getDistricts(state: string) { return (await api.get<{ districts: string[] }>('/api/locations/districts', { params: { state } })).data.districts }
export async function getForecast(selection: LocationSelection) { return (await api.post<Forecast>('/api/forecast', selection)).data }
export async function getMap(selection: LocationSelection, variable: Variable, model = 'blended') { return (await api.get('/api/map', { params: { ...selection, variable, model } })).data }
export async function getMapBoundaries(level: 'states' | 'districts', state?: string) { return (await api.get('/api/map/boundaries', { params: { level, ...(state ? { state } : {}) } })).data }
export async function getModelComparison(selection: LocationSelection, variable: Variable) { return (await api.get<{ providers: Forecast['providers']; blended_hourly: Forecast['blended_hourly']; metrics: ModelMetric[]; metrics_available: boolean }>('/api/model-comparison', { params: { ...selection, variable } })).data }
export async function getHistorical(selection: LocationSelection) { return (await api.get('/api/historical', { params: { state: selection.state, district: selection.district, days: 14 } })).data }
export async function getExtremeWeather(selection: LocationSelection) { return (await api.get('/api/extreme-weather', { params: selection })).data }
