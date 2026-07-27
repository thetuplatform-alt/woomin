#!/usr/bin/env node
/* eslint-disable */
'use strict'

/**
 * 安全的 Prisma 部署封裝（取代裸 `prisma migrate deploy`）。
 *
 * 解決的問題
 * ──────────
 * 本平台是買斷原始碼、由各客戶自行部署。歷史上 onboarding 一律以 `prisma db push`
 * 建表，從不寫入 `_prisma_migrations`。當版本（如 v1.7）改用 `prisma migrate deploy`
 * 時，會對「schema 非空、但無 migration 歷史」的既有資料庫拋出 P3005，導致容器
 * 啟動即崩潰（crash-loop），整個升級失敗。
 *
 * 本封裝的行為
 * ────────────
 *  1. 已有 `_prisma_migrations`（曾走過 migrate）           → 直接 migrate deploy。
 *  2. 完全空的資料庫（全新安裝）                            → 直接 migrate deploy（套用全部）。
 *  3. 有資料表但無 migration 歷史（既有 db push 客戶）       → 自動 baseline 後再 deploy：
 *       - 逐一判斷每個 migration「是否其新增物件都已存在於現有資料庫」；
 *       - 已存在者以 `migrate resolve --applied` 標記為已套用（不執行其 SQL，僅補歷史）；
 *       - 其餘（真正新增的 migration）交給 `migrate deploy` 實際套用。
 *     如此既不重建既有資料表（避免 P3005 / 物件衝突），又能正確套上新版變更，且零資料異動。
 *
 * 設計限制
 * ────────
 *  - 必須是純 Node（standalone runner 內沒有 tsx / 完整 dev 依賴）。
 *  - 僅依賴 `pg`（introspection）與 Prisma CLI（baseline / deploy）。兩者在部署環境皆可用：
 *    Dockerfile 會把 `pg` 一併裝進隔離的 prisma CLI 目錄並以 NODE_PATH 提供。
 *  - 判斷「已套用」只看「新增性物件」（CREATE TABLE/TYPE/INDEX、ADD COLUMN、ADD ENUM VALUE）。
 *    純 DROP / ALTER CONSTRAINT 類 migration 沒有新增物件，視為「效果已反映於現有 schema」
 *    （db push 的 schema 即終態），標記為已套用 —— 這對 db push 客戶恆為正確。
 *
 * 此步驟只在「首次從 db push 切換到 migrate」時跑一次；之後 `_prisma_migrations` 已存在，
 * 後續所有部署都走單純的 migrate deploy。
 */

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const CWD = process.cwd()
const MIGRATIONS_DIR = path.join(CWD, 'prisma', 'migrations')
const SCHEMA_PATH = path.join(CWD, 'prisma', 'schema.prisma')
const DRY_RUN = process.argv.includes('--dry-run') || process.env.MIGRATE_DRY_RUN === '1'

function log(msg) {
  console.log(`[migrate-deploy] ${msg}`)
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  // 後備：與 prisma.config.ts 一致地載入 .env.local / .env
  try {
    const dotenv = require('dotenv')
    dotenv.config({ path: path.join(CWD, '.env.local') })
    dotenv.config({ path: path.join(CWD, '.env') })
  } catch (_) {
    /* dotenv 不可用時略過 */
  }
  return process.env.DATABASE_URL
}

function resolvePrismaInvocation() {
  // standalone runner 以 NODE_PATH 指向隔離的 prisma CLI；一般環境則在 node_modules。
  try {
    const cliPath = require.resolve('prisma/build/index.js')
    return { bin: process.execPath, baseArgs: [cliPath] }
  } catch (_) {
    return { bin: 'npx', baseArgs: ['prisma'] }
  }
}

const PRISMA = resolvePrismaInvocation()

function runPrisma(args, { capture = false } = {}) {
  const fullArgs = [...PRISMA.baseArgs, ...args]
  const res = spawnSync(PRISMA.bin, fullArgs, {
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: process.env,
    encoding: 'utf8',
  })
  return res
}

