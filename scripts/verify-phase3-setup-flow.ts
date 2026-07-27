import assert from 'node:assert/strict'
import { setupFormSchema } from '../lib/setup-config'

function main() {
  const minimal = setupFormSchema.parse({
    videoProvider: 'youtube',
    storageDriver: 'local',
    localStorageRoot: '/data/uploads',
    emailMode: 'skip',
    googleMode: 'skip',
    appleMode: 'skip',
  })

  assert.equal(minimal.videoProvider, 'youtube')
  assert.equal(minimal.emailMode, 'skip')
  assert.equal(minimal.googleMode, 'skip')
  assert.equal(minimal.appleMode, 'skip')
  assert.equal(minimal.storageDriver, 'local')

  const smtpEnabled = setupFormSchema.parse({
    videoProvider: 'cloudflare',
    cloudflareAccountId: 'account',
    cloudflareApiToken: 'token',
    cloudflareStreamCustomerCode: 'customer',
    storageDriver: 'local',
    localStorageRoot: '/data/uploads',
    emailMode: 'smtp',
    emailSenderName: 'Course Realms',
    emailFrom: 'hello@example.com',
    smtpHost: 'smtp.example.com',
    smtpPort: '587',
    googleMode: 'skip',
    appleMode: 'skip',
  })

  assert.equal(smtpEnabled.emailMode, 'smtp')
  assert.equal(smtpEnabled.smtpHost, 'smtp.example.com')
  assert.equal(smtpEnabled.videoProvider, 'cloudflare')

  const s3Minimal = setupFormSchema.parse({
    videoProvider: 'youtube',
    storageDriver: 's3',
    localStorageRoot: '',
    emailMode: 'skip',
    googleMode: 'skip',
    appleMode: 'skip',
  })

  assert.equal(s3Minimal.storageDriver, 's3')
  assert.equal(s3Minimal.localStorageRoot, '')

  assert.throws(
    () =>
      setupFormSchema.parse({
        videoProvider: 'youtube',
        storageDriver: 'local',
        localStorageRoot: '/data/uploads',
        emailMode: 'smtp',
        googleMode: 'skip',
        appleMode: 'skip',
      }),
    /Email|SMTP/
  )

  assert.throws(
    () =>
      setupFormSchema.parse({
        videoProvider: 'youtube',
        storageDriver: 'local',
        localStorageRoot: '/data/uploads',
        emailMode: 'skip',
        googleMode: 'enable',
        appleMode: 'skip',
      }),
    /Google/
  )

  assert.throws(
    () =>
      setupFormSchema.parse({
        videoProvider: 'youtube',
        storageDriver: 'local',
        localStorageRoot: '/data/uploads',
        emailMode: 'skip',
        googleMode: 'skip',
        appleMode: 'enable',
      }),
    /Apple/
  )

  assert.throws(
    () =>
      setupFormSchema.parse({
        videoProvider: 'cloudflare',
        storageDriver: 'local',
        localStorageRoot: '/data/uploads',
        emailMode: 'skip',
        googleMode: 'skip',
        appleMode: 'skip',
      }),
    /Cloudflare Stream/
  )

  console.log('Phase 3 setup flow verification passed')
}

main()
