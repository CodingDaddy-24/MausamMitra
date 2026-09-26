import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const colors = ['#1a5b9c', '#13897c', '#e49a30', '#7a5fb5', '#bd4a38']
export function SeriesChart({ data, keys, height = 300, unit = '' }: { data: Record<string, unknown>[]; keys: { key: string; label: string; color?: string; width?: number }[]; height?: number; unit?: string }) {
  return <div className="chart-wrap" style={{ height }}><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 18, left: -14, bottom: 0 }}><CartesianGrid stroke="#e6ebef" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="time" tick={{ fill: '#708091', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#d7dee5' }} minTickGap={30} /><YAxis tick={{ fill: '#708091', fontSize: 11 }} tickLine={false} axisLine={false} width={54} unit={unit} /><Tooltip contentStyle={{ border: '1px solid #d1d5db', borderRadius: 2, fontSize: 12 }} labelStyle={{ color: '#34495e', fontWeight: 700 }} formatter={(value: number, name: string) => [`${Number(value).toFixed(1)}${unit}`, name]} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />{keys.map((item, index) => <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color || colors[index % colors.length]} strokeWidth={item.width || (item.key === 'blended' ? 3 : 1.7)} dot={false} connectNulls={false} />)}</LineChart></ResponsiveContainer></div>
}

export function toSeriesData(rows: { time: string; rainfall_mm?: number | null; temperature_c?: number | null; wind_speed_kmh?: number | null }[], field: string) {
  return rows.map(row => ({ time: new Date(row.time).toLocaleString('en-IN', { day: '2-digit', hour: '2-digit', minute: undefined }), value: (row as Record<string, unknown>)[field] as number | null }))
}
