'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ArrowLeft, Clock3, Mail, Plus, Save, Trash2 } from 'lucide-react'
import type { getNewsletterAutomation, getNewsletterAutomationEditorOptions } from '@/lib/actions/newsletter-automations'
import { createNewsletterAutomation, updateNewsletterAutomation } from '@/lib/actions/newsletter-automations'
import {
  getNextStepIdAfterRemoval,
  resolveSelectedStepId,
} from '@/components/admin/newsletter/automation-step-selection'
import type { NewsletterContent } from '@/lib/newsletter/types'
import { Button } from '@/components/ui/button'

const BlockNoteNewsletterComposer = dynamic(
  () => import('@/components/admin/newsletter/blocknote-newsletter-composer').then((mod) => mod.BlockNoteNewsletterComposer),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border bg-white p-6 text-sm text-muted-foreground">
        正在載入編輯器...
      </div>
    ),
  }
)

type Automation = Awaited<ReturnType<typeof getNewsletterAutomation>>
type Options = Awaited<ReturnType<typeof getNewsletterAutomationEditorOptions>>

type DraftStep = {
  localId: string
  id?: string
  subjectTemplate: string
  delayDays: number
  delayHours: number
  enabled: boolean
  contentJson: NewsletterContent
}

function emptyContent(): NewsletterContent {
  return {
    blocks: [{ id: crypto.randomUUID(), type: 'paragraph', text: '' }],
  }
}

function normalizeContent(input: unknown): NewsletterContent {
  if (!input || typeof input !== 'object') return { blocks: [] }
  const candidate = input as Partial<NewsletterContent>
  return {
    meta: candidate.meta,
    blocks: Array.isArray(candidate.blocks) ? candidate.blocks : [],
  }
}

function newStep(): DraftStep {
  return {
    localId: crypto.randomUUID(),
    subjectTemplate: '歡迎加入課程',
    delayDays: 0,
    delayHours: 0,
    enabled: true,
    contentJson: emptyContent(),
  }
}

function normalizeOptions(options: Options) {
  return {
    courses: options.courses,
    coupons: options.coupons.map((coupon) => ({
      ...coupon,
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString() : null,
    })),
  }
}

function formatDelay(delayDays: number, delayHours: number) {
  if (delayDays === 0 && delayHours === 0) return '立即寄出'

  const parts = []
  if (delayDays > 0) parts.push(`${delayDays} 天`)
  if (delayHours > 0) parts.push(`${delayHours} 小時`)
  return `${parts.join(' ')}後寄出`
}

