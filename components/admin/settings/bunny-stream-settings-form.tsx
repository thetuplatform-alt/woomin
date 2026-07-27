'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { getBunnyStreamSettings, testBunnyStreamConnection, updateBunnyStreamSettings } from '@/lib/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface BunnyStreamSettingsViewData {
  libraryId: string
  apiKeyHint: string
  readOnlyApiKeyHint: string
  isConfigured: boolean
}

export function BunnyStreamSettingsForm({ initialData }: { initialData: BunnyStreamSettingsViewData }) {
  const [viewData, setViewData] = useState(initialData)
  const [libraryId, setLibraryId] = useState(initialData.libraryId)
  const [apiKey, setApiKey] = useState(initialData.apiKeyHint)
  const [readOnlyApiKey, setReadOnlyApiKey] = useState(initialData.readOnlyApiKeyHint)
  const [isPending, startTransition] = useTransition()
  const [isTesting, setIsTesting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    setViewData(initialData)
    setLibraryId(initialData.libraryId)
    setApiKey(initialData.apiKeyHint)
    setReadOnlyApiKey(initialData.readOnlyApiKeyHint)
  }, [initialData])

  async function handleTest() {
    setIsTesting(true)
    const next = await testBunnyStreamConnection({ libraryId, apiKey })
    setResult(next)
    next.success ? toast.success(next.message) : toast.error(next.message)
    setIsTesting(false)
  }

  function handleSubmit() {
    startTransition(async () => {
      const saved = await updateBunnyStreamSettings({
        libraryId,
        apiKey,
        apiKeyTouched: apiKey !== viewData.apiKeyHint,
        readOnlyApiKey,
        readOnlyApiKeyTouched: readOnlyApiKey !== viewData.readOnlyApiKeyHint,
      })
      if (!saved.success) {
        toast.error(saved.error || 'Bunny Stream 設定儲存失敗')
        return
      }
      const latest = await getBunnyStreamSettings()
      setViewData(latest)
      setLibraryId(latest.libraryId)
      setApiKey(latest.apiKeyHint)
      setReadOnlyApiKey(latest.readOnlyApiKeyHint)
      toast.success('Bunny Stream 設定已更新')
    })
  }

  return (
    <div className="space-y-4">
      <div><Label htmlFor="bunny-library-id">Library ID</Label><Input id="bunny-library-id" value={libraryId} onChange={(event) => setLibraryId(event.target.value)} /></div>
      <div><Label htmlFor="bunny-api-key">Library API Key</Label><Input id="bunny-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></div>
      <div><Label htmlFor="bunny-read-only-api-key">Read-Only API Key</Label><Input id="bunny-read-only-api-key" type="password" value={readOnlyApiKey} onChange={(event) => setReadOnlyApiKey(event.target.value)} /></div>
      {result && <p className={result.success ? 'text-sm text-green-600' : 'text-sm text-red-600'}>{result.message}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={handleTest} disabled={isTesting || isPending}>{isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}測試連線</Button>
        <Button type="button" onClick={handleSubmit} disabled={isPending || isTesting}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}儲存設定</Button>
      </div>
    </div>
  )
}
