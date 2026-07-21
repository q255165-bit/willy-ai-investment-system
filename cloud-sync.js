import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const CONFIG_KEY = "wais-firebase-config";
const LAST_SYNC_KEY = "wais-last-cloud-sync";

const CANONICAL_FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyDYzXNJjFxOqb6DmkWAGqYo8e7wwPR1pCE",
  authDomain: "wais-cloud-sync.firebaseapp.com",
  projectId: "wais-cloud-sync",
  appId: "1:330810522720:web:dba3bee4e5026e4e0d9705"
});
const CONFIG_SCHEMA_VERSION = "2026-07-21-canonical-1";
const CONFIG_SCHEMA_KEY = "wais-firebase-config-schema";


let firebaseApp = null;
let auth = null;
let db = null;
let currentUser = null;
let syncTimer = null;
let initPromise = null;

const byId = (id) => document.getElementById(id);

function showToast(message) {
  const toast = byId("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function setCloudStatus(mode, text) {
  const dot = document.querySelector("#cloudStatus .status-dot");
  if (dot) dot.className = `status-dot ${mode}`;

  const label = byId("cloudStatusText");
  if (label) label.textContent = text;
}

function normalizeValue(value) {
  return String(value ?? "")
    .trim()
    .replace(/^["']+|["',;]+$/g, "");
}

function normalizeConfig(raw = {}) {
  return {
    apiKey: normalizeValue(raw.apiKey),
    authDomain: normalizeValue(raw.authDomain),
    projectId: normalizeValue(raw.projectId),
    appId: normalizeValue(raw.appId)
  };
}

function loadConfig() {
  // The Firebase Web API key is public client configuration.
  // Always migrate stale manually-entered values to the exact verified config.
  const schema = localStorage.getItem(CONFIG_SCHEMA_KEY);
  if (schema !== CONFIG_SCHEMA_VERSION) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(CANONICAL_FIREBASE_CONFIG));
    localStorage.setItem(CONFIG_SCHEMA_KEY, CONFIG_SCHEMA_VERSION);
    return { ...CANONICAL_FIREBASE_CONFIG };
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    const normalized = normalizeConfig(parsed || {});

    const matchesCanonical =
      normalized.apiKey === CANONICAL_FIREBASE_CONFIG.apiKey &&
      normalized.authDomain === CANONICAL_FIREBASE_CONFIG.authDomain &&
      normalized.projectId === CANONICAL_FIREBASE_CONFIG.projectId &&
      normalized.appId === CANONICAL_FIREBASE_CONFIG.appId;

    if (!matchesCanonical) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(CANONICAL_FIREBASE_CONFIG));
      return { ...CANONICAL_FIREBASE_CONFIG };
    }

    return normalized;
  } catch (error) {
    console.error("Firebase config parse error:", error);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(CANONICAL_FIREBASE_CONFIG));
    return { ...CANONICAL_FIREBASE_CONFIG };
  }
}

function validateConfig(config) {
  const errors = [];

  if (!config.apiKey.startsWith("AIza")) {
    errors.push("apiKey 必須以 AIza 開頭");
  }
  if (!config.authDomain.endsWith(".firebaseapp.com")) {
    errors.push("authDomain 應以 .firebaseapp.com 結尾");
  }
  if (!config.projectId) {
    errors.push("projectId 不可空白");
  }
  if (!config.appId.includes(":web:")) {
    errors.push("appId 應包含 :web:");
  }

  return errors;
}

function updateSyncUI() {
  const config = loadConfig();
  const configured = validateConfig(config).length === 0;

  const signedInUser = byId("signedInUser");
  if (signedInUser) {
    signedInUser.textContent = currentUser?.email || "未登入";
  }

  const lastSyncAt = byId("lastSyncAt");
  if (lastSyncAt) {
    const value = localStorage.getItem(LAST_SYNC_KEY);
    lastSyncAt.textContent = value
      ? new Date(value).toLocaleString("zh-TW")
      : "—";
  }

  const loginBtn = byId("loginBtn");
  const syncNowBtn = byId("syncNowBtn");
  const logoutBtn = byId("logoutBtn");
  const testFirebaseBtn = byId("testFirebaseBtn");

  if (loginBtn) loginBtn.disabled = !configured || Boolean(currentUser);
  if (syncNowBtn) syncNowBtn.disabled = !currentUser;
  if (logoutBtn) logoutBtn.disabled = !currentUser;
  if (testFirebaseBtn) testFirebaseBtn.disabled = !configured;

  const description = byId("syncDescription");
  if (description) {
    if (!configured) {
      description.textContent = "尚未完成 Firebase 設定。";
    } else if (currentUser) {
      description.textContent = "已登入，資料修改後會自動同步。";
    } else {
      description.textContent = "Firebase 已設定，請使用 Google 登入。";
    }
  }
}