function migrateDeploy() {
  log('執行 prisma migrate deploy …')
  const res = runPrisma(['migrate', 'deploy', '--schema', SCHEMA_PATH])
  if (res.status !== 0) {
    log('migrate deploy 失敗')
    process.exit(res.status || 1)
  }
}

function listMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return []
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => fs.existsSync(path.join(MIGRATIONS_DIR, n, 'migration.sql')))
    .sort()
}

/**
 * 從 migration.sql 萃取「新增性物件」訊號。
 * 回傳 { tables, types, indexes, columns:[{table,column}], enumValues:[{type,value}] }
 */
function extractAdditiveSignals(sql) {
  const tables = []
  const types = []
  const indexes = []
  const columns = []
  const enumValues = []

  for (const m of sql.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+"([^"]+)"/gi)) {
    tables.push(m[1])
  }
  for (const m of sql.matchAll(/CREATE\s+TYPE\s+"([^"]+)"/gi)) {
    types.push(m[1])
  }
  for (const m of sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+"([^"]+)"/gi)) {
    indexes.push(m[1])
  }
  for (const m of sql.matchAll(/ALTER\s+TYPE\s+"([^"]+)"\s+ADD\s+VALUE(?:\s+IF\s+NOT\s+EXISTS)?\s+'([^']+)'/gi)) {
    enumValues.push({ type: m[1], value: m[2] })
  }
  // ALTER TABLE "T" ... ADD COLUMN [IF NOT EXISTS] "C" ...;（一個 ALTER TABLE 可帶多個 ADD COLUMN，直到分號）
  for (const block of sql.matchAll(/ALTER\s+TABLE\s+"([^"]+)"([\s\S]*?);/gi)) {
    const table = block[1]
    const body = block[2]
    for (const c of body.matchAll(/ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+"([^"]+)"/gi)) {
      columns.push({ table, column: c[1] })
    }
  }

  return { tables, types, indexes, columns, enumValues }
}

async function objectExists(client, sig, kind) {
  switch (kind) {
    case 'table': {
      const r = await client.query(`SELECT to_regclass($1) IS NOT NULL AS x`, [`public."${sig}"`])
      return r.rows[0].x === true
    }
    case 'type': {
      const r = await client.query(`SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = $1) AS x`, [sig])
      return r.rows[0].x === true
    }
    case 'index': {
      const r = await client.query(
        `SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1) AS x`,
        [sig]
      )
      return r.rows[0].x === true
    }
    case 'column': {
      const r = await client.query(
        `SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2) AS x`,
        [sig.table, sig.column]
      )
      return r.rows[0].x === true
    }
    case 'enumValue': {
      const r = await client.query(
        `SELECT EXISTS(
           SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
           WHERE t.typname = $1 AND e.enumlabel = $2
         ) AS x`,
        [sig.type, sig.value]
      )
      return r.rows[0].x === true
    }
    default:
      return false
  }
}

/**
 * 判斷某 migration 是否「已套用於現有 db push 資料庫」（→ baseline 跳過，不重跑其 SQL）。
 *
 * 不能用「所有新增物件都存在才算已套用」這種素樸規則，因為 migration lineage 內部會有
 * 「先建後刪 / 改名」的暫時性物件（例如 init 建了 Media_cfStreamId_idx，後續又移除；
 * 影片索引建了又刪），這些在 db push 終態的 schema 裡本來就不存在，會讓素樸規則把
 * 「其實已套用的舊 migration」誤判為待執行，重跑時 CREATE TABLE 既有表而崩潰。
 *
 * 改用分層規則（以「持久型物件」為主訊號，索引為輔）：
 *  1) 若 migration 建立了任何「持久型物件」（資料表 / 型別 / 欄位 / 列舉值）：
 *     只要其中任一已存在 → 視為舊的、已套用 → baseline。
 *     （舊 migration 的資料表/欄位/型別/列舉值幾乎都還在；全新 migration 的則全部不存在。
 *       索引在此情況忽略，以免被 lineage 內被刪過的暫時性索引干擾。）
 *  2) 否則（純索引 migration）：其建立的索引「全部」都存在才算已套用 → baseline。
 *     （舊的純索引 migration 索引已存在 → baseline；新的效能索引尚未建立 → 執行。
 *       新版索引 migration 皆為 CREATE INDEX IF NOT EXISTS，即使客戶手動加過部分索引亦可安全執行。）
 *  3) 否則（純 DROP / ALTER CONSTRAINT，無任何新增物件）：視為已套用 → baseline。
 *     （其效果在 db push 終態 schema 中本就已反映。）
 */
