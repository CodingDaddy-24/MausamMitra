import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import type { Risk } from '../types'

const order = { NORMAL: 0, YELLOW: 1, ORANGE: 2, RED: 3 }
export function highestRisk(risks: Risk[]): Risk | undefined { return [...risks].sort((a, b) => order[b.severity] - order[a.severity])[0] }
export function RiskAlert({ risks }: { risks: Risk[] }) {
  const risk = highestRisk(risks)
  if (!risk || risk.severity === 'NORMAL') return <div role="status" className="alert-bar normal"><CheckCircle2 size={17} /><strong>NORMAL</strong><span>No significant threshold exceedance detected.</span></div>
  const Icon = risk.severity === 'RED' ? ShieldAlert : AlertTriangle
  return <div role="alert" className={`alert-bar ${risk.severity.toLowerCase()}`}><Icon size={18} /><strong>{risk.severity}</strong><span>{risk.message}</span><span className="alert-reading">{risk.value} {risk.unit}</span></div>
}