async function initializeFirebase() {
  if (auth && db && firebaseApp) {
    return { firebaseApp, auth, db };
  }

  if (initPromise) return initPromise;

  initPromise = (async () => {
    const config = loadConfig();
    const errors = validateConfig(config);

    if (errors.length) {
      throw new Error(errors.join("；"));
    }

    // This module creates exactly one Firebase app instance.
    firebaseApp = initializeApp(config);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);

    // Confirm the Authentication instance is using the exact saved config.
    const actualApiKey = normalizeValue(auth.app.options.apiKey);
    if (actualApiKey !== config.apiKey) {
      throw new Error("Authentication 使用的 apiKey 與儲存設定不一致");
    }

    onAuthStateChanged(auth, async (user) => {
      currentUser = user || null;
      updateSyncUI();

      if (currentUser) {
        setCloudStatus("online", "雲端已連線");
        await initialCloudSync();
      } else {
        setCloudStatus("offline", "尚未登入");
      }
    });

    try {
      const redirectResult = await getRedirectResult(auth);
      if (redirectResult?.user) {
        showToast("Google 登入成功");
      }
    } catch (error) {
      console.error("Redirect result error:", error);
      showToast(`登入返回失敗：${error.code || error.message}`);
    }

    setCloudStatus("online", "Firebase 已初始化");
    return { firebaseApp, auth, db };
  })();

  try {
    return await initPromise;
  } catch (error) {
    initPromise = null;
    firebaseApp = null;
    auth = null;
    db = null;
    throw error;
  }
}

function portfolioRef() {
  if (!db || !currentUser) {
    throw new Error("尚未登入，無法存取雲端資料");
  }
  return doc(db, "users", currentUser.uid, "wais", "portfolio");
}

async function uploadLocalData({ silent = false } = {}) {
  if (!currentUser || !window.WAISBridge) return;

  setCloudStatus("syncing", "同步中");

  try {
    const now = new Date().toISOString();

    await setDoc(portfolioRef(), {
      data: window.WAISBridge.getData(),
      appVersion: window.WAISBridge.getVersion(),
      clientUpdatedAt: now,
      updatedAt: serverTimestamp()
    });

    localStorage.setItem(LAST_SYNC_KEY, now);
    setCloudStatus("online", "雲端已同步");
    updateSyncUI();

    if (!silent) showToast("同步完成");
  } catch (error) {
    console.error("Cloud upload error:", error);
    setCloudStatus("error", "同步失敗");
    showToast(`同步失敗：${error.code || error.message}`);
  }
}

async function initialCloudSync() {
  if (!currentUser || !window.WAISBridge) return;

  setCloudStatus("syncing", "同步中");

  try {
    const snapshot = await getDoc(portfolioRef());

    if (snapshot.exists() && snapshot.data()?.data) {
      window.WAISBridge.setData(snapshot.data().data);

      const cloudTime =
        snapshot.data().clientUpdatedAt || new Date().toISOString();

      localStorage.setItem(LAST_SYNC_KEY, cloudTime);
      showToast("已下載雲端資料");
    } else {
      await uploadLocalData({ silent: true });
      showToast("已建立第一份雲端資料");
    }

    setCloudStatus("online", "雲端已同步");
    updateSyncUI();
  } catch (error) {
    console.error("Initial sync error:", error);
    setCloudStatus("error", "同步失敗");
    showToast(`同步失敗：${error.code || error.message}`);
  }
}

