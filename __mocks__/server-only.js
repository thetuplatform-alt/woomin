// Jest 環境下 'server-only' 的 no-op 替身。
// 真正的套件（node_modules/server-only）import 就直接丟例外，靠 Next.js 的 bundler
// 在編譯階段把它換成適當版本（server 目標換成 no-op、client 目標保留丟例外）。
// Jest 沒有那層 bundler，所以用 moduleNameMapper（見 jest.config.cjs）換成這個檔案，
// 讓測試可以正常 import 標記 'server-only' 的模組。
module.exports = {}
