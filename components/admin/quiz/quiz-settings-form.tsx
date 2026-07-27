'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { QuizSettingsFormData } from '@/lib/validations/quiz'

interface QuizSettingsFormProps {
  settings: QuizSettingsFormData
  onChange: (settings: QuizSettingsFormData) => void
}

export function QuizSettingsForm({ settings, onChange }: QuizSettingsFormProps) {
  function update<K extends keyof QuizSettingsFormData>(
    key: K,
    value: QuizSettingsFormData[K]
  ) {
    onChange({ ...settings, [key]: value })
  }

  return (
    <div className="space-y-4">
      {/* 及格分數 + 時間限制 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="passingScore">
            及格分數 <span className="text-muted-foreground text-xs">（0–100）</span>
          </Label>
          <Input
            id="passingScore"
            type="number"
            min={0}
            max={100}
            value={settings.passingScore}
            onChange={(e) => update('passingScore', Number(e.target.value))}
            className="h-8"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timeLimitMinutes">
            時間限制 <span className="text-muted-foreground text-xs">（分鐘，0＝不限）</span>
          </Label>
          <Input
            id="timeLimitMinutes"
            type="number"
            min={0}
            value={settings.timeLimitMinutes ?? 0}
            onChange={(e) =>
              update(
                'timeLimitMinutes',
                e.target.value === '' ? null : Number(e.target.value)
              )
            }
            className="h-8"
          />
        </div>
      </div>

      <Separator />

      {/* 答案顯示策略 */}
      <div className="space-y-1.5">
        <Label htmlFor="showAnswers">答案顯示時機</Label>
        <Select
          value={settings.showAnswers}
          onValueChange={(v) =>
            update(
              'showAnswers',
              v as QuizSettingsFormData['showAnswers']
            )
          }
        >
          <SelectTrigger id="showAnswers" className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="IMMEDIATELY">送出後立即顯示</SelectItem>
            <SelectItem value="AFTER_PASS">通過測驗後顯示</SelectItem>
            <SelectItem value="NEVER">永不顯示</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Switch 群組 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">題目順序隨機</Label>
            <p className="text-muted-foreground text-xs mt-0.5">每次作答隨機打亂題目順序</p>
          </div>
          <Switch
            checked={settings.shuffleQuestions}
            onCheckedChange={(v) => update('shuffleQuestions', v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">選項順序隨機</Label>
            <p className="text-muted-foreground text-xs mt-0.5">每次作答隨機打亂選項順序</p>
          </div>
          <Switch
            checked={settings.shuffleOptions}
            onCheckedChange={(v) => update('shuffleOptions', v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">阻擋後續單元</Label>
            <p className="text-muted-foreground text-xs mt-0.5">學員需通過測驗才能繼續學習</p>
          </div>
          <Switch
            checked={settings.blockNextLesson}
            onCheckedChange={(v) => update('blockNextLesson', v)}
          />
        </div>
      </div>
    </div>
  )
}
