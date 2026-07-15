# WAIS V5.0 Firebase 設定

1. 到 Firebase Console 建立免費 Spark 專案。
2. 新增 Web App，複製 apiKey、authDomain、projectId、appId。
3. Authentication → Sign-in method → 啟用 Email/Password。
4. Firestore Database → 建立資料庫。
5. Firestore Rules 貼上：

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/wais/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

6. WAIS → 更多 → 設定 Firebase。
7. 手機與電腦使用同一組 Email/Password 登入。