async function testFirebaseConnection() {
  setCloudStatus("syncing", "測試中");

  try {
    const config = loadConfig();
    const errors = validateConfig(config);
    if (errors.length) throw new Error(errors.join("；"));

    await initializeFirebase();

    const actual = normalizeConfig(auth.app.options);
    const same =
      actual.apiKey === config.apiKey &&
      actual.authDomain === config.authDomain &&
      actual.projectId === config.projectId &&
      actual.appId === config.appId;

    if (!same) {
      throw new Error("Firebase 實際初始化設定與儲存值不一致");
    }

    setCloudStatus("online", "Firebase 測試成功");
    showToast("Firebase 初始化與設定比對成功");
  } catch (error) {
    console.error("Firebase test error:", error);
    setCloudStatus("error", "Firebase 測試失敗");
    showToast(`Firebase 測試失敗：${error.code || error.message}`);
  }

  updateSyncUI();
}

async function loginWithGoogle() {
  try {
    await initializeFirebase();

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await signInWithPopup(auth, provider);
      showToast("Google 登入成功");
    } catch (error) {
      const redirectCodes = new Set([
        "auth/popup-blocked",
        "auth/cancelled-popup-request"
      ]);

      if (redirectCodes.has(error.code)) {
        await signInWithRedirect(auth, provider);
        return;
      }

      if (error.code !== "auth/popup-closed-by-user") {
        throw error;
      }
    }
  } catch (error) {
    console.error("Google login error:", error);
    setCloudStatus("error", "Google 登入失敗");
    showToast(`Google 登入失敗：${error.code || error.message}`);
    console.error("Canonical API key used:", CANONICAL_FIREBASE_CONFIG.apiKey);
  }
}

function resetFirebaseRuntime() {
  firebaseApp = null;
  auth = null;
  db = null;
  currentUser = null;
  initPromise = null;
}

document.addEventListener("click", (event) => {
  const openButton = event.target.closest(
    '[data-open="cloudSetupDialog"]'
  );
  if (!openButton) return;

  const form = byId("cloudSetupForm");
  if (!form) return;

  const config = { ...CANONICAL_FIREBASE_CONFIG };
  form.reset();

  Object.entries(config).forEach(([key, value]) => {
    if (form.elements[key]) {
      form.elements[key].value = value;
    }
  });
});

byId("cloudSetupForm")?.addEventListener("submit", (event) => {
  event.preventDefault();

  localStorage.setItem(CONFIG_KEY, JSON.stringify(CANONICAL_FIREBASE_CONFIG));
  localStorage.setItem(CONFIG_SCHEMA_KEY, CONFIG_SCHEMA_VERSION);
  event.target.closest("dialog")?.close();

  resetFirebaseRuntime();
  setCloudStatus("offline", "設定已套用");
  updateSyncUI();
  showToast("已套用經 Firebase Console 驗證的正確設定");
});

byId("testFirebaseBtn")?.addEventListener(
  "click",
  testFirebaseConnection
);

byId("loginBtn")?.addEventListener("click", loginWithGoogle);

byId("syncNowBtn")?.addEventListener("click", () =>
  uploadLocalData()
);

byId("logoutBtn")?.addEventListener("click", async () => {
  if (!auth) return;

  try {
    await signOut(auth);
    showToast("已登出");
  } catch (error) {
    console.error("Logout error:", error);
    showToast(`登出失敗：${error.code || error.message}`);
  }
});

window.addEventListener("wais-local-data-changed", () => {
  if (!currentUser) return;

  clearTimeout(syncTimer);
  syncTimer = window.setTimeout(
    () => uploadLocalData({ silent: true }),
    1500
  );
});

async function startCloudModule() {
  updateSyncUI();

  const config = loadConfig();
  if (validateConfig(config).length) {
    setCloudStatus("offline", "本機模式");
    return;
  }

  try {
    await initializeFirebase();
  } catch (error) {
    console.error("Firebase startup error:", error);
    setCloudStatus("error", "Firebase 初始化失敗");
    showToast(`Firebase 初始化失敗：${error.code || error.message}`);
  }

  updateSyncUI();
}

window.addEventListener("wais-ready", startCloudModule);

if (window.WAISBridge) {
  startCloudModule();
} else {
  updateSyncUI();
}