async function isAlreadyApplied(client, sql) {
  const sig = extractAdditiveSignals(sql)
  const durable = [
    ...sig.tables.map((t) => ['table', t]),
    ...sig.types.map((t) => ['type', t]),
    ...sig.columns.map((c) => ['column', c]),
    ...sig.enumValues.map((e) => ['enumValue', e]),
  ]

  if (durable.length > 0) {
    for (const [kind, s] of durable) {
      if (await objectExists(client, s, kind)) return true // 任一持久型物件已存在 → 已套用
    }
    return false // 全部持久型物件都不存在 → 尚未套用 → 實際執行
  }

  if (sig.indexes.length > 0) {
    for (const name of sig.indexes) {
      if (!(await objectExists(client, name, 'index'))) return false // 有索引尚未建立 → 執行
    }
    return true // 全部索引都已存在 → 已套用
  }

  return true // 無任何新增物件（純 DROP / ALTER CONSTRAINT）→ 已套用
}

async function main() {
  const url = resolveDatabaseUrl()
  if (!url) {
    log('找不到 DATABASE_URL，無法連線資料庫')
    process.exit(1)
  }
  process.env.DATABASE_URL = url // 確保 spawn 出的 prisma 子行程也讀得到

  const { Client } = require('pg')
  const client = new Client({ connectionString: url })
  await client.connect()

  let plan
  try {
    const hasHistory = (
      await client.query(`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS x`)
    ).rows[0].x === true

    if (hasHistory) {
      log('偵測到既有 _prisma_migrations 歷史 → 直接 migrate deploy')
      plan = { mode: 'deploy' }
    } else {
      const tableCount = parseInt(
        (
          await client.query(
            `SELECT count(*)::int AS c FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
               AND table_name <> '_prisma_migrations'`
          )
        ).rows[0].c,
        10
      )

      if (tableCount === 0) {
        log('資料庫為空（全新安裝）→ migrate deploy 套用全部 migration')
        plan = { mode: 'deploy' }
      } else {
        log(`偵測到既有資料庫（${tableCount} 張表）但無 migration 歷史 → 自動 baseline`)
        const migrations = listMigrations()
        const toBaseline = []
        const toRun = []
        for (const name of migrations) {
          const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8')
          if (await isAlreadyApplied(client, sql)) toBaseline.push(name)
          else toRun.push(name)
        }
        plan = { mode: 'baseline', toBaseline, toRun }
      }
    }
  } finally {
    await client.end()
  }

  if (plan.mode === 'deploy') {
    if (DRY_RUN) {
      log('[dry-run] 將執行：migrate deploy')
      return
    }
    return migrateDeploy()
  }

  // baseline 模式
  log(`baseline 計畫：標記 ${plan.toBaseline.length} 個為已套用、實際套用 ${plan.toRun.length} 個`)
  for (const n of plan.toBaseline) log(`  · baseline（跳過執行）${n}`)
  for (const n of plan.toRun) log(`  ▶ 待套用（實際執行）${n}`)

  if (DRY_RUN) {
    log('[dry-run] 僅輸出計畫，未實際變更資料庫')
    return
  }

  for (const name of plan.toBaseline) {
    const res = runPrisma(['migrate', 'resolve', '--applied', name, '--schema', SCHEMA_PATH], { capture: true })
    if (res.status !== 0) {
      log(`baseline 失敗：${name}`)
      if (res.stderr) process.stderr.write(res.stderr)
      process.exit(res.status || 1)
    }
  }
  log('baseline 完成，套用剩餘 migration …')
  migrateDeploy()
}

main().catch((err) => {
  log('發生未預期錯誤：')
  console.error(err)
  process.exit(1)
})
