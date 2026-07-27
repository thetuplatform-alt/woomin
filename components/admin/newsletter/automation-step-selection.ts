export type AutomationStepListItem = {
  localId: string
}

export function resolveSelectedStepId<TStep extends AutomationStepListItem>(
  steps: TStep[],
  selectedStepId: string | null
) {
  if (steps.length === 0) return null
  if (selectedStepId && steps.some((step) => step.localId === selectedStepId)) {
    return selectedStepId
  }
  return steps[0].localId
}

export function getNextStepIdAfterRemoval<TStep extends AutomationStepListItem>(
  steps: TStep[],
  removedStepId: string,
  selectedStepId: string | null
) {
  const remainingSteps = steps.filter((step) => step.localId !== removedStepId)
  if (remainingSteps.length === 0) return null

  if (
    selectedStepId !== removedStepId &&
    selectedStepId &&
    remainingSteps.some((step) => step.localId === selectedStepId)
  ) {
    return selectedStepId
  }

  const removedIndex = steps.findIndex((step) => step.localId === removedStepId)
  const nextIndex = Math.min(Math.max(removedIndex, 0), remainingSteps.length - 1)
  return remainingSteps[nextIndex].localId
}