export function NewsletterAutomationEditor({
  automation,
  options,
}: {
  automation?: Automation | null
  options: Options
}) {
  const router = useRouter()
  const normalizedOptions = useMemo(() => normalizeOptions(options), [options])
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(automation?.name ?? '新購課後跟進流程')
  const [courseId, setCourseId] = useState(automation?.courseId ?? options.courses[0]?.id ?? '')
  const [enabled, setEnabled] = useState(automation?.enabled ?? false)
  const [steps, setSteps] = useState<DraftStep[]>(() => {
    if (!automation?.steps.length) return [newStep()]
    return automation.steps.map((step) => ({
      localId: step.id,
      id: step.id,
      subjectTemplate: step.subjectTemplate,
      delayDays: step.delayDays,
      delayHours: step.delayHours,
      enabled: step.enabled,
      contentJson: normalizeContent(step.contentJson),
    }))
  })
  const [selectedStepId, setSelectedStepId] = useState<string | null>(() => {
    if (!automation?.steps.length) return null
    return automation.steps[0]?.id ?? null
  })
  const activeStepId = resolveSelectedStepId(steps, selectedStepId)
  const activeStep = steps.find((step) => step.localId === activeStepId) ?? steps[0]
  const activeStepIndex = activeStep
    ? steps.findIndex((step) => step.localId === activeStep.localId)
    : -1
  const activeSubjectLength = activeStep?.subjectTemplate.length ?? 0
  const subjectState =
    activeSubjectLength > 70
      ? 'text-red-600'
      : activeSubjectLength > 50
        ? 'text-amber-600'
        : 'text-muted-foreground'

  function updateStep(localId: string, patch: Partial<DraftStep>) {
    setSteps((current) =>
      current.map((step) =>
        step.localId === localId ? { ...step, ...patch } : step
      )
    )
  }

  function removeStep(localId: string) {
    setSteps((current) => {
      if (current.length === 1) return current
      setSelectedStepId(getNextStepIdAfterRemoval(current, localId, activeStepId))
      return current.filter((step) => step.localId !== localId)
    })
  }

  function addStep() {
    const step = newStep()
    setSteps((current) => [...current, step])
    setSelectedStepId(step.localId)
  }

  function handleSave() {
    startTransition(async () => {
      const payload = {
        name,
        courseId,
        enabled,
        steps: steps.map((step) => ({
          id: step.id,
          subjectTemplate: step.subjectTemplate,
          delayDays: step.delayDays,
          delayHours: step.delayHours,
          enabled: step.enabled,
          contentJson: step.contentJson,
        })),
      }
      const result = automation?.id
        ? await updateNewsletterAutomation(automation.id, payload)
        : await createNewsletterAutomation(payload)

      if (result.success && result.data) {
        router.push(`/admin/newsletters/automations/${result.data.id}/edit`)
        router.refresh()
      } else {
        alert(result.error || '儲存失敗。')
      }
    })
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-20 -mx-6 flex h-14 items-center justify-between border-b bg-white px-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon-sm" asChild>
            <Link href="/admin/newsletters/automations" aria-label="返回列表">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <input
              className="h-9 w-72 border-0 bg-transparent px-0 text-base font-semibold shadow-none outline-none"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="流程名稱"
            />
          </div>
        </div>
        <Button variant="cta" onClick={handleSave} disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? '儲存中' : '儲存'}
        </Button>
      </div>

      <div className="-mx-6 grid min-h-[calc(100vh-3.5rem)] grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="border-r px-5 py-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="automation-course">綁定課程</label>
            <select
              id="automation-course"
              className="mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              {options.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
            </div>

            <label className="flex items-center justify-between rounded-lg border bg-white p-3 text-sm font-medium text-foreground">
              <span>啟用流程</span>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
            </label>

            <div className="flex items-center justify-between border-t pt-5">
              <h2 className="text-sm font-semibold text-foreground">流程信件</h2>
              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="h-4 w-4" />
                新增
              </Button>
            </div>

            <div className="space-y-2">
              {steps.map((step, index) => {
                const isActive = step.localId === activeStep?.localId

                return (
                  <button
                    key={step.localId}
                    type="button"
                    className={`w-full rounded-lg border bg-white p-3 text-left transition ${
                      isActive ? 'border-primary shadow-sm ring-1 ring-primary/20' : 'hover:border-primary/40'
                    }`}
                    onClick={() => setSelectedStepId(step.localId)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Mail className="h-4 w-4 shrink-0" />
                          <span>第 {index + 1} 封信</span>
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {step.subjectTemplate || '未命名主旨'}
                        </p>
                      </div>
                      {!step.enabled && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          停用
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDelay(step.delayDays, step.delayHours)}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        <main className="mx-auto w-full max-w-[760px] px-10 py-12">
          {activeStep && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                第 {activeStepIndex + 1} 封信
              </p>
              <input
                className="mt-3 h-auto w-full border-0 px-0 text-5xl font-extrabold leading-tight tracking-normal text-foreground shadow-none outline-none"
                value={activeStep.subjectTemplate}
                onChange={(event) => updateStep(activeStep.localId, { subjectTemplate: event.target.value })}
                placeholder="輸入電子郵件主旨"
                aria-label="電子郵件主旨"
              />
              <p className={`mt-2 text-xs ${subjectState}`}>
                {activeSubjectLength} 字，建議 50 字內，超過 70 字會過長。
              </p>

              <div className="mt-8">
                <BlockNoteNewsletterComposer
                  key={activeStep.localId}
                  content={activeStep.contentJson}
                  courses={normalizedOptions.courses}
                  coupons={normalizedOptions.coupons}
                  onChange={(content) => updateStep(activeStep.localId, { contentJson: content })}
                />
              </div>
            </div>
          )}
        </main>

        <aside className="space-y-6 border-l px-6 py-6">
          {activeStep && (
            <>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">這封信的設定</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">延遲天數</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                      value={activeStep.delayDays}
                      onChange={(event) => updateStep(activeStep.localId, { delayDays: Number(event.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">延遲小時</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                      value={activeStep.delayHours}
                      onChange={(event) => updateStep(activeStep.localId, { delayHours: Number(event.target.value) })}
                    />
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  <Clock3 className="mr-2 inline h-4 w-4" />
                  {formatDelay(activeStep.delayDays, activeStep.delayHours)}
                </div>
              </section>

              <section className="space-y-3 border-t pt-6">
                <h3 className="text-sm font-semibold text-foreground">狀態</h3>
                <label className="flex items-center justify-between rounded-lg border bg-white p-3 text-sm text-muted-foreground">
                  <span>啟用這封信</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={activeStep.enabled}
                      onChange={(event) => updateStep(activeStep.localId, { enabled: event.target.checked })}
                    />
                </label>
                <Button
                  variant="outline"
                  className="w-full justify-center text-red-600 hover:text-red-700"
                  onClick={() => removeStep(activeStep.localId)}
                  disabled={steps.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                  刪除這封信
                </Button>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
