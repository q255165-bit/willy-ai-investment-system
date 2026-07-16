import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult, signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const CONFIG_KEY = 'wais-firebase-config';
const SYNC_TIME_KEY = 'wais-last-cloud-sync';

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
  setTimeout(() => el.classList.remove('show'), 2400);
}

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
  } catch {
    return null;
  }
}

function validConfig(config) {
  return Boolean(config?.apiKey && config?.authDomain && config?.projectId && config?.appId);
}

function setStatus(mode, text) {
  const dot = document.querySelector('#cloudStatus .status-dot');
  if (dot) dot.className = `status-dot ${mode}`;
  const textEl = $('cloudStatusText');
  if (textEl) textEl.textContent = text;
}

function updateUI() {
  const config = loadConfig();
  if ($('signedInUser')) $('signedInUser').textContent = user?.email || '未登入';
  if ($('lastSyncAt')) {
    const last = localStorage.getItem(SYNC_TIME_KEY);
    $('lastSyncAt').textContent = last ? new Date(last).toLocaleString('zh-TW') : '—';
  }
  if ($('loginBtn')) $('loginBtn').disabled = !validConfig(config) || Boolean(user);
  if ($('syncNowBtn')) $('syncNowBtn').disabled = !user;
  if ($('logoutBtn')) $('logoutBtn').disabled = !user;
  if ($('syncDescription')) {
    $('syncDescription').textContent = !validConfig(config)
      ? '尚未設定 Firebase。'
      : user
        ? '已登入，資料會自動同步。'
        : 'Firebase 已設定，請使用 Google 登入。';
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
    const now = new Date().toISOString();
    localStorage.setItem(SYNC_TIME_KEY, now);
    setStatus('online', '雲端已同步');
    updateUI();
    toast('同步完成');
  } catch (error) {
    console.error(error);
    setStatus('error', '同步失敗');
    toast(`同步失敗：${error.message}`);
  }
}

async function initialSync() {
  if (!user || !window.WAISBridge) return;
  setStatus('syncing', '同步中');
  try {
    const snapshot = await getDoc(cloudRef());
    if (snapshot.exists() && snapshot.data()?.data) {
      window.WAISBridge.setData(snapshot.data().data);
      const syncAt = snapshot.data().clientUpdatedAt || new Date().toISOString();
      localStorage.setItem(SYNC_TIME_KEY, syncAt);
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
    toast(`同步失敗：${error.message}`);
  }
}

async function initializeCloud() {
  if (initialized) return;
  initialized = true;

  const config = loadConfig();
  if (!validConfig(config)) {
    setStatus('offline', '本機模式');
    updateUI();
    return;
  }

  try {
    const app = getApps().length ? getApps()[0] : initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);

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
  } catch (error) {
    console.error(error);
    setStatus('error', 'Firebase 設定錯誤');
    toast(`Firebase 初始化失敗：${error.message}`);
  }
}

window.addEventListener('wais-local-data-changed', () => {
  if (!user) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(upload, 1500);
});

document.addEventListener('click', event => {
  const openSetup = event.target.closest('[data-open="cloudSetupDialog"]');
  if (openSetup) {
    const form = $('cloudSetupForm');
    const config = loadConfig() || {};
    form.reset();
    Object.entries(config).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value;
    });
  }
});

$('cloudSetupForm')?.addEventListener('submit', event => {
  event.preventDefault();
  const config = Object.fromEntries(new FormData(event.target).entries());
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  event.target.closest('dialog')?.close();
  toast('Firebase 設定已儲存');
  setTimeout(() => location.reload(), 800);
});

$('loginBtn')?.addEventListener('click', async () => {
  if (!auth) {
    toast('請先儲存 Firebase 設定');
    return;
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    await signInWithPopup(auth, provider);
    toast('Google 登入成功');
  } catch (error) {
    console.error(error);
    if (['auth/popup-blocked', 'auth/cancelled-popup-request'].includes(error.code)) {
      await signInWithRedirect(auth, provider);
    } else if (error.code !== 'auth/popup-closed-by-user') {
      toast(`Google 登入失敗：${error.message}`);
    }
  }
});

$('syncNowBtn')?.addEventListener('click', upload);

$('logoutBtn')?.addEventListener('click', async () => {
  if (!auth) return;
  await signOut(auth);
  toast('已登出');
});

window.addEventListener('wais-ready', initializeCloud);
if (window.WAISBridge) initializeCloud();
updateUI();
