import {
  getNextStepIdAfterRemoval,
  resolveSelectedStepId,
} from '@/components/admin/newsletter/automation-step-selection'

const steps = [
  { localId: 'email-1' },
  { localId: 'email-2' },
  { localId: 'email-3' },
]

describe('automation step selection', () => {
  it('keeps every email step selectable by a stable local id', () => {
    expect(resolveSelectedStepId(steps, 'email-2')).toBe('email-2')
    expect(resolveSelectedStepId(steps, 'missing')).toBe('email-1')
    expect(resolveSelectedStepId([], 'email-1')).toBeNull()
  })

  it('moves selection to the next independent email when deleting the active one', () => {
    expect(getNextStepIdAfterRemoval(steps, 'email-2', 'email-2')).toBe('email-3')
    expect(getNextStepIdAfterRemoval(steps, 'email-3', 'email-3')).toBe('email-2')
  })

  it('keeps the current email selected when deleting another email', () => {
    expect(getNextStepIdAfterRemoval(steps, 'email-1', 'email-3')).toBe('email-3')
  })
})
