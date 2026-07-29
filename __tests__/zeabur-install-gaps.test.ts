import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('Zeabur 安裝契約', () => {
  test('Docker builder 在 next build 前宣告 APP_URL build-time 變數', () => {
    const dockerfile = read('Dockerfile')
    const buildIndex = dockerfile.indexOf('RUN pnpm exec next build')

    expect(dockerfile.slice(0, buildIndex)).toContain('ARG APP_URL')
    expect(dockerfile.slice(0, buildIndex)).toContain('ARG NEXT_PUBLIC_APP_URL')
    expect(dockerfile.slice(0, buildIndex)).toContain('ENV APP_URL=$APP_URL')
    expect(dockerfile.slice(0, buildIndex)).toContain(
      'ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL'
    )
  })

  test('build script 不會在建置期連資料庫或同步設定', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      scripts: { build: string }
    }

    expect(packageJson.scripts.build).toBe('prisma generate && next build')
    expect(packageJson.scripts.build).not.toContain('migrate')
    expect(packageJson.scripts.build).not.toContain('sync-')
  })

  test('排程 worker 覆蓋六支 cron route', () => {
    const worker = read('deploy/cron-worker/worker.sh')
    for (const route of [
      'course-expiration',
      'subscription-maintenance',
      'newsletter-dispatch',
      'assignment-cleanup',
      'cloudflare-stream-sync',
      'newsletter-automation-dispatch',
    ]) {
      expect(worker).toContain(route)
    }
  })

  test('Docker builder 在 APP_URL 未設定時會印出明顯警告', () => {
    const dockerfile = read('Dockerfile')
    const buildIndex = dockerfile.indexOf('RUN pnpm exec next build')
    const builder = dockerfile.slice(0, buildIndex)

    expect(builder).toContain('APP_URL 未設定')
    expect(builder).toContain('NEXT_PUBLIC_APP_URL 未設定')
  })

  test('systemd 安裝會啟用 linger，非 systemd 安裝提供 launchd 設定', () => {
    const installer = read('deploy/cron-worker/install.sh')
    const readme = read('README.md')

    expect(installer).toContain('loginctl enable-linger')
    expect(installer).toContain('command -v loginctl')
    expect(readme).toContain('launchd')
    expect(readme).toContain('LaunchAgents')
    expect(readme).toContain('launchctl load')
  })

  test('setup page 不把 Cloudflare 密鑰放進 client props', () => {
    const page = read('app/(setup)/admin/setup/page.tsx')
    const client = read('app/(setup)/admin/setup/setup-client.tsx')

    expect(page).not.toContain('cloudflareApiToken: cloudflareStream.apiToken')
    expect(page).not.toContain('cloudflareStreamSigningSecret: cloudflareStream.signingSecret')
    expect(page).not.toContain('cloudflareStreamWebhookSecret: cloudflareStream.webhookSecret')
    expect(client).toContain('hasCloudflareStreamEnv')
    expect(client).not.toContain('detectedDefaults.cloudflareApiToken')
    expect(client).not.toContain('detectedDefaults.cloudflareStreamSigningSecret')
    expect(client).not.toContain('detectedDefaults.cloudflareStreamWebhookSecret')
  })

  test('worker 動態迴圈會呼叫六支 route 並帶 Authorization', async () => {
    const routes: string[] = []
    const server = http.createServer((request, response) => {
      routes.push(`${request.url}|${request.headers.authorization}`)
      response.writeHead(200)
      response.end('ok')
    })

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('找不到測試伺服器埠號')

    const worker = spawn('sh', ['deploy/cron-worker/worker.sh'], {
      cwd: root,
      env: {
        ...process.env,
        APP_URL: `http://127.0.0.1:${address.port}`,
        CRON_SECRET: 'test-secret',
        INTERVAL_SECONDS: '1',
        COURSE_EXPIRATION_INTERVAL_SECONDS: '1',
        SUBSCRIPTION_MAINTENANCE_INTERVAL_SECONDS: '1',
      },
      stdio: 'ignore',
    })

    await new Promise((resolve) => setTimeout(resolve, 1800))
    worker.kill('SIGTERM')
    await new Promise<void>((resolve) => {
      if (worker.exitCode !== null) return resolve()
      worker.once('exit', () => resolve())
    })
    await new Promise<void>((resolve) => server.close(() => resolve()))

    for (const route of [
      'course-expiration',
      'subscription-maintenance',
      'newsletter-dispatch',
      'assignment-cleanup',
      'cloudflare-stream-sync',
      'newsletter-automation-dispatch',
    ]) {
      expect(routes).toContain(`/api/cron/${route}|Bearer test-secret`)
    }
  }, 10000)
})
