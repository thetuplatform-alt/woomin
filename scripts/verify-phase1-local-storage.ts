import assert from 'node:assert/strict'

async function main() {
  process.env.LOCAL_STORAGE_ROOT ||= '/tmp/realms-phase1-local-storage'

  const {
    writeLocalUpload,
    readLocalStorageObject,
    deleteStorageObject,
    getPublicUrlForStorageKey,
    getStorageObjectRefFromUrl,
  } = await import('../lib/storage')

  const key = `media/phase1-verify-${Date.now()}.txt`
  const buffer = Buffer.from('phase1-local-storage-test')

  try {
    const writeResult = await writeLocalUpload(key, buffer)
    assert.equal(writeResult.success, true, 'local write should succeed')

    const readResult = await readLocalStorageObject(key)
    assert.equal(readResult.success, true, 'local read should succeed')
    assert.equal(
      readResult.buffer?.toString(),
      buffer.toString(),
      'read buffer should match written buffer'
    )

    const url = await getPublicUrlForStorageKey(key)
    assert.equal(url, `/uploads/${key}`, 'local URL should use /uploads prefix')

    const storageRef = await getStorageObjectRefFromUrl(url)
    assert.deepEqual(storageRef, { driver: 'local', key }, 'URL should map back to local storage ref')

    const deleteResult = await deleteStorageObject(key, 'local')
    assert.equal(deleteResult.success, true, 'local delete should succeed')

    const deletedRead = await readLocalStorageObject(key)
    assert.equal(deletedRead.success, false, 'deleted file should no longer be readable')

    console.log('Phase 1 local storage helper verification passed')
  } finally {
    await deleteStorageObject(key, 'local')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
