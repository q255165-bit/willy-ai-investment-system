# WAIS V3.3.0 Stable

Manual Control Edition

## 核心原則
- 一般持股核心數字直接維護
- 交易／配息紀錄不再自動覆寫主資料
- 2421 一般持股與員工信託完全分開
- 員工信託分為自提、公提、合計
- 信託成本均價由本金餘額、現金與股數自動推算
- 單一 localStorage 資料檔，避免 IndexedDB 升級問題
- JSON 匯出／匯入

## V3.4.0 Stable
- 新增海外／基金分頁
- USD 原幣管理，首頁換算 TWD
- 新增 USD/TWD 匯率、TWD 現金、USD 現金
- 新增資產配置圓餅圖
- 海外資產與現金納入總資產

## V3.4.1 Stable
- 修正「匯率與現金設定」及「更新匯率」按鈕無反應
- 修正設定視窗因不存在 hidden id 欄位而中斷
- 改用明確 DOM 元素綁定設定與海外資產表單
- 自動承接 V3.3.0 的既有本機資料
- 更新離線快取版本

## V4.0.0 Stable
- 移除新台幣現金與美元現金
- 總資產只計入投資部位
- 海外資產以 USD 管理並換算 TWD
- 圓餅圖不再包含現金

## V4.0.1 Stable
- 獲利紅色、虧損綠色、持平白色
- 損益與報酬率增加 + / - 符號

## V5.0.0 Cloud Sync
- Firebase Authentication 登入
- Cloud Firestore 跨裝置同步
- 保留本機資料與離線使用
- 修改後自動同步，另有立即同步
- 詳見 FIREBASE-SETUP.md

## V5.0.1 Google Sync
- 登入方式由 Email／Password 改為 Google
- 手機與電腦使用同一 Google 帳號同步
- 優先使用登入彈窗，彈窗受阻時改用重新導向
- 移除 Email／Password 建立帳號表單
- 請在 Firebase Authentication 已授權網域加入 q255165-bit.github.io

## V5.2.0 Clean Cloud Sync
- 完整重寫 cloud-sync.js，不再沿用損壞的舊程式
- 移除殘留的 Email／Password 登入程式
- Firebase 只初始化一次
- Google 登入、重新導向登入與登出重新實作
- Firestore 上傳、初次下載與自動同步重新實作
- 新增「測試 Firebase」按鈕
- 登入前確認 Authentication 使用的 apiKey 與儲存設定一致
- Service Worker 改成程式檔網路優先，避免舊版 cloud-sync.js 卡在快取

## V5.2.1 Canonical Firebase Config
- 已從 Firebase Console 截圖逐字核對真正的 apiKey
- 正確 apiKey：`AIzaSyDYzXNJjFxOqb6DmkWAGqYo8e7wwPR1pCE`
- 啟動時自動覆蓋過去手動輸入的錯誤或舊 Firebase 設定
- Firebase 設定視窗已預載正確值，不需再手動抄寫
- 保留 Google 登入、Firestore 同步與本機資料
- 快取版本已更新，避免舊設定與舊 cloud-sync.js 殘留

## V5.2.2 Auto Sync
- 資料新增、修改或刪除後約 1.5 秒自動同步
- 顯示等待同步、同步中、同步完成、同步失敗與離線狀態
- 顯示最後同步時間
- 同步完成動畫與成功提示
- 離線時保留本機資料，網路恢復後自動上傳
- 保留立即同步按鈕
