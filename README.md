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
