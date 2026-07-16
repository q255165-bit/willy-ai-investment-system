import {
  initializeApp, getApps, getApp, deleteApp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult, signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const CONFIG_KEY = 'wais-firebase-config';
const SYNC_TIME_KEY = 'wais-last-cloud-sync';
const FIREBASE_APP_NAME = 'wais-main';

let firebaseApp = null;
let auth = null;
let db = null;
let user = null;
let syncTimer = null;
let initialized = false;

const $ = id => document.getElementById(id);

function toast(message) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

function clean(value) {
  return String(value ?? '')
    .trim()
    .replace(/^["']+|["',;]+$/g, '')
    .replace(/\s+/g, '');
}

function normalizeConfig(raw = {}) {
  return {
    apiKey: clean(raw.apiKey),
    authDomain: clean(raw.authDomain),
    projectId: clean(raw.projectId),
    appId: clean(raw.appId)
  };
}

function loadConfig() {
  try {
    return normalizeConfig(JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null') || {});
  } catch {
    return normalizeConfig({});
  }
}

function validConfig(config) {
  return Boolean(
    config.apiKey.startsWith('AIza') &&
    config.authDomain.endsWith('.firebaseapp.com') &&
    config.projectId &&
    config.appId.includes(':web:')
  );
}

function mask(value, head = 6, tail = 6) {
  if (!value) return '未設定';
  return value.length <= head + tail
    ? value
    : `${value.slice(0, head)}••••${value.slice(-tail)}`;
}

function setDiagnostic(id, text, state = 'warn') {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className =
    state === 'ok' ? 'diagnostic-ok' :
    state === 'error' ? 'diagnostic-error' :
    'diagnostic-warn';
}

function setStatus(mode, text) {
  const dot = document.querySelector('#cloudStatus .status-dot');
  if (dot) dot.className = `status-dot ${mode}`;
  if ($('cloudStatusText')) $('cloudStatusText').textContent = text;
}

function renderDiagnostics() {
  const config = loadConfig();
  setDiagnostic('diagApiKey', config.apiKey ? mask(config.apiKey) : '未設定', config.apiKey ? 'ok' : 'error');
  setDiagnostic('diagAuthDomain', config.authDomain || '未設定', config.authDomain ? 'ok' : 'error');
  setDiagnostic('diagProjectId', config.projectId || '未設定', config.projectId ? 'ok' : 'error');
  setDiagnostic('diagAppId', config.appId ? mask(config.appId, 8, 8) : '未設定', config.appId ? 'ok' : 'error');

  if (auth) {
    const actualKey = clean(auth.app.options.apiKey);
    const keyMatches = actualKey === config.apiKey;
    setDiagnostic(
      'diagAuth',
      keyMatches
        ? (user ? `已登入：${user.email}` : '已初始化，未登入')
        : '初始化設定與儲存設定不一致',
      keyMatches ? 'ok' : 'error'
    );
  } else {
    setDiagnostic('diagAuth', '未初始化', 'warn');
  }

  setDiagnostic('diagFirestore', db ? '已初始化' : '未初始化', db ? 'ok' : 'warn');
}

function updateUI() {
  const config = loadConfig();

  if ($('signedInUser')) $('signedInUser').textContent = user?.email || '未登入';

  if ($('lastSyncAt')) {
    const last = localStorage.getItem(SYNC_TIME_KEY);
    $('lastSyncAt').textContent = last
      ? new Date(last).toLocaleString('zh-TW')
      : '—';
  }

  if ($('loginBtn')) $('loginBtn').disabled = !validConfig(config) || Boolean(user);
  if ($('syncNowBtn')) $('syncNowBtn').disabled = !user;
  if ($('logoutBtn')) $('logoutBtn').disabled = !user;

  if ($('syncDescription')) {
    $('syncDescription').textContent = !validConfig(config)
      ? 'Firebase 設定不完整。'
      : user
        ? '已登入，資料會自動同步。'
        : 'Firebase 已設定，請使用 Google 登入。';
  }

  renderDiagnostics();
}

async function createFreshFirebase(config) {
  const existing = getApps().find(app => app.name === FIREBASE_APP_NAME);

  if (existing) {
    const oldOptions = existing.options || {};
    const same =
      clean(oldOptions.apiKey) === config.apiKey &&
      clean(oldOptions.authDomain) === config.authDomain &&
      clean(oldOptions.projectId) === config.projectId &&
      clean(oldOptions.appId) === config.appId;

    if (!same) {
      await deleteApp(existing);
    }
  }

  firebaseApp = getApps().find(app => app.name === FIREBASE_APP_NAME)
    || initializeApp(config, FIREBASE_APP_NAME);

  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);

  const actual = normalizeConfig(firebaseApp.options);
  if (
    actual.apiKey !== config.apiKey ||
    actual.authDomain !== config.authDomain ||
    actual.projectId !== config.projectId ||
    actual.appId !== config.appId
  ) {
    throw new Error('Firebase App 實際設定與儲存設定不一致');
  }
}

function cloudRef() {
  return doc(db, 'users', user.uid, 'wais', 'portfolio');
}

async function upload() {
  if (!user || !window.WAISBridge) return;

  setStatus('syncing', '同步中');

  try {
    await setDoc(cloudRef(), {
      data: window.WAISBridge.getData(),
      appVersion: window.WAISBridge.getVersion(),
      clientUpdatedAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    localStorage.setItem(SYNC_TIME_KEY, new Date().toISOString());
    setStatus('online', '雲端已同步');
    updateUI();
    toast('同步完成');
  } catch (error) {
    console.error(error);
    setStatus('error', '同步失敗');
    toast(`同步失敗：${error.code || error.message}`);
  }
}

async function initialSync() {
  if (!user || !window.WAISBridge) return;

  setStatus('syncing', '同步中');

  try {
    const snapshot = await getDoc(cloudRef());

    if (snapshot.exists() && snapshot.data()?.data) {
      window.WAISBridge.setData(snapshot.data().data);
      localStorage.setItem(
        SYNC_TIME_KEY,
        snapshot.data().clientUpdatedAt || new Date().toISOString()
      );
      toast('已下載雲端資料');
    } else {
      await upload();
      toast('已建立雲端資料');
    }

    setStatus('online', '雲端已同步');
    updateUI();
  } catch (error) {
    console.error(error);
    setStatus('error', '同步失敗');
    toast(`同步失敗：${error.code || error.message}`);
  }
}

async function initializeCloud(force = false) {
  if (initialized && !force) return;
  initialized = true;

  const config = loadConfig();

  if (!validConfig(config)) {
    setStatus('offline', '本機模式');
    updateUI();
    return;
  }

  try {
    await createFreshFirebase(config);

    onAuthStateChanged(auth, async currentUser => {
      user = currentUser || null;
      updateUI();

      if (user) {
        setStatus('online', '雲端已連線');
        await initialSync();
      } else {
        setStatus('offline', '尚未登入');
      }
    });

    const redirectResult = await getRedirectResult(auth);
    if (redirectResult?.user) toast('Google 登入成功');

    setStatus('online', 'Firebase 已初始化');
    updateUI();
  } catch (error) {
    console.error(error);
    setStatus('error', 'Firebase 初始化失敗');
    setDiagnostic('diagAuth', `失敗：${error.code || error.message}`, 'error');
    toast(`Firebase 初始化失敗：${error.code || error.message}`);
    updateUI();
  }
}

window.addEventListener('wais-local-data-changed', () => {
  if (!user) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(upload, 1500);
});

document.addEventListener('click', event => {
  const openSetup = event.target.closest('[data-open="cloudSetupDialog"]');
  if (!openSetup) return;

  const form = $('cloudSetupForm');
  const config = loadConfig();
  form.reset();

  Object.entries(config).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
});

$('cloudSetupForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  const config = normalizeConfig(
    Object.fromEntries(new FormData(event.target).entries())
  );

  if (!validConfig(config)) {
    toast('Firebase 設定格式不完整或不正確');
    return;
  }

  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  event.target.closest('dialog')?.close();

  initialized = false;
  user = null;
  auth = null;
  db = null;
  firebaseApp = null;

  toast('Firebase 設定已儲存，正在重新初始化');
  await initializeCloud(true);
});

$('testFirebaseBtn')?.addEventListener('click', async () => {
  const config = loadConfig();

  if (!validConfig(config)) {
    toast('Firebase 設定不完整');
    return;
  }

  setStatus('syncing', '測試連線中');

  try {
    await createFreshFirebase(config);

    const actualKey = clean(auth.app.options.apiKey);
    if (actualKey !== config.apiKey) {
      throw new Error('Google 登入使用的 apiKey 與儲存值不一致');
    }

    setDiagnostic('diagAuth', `初始化成功；Key ${mask(actualKey)}`, 'ok');
    setDiagnostic('diagFirestore', '初始化成功', 'ok');
    setStatus('online', 'Firebase 可用');
    toast('Firebase 設定與實際 App 完全一致');
  } catch (error) {
    console.error(error);
    setStatus('error', 'Firebase 測試失敗');
    setDiagnostic('diagAuth', `失敗：${error.code || error.message}`, 'error');
    setDiagnostic('diagFirestore', '尚未連線', 'error');
    toast(`Firebase 測試失敗：${error.code || error.message}`);
  }

  updateUI();
});

$('loginBtn')?.addEventListener('click', async () => {
  const config = loadConfig();

  if (!validConfig(config)) {
    toast('請先正確設定 Firebase');
    return;
  }

  try {
    if (!auth) await initializeCloud(true);

    const actualKey = clean(auth?.app?.options?.apiKey);
    if (!actualKey || actualKey !== config.apiKey) {
      throw new Error('登入前檢查失敗：Firebase apiKey 不一致');
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await signInWithPopup(auth, provider);
      toast('Google 登入成功');
    } catch (error) {
      if (
        error.code === 'auth/popup-blocked' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        await signInWithRedirect(auth, provider);
      } else if (error.code !== 'auth/popup-closed-by-user') {
        throw error;
      }
    }
  } catch (error) {
    console.error(error);
    setStatus('error', 'Google 登入失敗');
    toast(`Google 登入失敗：${error.code || error.message}`);
  }
});

$('syncNowBtn')?.addEventListener('click', upload);

$('logoutBtn')?.addEventListener('click', async () => {
  if (!auth) return;
  await signOut(auth);
  toast('已登出');
});

window.addEventListener('wais-ready', () => initializeCloud());
if (window.WAISBridge) initializeCloud();
updateUI();
