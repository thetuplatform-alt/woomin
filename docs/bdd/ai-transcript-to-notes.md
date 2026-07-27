# AI 影片/字幕轉講義功能 — BDD 規格

## 概述
讓課程管理者能透過 Gemini AI 模型，將影片或字幕檔（SRT）自動轉化為結構化的文字講義，插入到單元的 Markdown 編輯器中。講義包含時間戳錨點，讓學員可以直接跳轉到影片對應位置。此功能需要先在系統設定中配置 Gemini API Key。

## 行為規格

### 場景 1：系統設定中新增 AI 模型設定區塊
**Given** 管理員進入系統設定頁面（`/admin/settings`）
**When**  頁面載入完成
**Then**  設定頁面側邊欄新增「AI 模型」導覽項目
**And**   AI 模型設定區塊包含「Gemini API Key」欄位和「Gemini 模型」選擇欄位
**And**   API Key 欄位旁顯示引導文字，告知用戶可在 `https://aistudio.google.com/api-keys` 申請

### 場景 2：儲存 Gemini API Key
**Given** 管理員在 AI 模型設定區塊填入有效的 Gemini API Key
**When**  點擊儲存按鈕
**Then**  API Key 被儲存到資料庫（SiteSetting key-value）
**And**   已儲存的 API Key 以遮蔽形式顯示（如 `AIza...xY9z`）

### 場景 3：單元編輯器顯示「AI 生成講義」按鈕
**Given** 管理員在課程內容頁選中一個單元
**When**  查看單元內容編輯區域
**Then**  在「單元內容」標題旁（編輯/Markdown tab 的右側），出現「AI 生成講義」按鈕

### 場景 4：未設定 API Key 時點擊按鈕
**Given** 系統設定中尚未填入 Gemini API Key
**When**  管理員點擊「AI 生成講義」按鈕
**Then**  彈出 Modal，提示需要先設定 Gemini API Key
**And**   Modal 中提供 API Key 輸入欄位，以及申請連結引導（`https://aistudio.google.com/api-keys`）
**And**   用戶可在 Modal 中直接填入 API Key 並儲存，儲存成功後 Modal 自動切換到來源選擇步驟

### 場景 5：已設定 API Key 時點擊按鈕
**Given** 系統設定中已填入有效的 Gemini API Key
**When**  管理員點擊「AI 生成講義」按鈕
**Then**  彈出 Modal，顯示來源選擇介面
**And**   提供兩個選項：「上傳字幕檔（SRT）」和「使用影片內容」
**And**   每個選項附帶簡短說明

### 場景 6：選擇字幕檔來源並生成講義
**Given** 管理員在 Modal 中選擇「上傳字幕檔」
**When**  上傳一個 SRT 字幕檔並確認生成
**Then**  系統將字幕內容發送給 Gemini API
**And**   Gemini 根據提示詞將字幕轉化為結構化講義（包含時間戳錨點）
**And**   生成過程中 Modal 顯示 loading 狀態
**And**   生成完成後，講義內容自動填入單元的 Markdown 編輯器中
**And**   Modal 自動關閉

### 場景 7：選擇影片來源並生成講義
**Given** 管理員在 Modal 中選擇「使用影片內容」
**And**   當前單元已設定影片（有 videoId）
**When**  確認生成
**Then**  系統將影片 URL 發送給 Gemini API（使用 Gemini 的影片理解能力）
**And**   Gemini 根據提示詞將影片內容轉化為結構化講義（包含時間戳錨點）
**And**   生成過程中 Modal 顯示 loading 狀態
**And**   生成完成後，講義內容自動填入單元的 Markdown 編輯器中

### 場景 8：當前單元無影片時選擇影片來源
**Given** 當前單元尚未設定影片
**When**  管理員查看 Modal 中的「使用影片內容」選項
**Then**  該選項呈現禁用狀態，並提示「請先為此單元設定影片」

### 場景 9：生成失敗的錯誤處理
**Given** 管理員已填入 API Key 並選擇來源
**When**  Gemini API 呼叫失敗（網路錯誤、API Key 無效、配額用完等）
**Then**  Modal 顯示錯誤訊息，說明失敗原因
**And**   用戶可以選擇重試或關閉 Modal
**And**   編輯器中的既有內容不受影響

### 場景 10：時間戳格式
**Given** Gemini 生成講義時
**When**  講義中涉及特定時間點
**Then**  使用 `[MM:SS](#t=秒數)` 格式插入時間戳
**And**   例如 `[03:25](#t=205)` 表示第 3 分 25 秒（總計 205 秒）

## Acceptance Criteria
- [ ] AC-01：系統設定頁面新增「AI 模型」區塊，包含 Gemini API Key 輸入欄位和 Gemini 模型選擇
- [ ] AC-02：Gemini API Key 可被儲存到資料庫，且已儲存的 Key 以遮蔽形式顯示
- [ ] AC-03：設定頁面側邊欄新增「AI 模型」導覽項目，且點擊可滾動到對應區塊
- [ ] AC-04：單元編輯器的「單元內容」區域顯示「AI 生成講義」按鈕
- [ ] AC-05：未設定 API Key 時，點擊按鈕彈出 Modal 要求先設定 API Key，且提供申請連結引導
- [ ] AC-06：已設定 API Key 時，點擊按鈕彈出 Modal 顯示來源選擇（字幕檔/影片）
- [ ] AC-07：選擇字幕檔後可上傳 SRT 檔案，並透過 Gemini API 生成講義
- [ ] AC-08：選擇影片後透過 Gemini API 影片理解能力生成講義；若無影片則禁用此選項
- [ ] AC-09：生成的講義使用 `[MM:SS](#t=秒數)` 時間戳格式
- [ ] AC-10：生成完成後自動將內容填入 Markdown 編輯器
- [ ] AC-11：生成失敗時顯示錯誤訊息，不影響既有編輯器內容
- [ ] AC-12：API Key 作為敏感資料，在前端顯示時需遮蔽處理
- [ ] AC-13：API route 需驗證 ADMIN 或 EDITOR 角色權限

## 排除範圍（Out of Scope）
- 支援 Gemini 以外的 AI 模型（未來可擴展）
- 字幕檔格式支援 SRT 以外的格式（如 VTT、ASS）
- 講義生成後的手動編輯提示或引導
- 批量為多個單元生成講義
- 生成歷史記錄或版本管理
