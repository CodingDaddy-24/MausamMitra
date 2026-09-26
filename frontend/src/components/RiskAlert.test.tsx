import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RiskAlert, highestRisk } from './RiskAlert'
import type { Risk } from '../types'

const risks: Risk[] = [
  { parameter: 'rainfall', severity: 'YELLOW', value: 23, unit: 'mm / 24h', message: 'Yellow threshold reached.' },
  { parameter: 'wind', severity: 'RED', value: 82, unit: 'km/h', message: 'Red threshold reached.' },
]
describe('risk alert', () => {
  it('selects and displays the highest backend severity', () => {
    expect(highestRisk(risks)?.severity).toBe('RED')
    render(<RiskAlert risks={risks} />)
    expect(screen.getByRole('alert')).toHaveTextContent('RED')
    expect(screen.getByRole('alert')).toHaveTextContent('82 km/h')
  })
  it('shows the normal state for no exceedance', () => {
    render(<RiskAlert risks={[{ parameter: 'rainfall', severity: 'NORMAL', value: 0, unit: 'mm / 24h', message: 'No exceedance.' }]} />)
    expect(screen.getByRole('status')).toHaveTextContent('NORMAL')
  })
})
