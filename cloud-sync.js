import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore,doc,getDoc,setDoc,serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const CONFIG_KEY='wais-firebase-config',SYNC_TIME_KEY='wais-last-cloud-sync';
let auth=null,db=null,user=null,timer=null;
const $=id=>document.getElementById(id);
function toast(m){const e=$('toast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
function cfg(){try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||'null')}catch(e){return null}}
function status(mode,text){const d=document.querySelector('#cloudStatus .status-dot');if(d)d.className=`status-dot ${mode}`;$('cloudStatusText').textContent=text}
function ui(){const c=cfg();$('signedInUser').textContent=user?.email||'未登入';$('lastSyncAt').textContent=localStorage.getItem(SYNC_TIME_KEY)?new Date(localStorage.getItem(SYNC_TIME_KEY)).toLocaleString('zh-TW'):'—';$('loginBtn').disabled=!c||!!user;$('syncNowBtn').disabled=!user;$('logoutBtn').disabled=!user}
async function init(){
 const c=cfg();if(!c?.apiKey||!c?.authDomain||!c?.projectId||!c?.appId){status('offline','本機模式');ui();return}
 try{
  const app=getApps().length?getApps()[0]:initializeApp(c);auth=getAuth(app);db=getFirestore(app);
  onAuthStateChanged(auth,async u=>{user=u||null;ui();if(user){status('online','雲端已連線');await merge()}else status('offline','尚未登入')});
 }catch(e){console.error(e);status('error','設定錯誤');toast('Firebase 初始化失敗')}
}
function ref(){return doc(db,'users',user.uid,'wais','portfolio')}
async function upload(){if(!user)return;status('syncing','同步中');try{await setDoc(ref(),{data:window.WAISBridge.getData(),appVersion:window.WAISBridge.getVersion(),clientUpdatedAt:new Date().toISOString(),updatedAt:serverTimestamp()});localStorage.setItem(SYNC_TIME_KEY,new Date().toISOString());status('online','雲端已同步');ui();toast('同步完成')}catch(e){status('error','同步失敗');toast('同步失敗：'+e.message)}}
async function merge(){try{status('syncing','同步中');const snap=await getDoc(ref());if(snap.exists()&&snap.data()?.data){window.WAISBridge.setData(snap.data().data);localStorage.setItem(SYNC_TIME_KEY,snap.data().clientUpdatedAt||new Date().toISOString());toast('已下載雲端資料')}else await upload();status('online','雲端已同步');ui()}catch(e){status('error','同步失敗');toast('同步失敗：'+e.message)}}
window.addEventListener('wais-local-data-changed',()=>{if(!user)return;clearTimeout(timer);timer=setTimeout(upload,1500)});
document.addEventListener('click',e=>{const o=e.target.closest('[data-open="cloudSetupDialog"]');if(o){const f=$('cloudSetupForm'),c=cfg()||{};f.reset();Object.entries(c).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v})}});
$('cloudSetupForm').addEventListener('submit',e=>{e.preventDefault();localStorage.setItem(CONFIG_KEY,JSON.stringify(Object.fromEntries(new FormData(e.target).entries())));e.target.closest('dialog').close();toast('設定已儲存');setTimeout(()=>location.reload(),600)});
$('loginBtn').addEventListener('click',async()=>{
 if(!auth)return toast('請先設定 Firebase');
 const provider=new GoogleAuthProvider();
 provider.setCustomParameters({prompt:'select_account'});
 try{
  await signInWithPopup(auth,provider);
  toast('Google 登入成功');
 }catch(err){
  console.error(err);
  if(['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(err.code)){
   try{await signInWithRedirect(auth,provider)}
   catch(e){toast('Google 登入失敗：'+e.message)}
  }else toast('Google 登入失敗：'+err.message);
 }
});$('authDialog').showModal()});
const x=Object.fromEntries(new FormData(e.target).entries());try{await signInWithEmailAndPassword(auth,x.email,x.password);e.target.closest('dialog').close();toast('登入成功')}catch(err){toast('登入失敗：'+err.message)}});

$('syncNowBtn').addEventListener('click',upload);
$('logoutBtn').addEventListener('click',async()=>{if(auth)await signOut(auth);toast('已登出')});
async function handleRedirect(){
 if(!auth)return;
 try{
  const result=await getRedirectResult(auth);
  if(result?.user)toast('Google 登入成功');
 }catch(err){
  console.error(err);toast('登入返回處理失敗：'+err.message);
 }
}
window.addEventListener('wais-ready',async()=>{await init();await handleRedirect()});
if(window.WAISBridge){init().then(handleRedirect)}
ui();
