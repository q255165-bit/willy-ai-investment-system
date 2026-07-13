
const APP_VERSION='2.2.0';
const DB_NAME='willy-investment-v2', DB_VERSION=1;
const stores=['assets','accounts','transactions','dividends'];
let db, deferredPrompt;

const fmt=n=>new Intl.NumberFormat('zh-TW',{style:'currency',currency:'TWD',maximumFractionDigits:0}).format(Number(n||0));
const fmtPrice=n=>new Intl.NumberFormat('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:4}).format(Number(n||0));
const num=n=>Number(n||0);
const uid=()=>crypto.randomUUID();
const today=()=>new Date().toISOString().slice(0,10);
const nowLocal=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
const labels={
  active:'持有中',closed:'已清倉',archived:'封存',
  cash:'現金入帳',reinvest:'股息再投入',record_only:'僅記錄',
  initial:'初始持股',buy:'買進',sell:'賣出',stock_dividend:'股票股利',adjustment:'股數調整'
};

function openDB(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,DB_VERSION);
  req.onupgradeneeded=e=>{const d=e.target.result; stores.forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'})})};
  req.onsuccess=e=>resolve(e.target.result); req.onerror=()=>reject(req.error);
 });
}
function all(store){return new Promise((res,rej)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(store,value){return new Promise((res,rej)=>{const r=db.transaction(store,'readwrite').objectStore(store).put(value);r.onsuccess=()=>res(value);r.onerror=()=>rej(r.error)})}
function del(store,id){return new Promise((res,rej)=>{const r=db.transaction(store,'readwrite').objectStore(store).delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function clearStore(store){return new Promise((res,rej)=>{const r=db.transaction(store,'readwrite').objectStore(store).clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}

let state={assets:[],accounts:[],transactions:[],dividends:[]};
async function migrateData(){
 let changed=false;
 for(const a of state.assets){
   if(a.symbol==='2421' && a.name==='信錦'){a.name='建準';await put('assets',a);changed=true}
 }
 return changed;
}
async function load(){
 for(const s of stores)state[s]=await all(s);
 const changed=await migrateData();
 if(changed)for(const s of stores)state[s]=await all(s);
 render();
}

function holdings(){
 const map={};
 state.assets.forEach(a=>map[a.id]={asset:a,qty:0,cost:0,marketValue:0,accounts:{}});
 state.transactions.forEach(t=>{
  if(!map[t.assetId])return;
  const sign=t.type==='sell'?-1:1;
  map[t.assetId].qty+=sign*num(t.quantity);
  if(['initial','buy','reinvest'].includes(t.type))map[t.assetId].cost+=num(t.quantity)*num(t.price)+num(t.fee);
  if(t.type==='sell')map[t.assetId].cost=Math.max(0,map[t.assetId].cost-num(t.quantity)*num(t.price));
  const ac=map[t.assetId].accounts[t.accountId]||{qty:0};ac.qty+=sign*num(t.quantity);map[t.assetId].accounts[t.accountId]=ac;
 });
 Object.values(map).forEach(x=>x.marketValue=x.qty*num(x.asset.currentPrice));
 return map;
}
function render(){
 renderSelects(); renderAssets(); renderAccounts(); renderTransactions(); renderDividends(); renderDashboard();
}
function renderSelects(){
 document.querySelectorAll('select[name=assetId],select[name=reinvestAssetId]').forEach(sel=>{
  const v=sel.value; sel.innerHTML='<option value="">請選擇</option>'+state.assets.filter(a=>a.status!=='archived').map(a=>`<option value="${a.id}">${a.symbol} ${a.name}</option>`).join('');sel.value=v;
 });
 document.querySelectorAll('select[name=accountId]').forEach(sel=>refreshAccountOptions(sel));
}

function toggleReinvestFields(form){
 const show=form?.elements?.mode?.value==='reinvest';
 const box=form?.querySelector('[data-reinvest-fields]');
 if(box)box.classList.toggle('show',show);
}
function applyDividendAccountDefaults(form){
 const account=state.accounts.find(a=>a.id===form.elements.accountId.value);
 if(account && !form.elements.id.value){
   form.elements.mode.value=account.dividendMode||'cash';
   toggleReinvestFields(form);
 }
}

function refreshAccountOptions(sel,assetId){
 const v=sel.value; const aid=assetId||sel.closest('form')?.querySelector('[name=assetId]')?.value;
 sel.innerHTML='<option value="">請選擇</option>'+state.accounts.filter(a=>!aid||a.assetId===aid).map(a=>`<option value="${a.id}">${a.name}</option>`).join('');sel.value=v;
}
function assetName(id){const a=state.assets.find(x=>x.id===id);return a?`${a.symbol} ${a.name}`:'—'}
function accountName(id){return state.accounts.find(x=>x.id===id)?.name||'—'}
function actionButtons(store,id){return `<div class="actions"><button class="mini" data-edit="${store}:${id}">編輯</button><button class="mini delete" data-delete="${store}:${id}">刪除</button></div>`}
function renderAssets(){
 assetsTable.innerHTML=state.assets.map(a=>`<tr><td><strong>${a.symbol}</strong></td><td>${a.name}</td><td>${a.market}</td><td>${a.type}</td><td>NT$ ${fmtPrice(a.currentPrice)}<div class="muted">${a.priceUpdatedAt?new Date(a.priceUpdatedAt).toLocaleString('zh-TW'):''}</div></td><td>${labels[a.status]}</td><td>${actionButtons('assets',a.id)}</td></tr>`).join('')||'<tr><td colspan="7" class="muted">尚無資料</td></tr>';
}
function renderAccounts(){
 accountsTable.innerHTML=state.accounts.map(a=>`<tr><td>${assetName(a.assetId)}</td><td>${a.name}</td><td>${labels[a.dividendMode]}</td><td>${a.note||''}</td><td>${actionButtons('accounts',a.id)}</td></tr>`).join('')||'<tr><td colspan="5" class="muted">尚無資料</td></tr>';
}
function renderTransactions(){
 const rows=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date));
 transactionsTable.innerHTML=rows.map(t=>`<tr><td>${t.date}</td><td>${assetName(t.assetId)}</td><td>${accountName(t.accountId)}</td><td>${labels[t.type]||t.type}</td><td>${num(t.quantity).toLocaleString()}</td><td>${fmt(t.price)}</td><td>${fmt(t.fee)}</td><td>${actionButtons('transactions',t.id)}</td></tr>`).join('')||'<tr><td colspan="8" class="muted">尚無資料</td></tr>';
}
function renderDividends(){
 const rows=[...state.dividends].sort((a,b)=>b.date.localeCompare(a.date));
 dividendsTable.innerHTML=rows.map(d=>`<tr><td>${d.date}</td><td>${assetName(d.assetId)}</td><td>${accountName(d.accountId)}</td><td>${labels[d.mode]}${d.mode==='reinvest'&&d.reinvestQuantity?`<div class="muted">+${num(d.reinvestQuantity).toLocaleString()} 股 → ${assetName(d.reinvestAssetId||d.assetId)}</div>`:''}</td><td>${num(d.eligibleShares).toLocaleString()}</td><td>${fmtPrice(d.perShare)}</td><td>${fmt(d.netAmount)}${d.mode==='reinvest'&&num(d.residualCash)>0?`<div class="muted">餘額 ${fmt(d.residualCash)}</div>`:''}</td><td>${actionButtons('dividends',d.id)}</td></tr>`).join('')||'<tr><td colspan="8" class="muted">尚無資料</td></tr>';
}
function renderDashboard(){
 const h=holdings(), vals=Object.values(h);
 const cost=vals.reduce((s,x)=>s+x.cost,0), mv=vals.reduce((s,x)=>s+x.marketValue,0), pnl=mv-cost;
 totalMarketValue.textContent=fmt(mv);totalCost.textContent=fmt(cost);unrealizedPnl.textContent=fmt(pnl);
 unrealizedPnl.className=pnl>=0?'positive':'negative';
 cashDividends.textContent=fmt(state.dividends.filter(d=>d.mode==='cash').reduce((s,d)=>s+num(d.netAmount),0));
 reinvestedDividends.textContent=fmt(state.dividends.filter(d=>d.mode==='reinvest').reduce((s,d)=>s+num(d.netAmount),0));
 assetCount.textContent=state.assets.filter(a=>a.status==='active').length;
 const cards=vals.filter(x=>x.asset.status!=='archived').map(x=>{
  const avg=x.qty?x.cost/x.qty:0,p=x.marketValue-x.cost;
  return `<article class="asset-card"><header><div><h3>${x.asset.symbol}</h3><small>${x.asset.name}</small></div><div style="text-align:right"><span class="muted" style="display:block;font-size:.72rem">現價</span><strong>NT$ ${fmtPrice(x.asset.currentPrice)}</strong><small style="display:block">${x.asset.priceUpdatedAt?new Date(x.asset.priceUpdatedAt).toLocaleString('zh-TW'):''}</small></div></header><div class="asset-stats"><div><span>持股</span><strong>${x.qty.toLocaleString()} 股</strong></div><div><span>平均成本</span><strong>NT$ ${fmtPrice(avg)}</strong></div><div><span>市值</span><strong>${fmt(x.marketValue)}</strong></div><div><span>損益</span><strong class="${p>=0?'positive':'negative'}">${fmt(p)}</strong></div></div><button class="ghost inline-price-btn" data-price-edit="${x.asset.id}">更新現價</button></article>`;
 }).join('');
 portfolioCards.classList.toggle('empty-state',!cards);portfolioCards.innerHTML=cards||'尚無投資標的';
}
function toast(msg){toastEl.textContent=msg;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),2200)}
const toastEl=document.getElementById('toast');

document.addEventListener('click',async e=>{

 const closeBtn=e.target.closest('[data-close-dialog]');if(closeBtn){closeBtn.closest('dialog')?.close()}
 const mtab=e.target.closest('.mobile-tab');if(mtab){document.querySelectorAll('.mobile-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));mtab.classList.add('active');document.getElementById(mtab.dataset.view).classList.add('active')}

 const tab=e.target.closest('.tab'); if(tab){document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));tab.classList.add('active');document.querySelectorAll('.mobile-tab').forEach(x=>x.classList.toggle('active',x.dataset.view===tab.dataset.view));document.getElementById(tab.dataset.view).classList.add('active')}
 const op=e.target.closest('[data-open]');if(op){const d=document.getElementById(op.dataset.open);d.querySelector('form').reset();d.querySelector('[name=id]').value='';d.querySelectorAll('[name=date]').forEach(x=>x.value=today());const p=d.querySelector('[name=priceUpdatedAt]');if(p)p.value=nowLocal();renderSelects();if(d.id==='priceCenterDialog')renderPriceCenter();if(d.id==='dividendDialog'){toggleReinvestFields(d.querySelector('form'));}d.showModal()}

 const pe=e.target.closest('[data-price-edit]');if(pe){const a=state.assets.find(x=>x.id===pe.dataset.priceEdit);const v=prompt(`${a.symbol} ${a.name}\n請輸入最新現價：`,a.currentPrice||'');if(v!==null&&v!==''){const n=Number(v);if(Number.isFinite(n)&&n>=0){a.currentPrice=n;a.priceUpdatedAt=nowLocal();await put('assets',a);await load();toast('現價已更新')}else alert('請輸入有效價格')}}

 const ed=e.target.closest('[data-edit]');if(ed){const [store,id]=ed.dataset.edit.split(':');editRecord(store,id)}
 const de=e.target.closest('[data-delete]');if(de){const [store,id]=de.dataset.delete.split(':');if(confirm('確定刪除這筆資料？')){
   if(store==='dividends'){const d=state.dividends.find(x=>x.id===id);if(d?.linkedTransactionId)await del('transactions',d.linkedTransactionId)}
   await del(store,id);await load();toast('已刪除')
 }}
});
function editRecord(store,id){
 const record=state[store].find(x=>x.id===id), map={assets:'assetDialog',accounts:'accountDialog',transactions:'transactionDialog',dividends:'dividendDialog'};
 const d=document.getElementById(map[store]), f=d.querySelector('form');f.reset();
 Object.entries(record).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v});
 if(store==='transactions'||store==='dividends')refreshAccountOptions(f.elements.accountId,record.assetId);
 if(store==='dividends')toggleReinvestFields(f);
 d.showModal();
}

dividendForm.elements.mode.addEventListener('change',()=>toggleReinvestFields(dividendForm));
dividendForm.elements.accountId.addEventListener('change',()=>applyDividendAccountDefaults(dividendForm));

document.querySelectorAll('select[name=assetId]').forEach(s=>s.addEventListener('change',e=>{const f=e.target.closest('form');if(f?.elements.accountId)refreshAccountOptions(f.elements.accountId,e.target.value)}));


function renderPriceCenter(){
 const box=document.getElementById('priceCenterList');
 box.innerHTML=state.assets.filter(a=>a.status!=='archived').map(a=>`<label class="price-row"><span><strong>${a.symbol} ${a.name}</strong><small>目前：NT$ ${fmtPrice(a.currentPrice)}</small></span><input type="number" step="0.0001" min="0" name="price_${a.id}" value="${a.currentPrice||''}" placeholder="現價"></label>`).join('')||'<div class="muted">尚無投資標的</div>';
}
priceCenterForm.addEventListener('submit',async e=>{
 e.preventDefault();const fd=new FormData(e.target);let count=0;
 for(const a of state.assets){const v=fd.get(`price_${a.id}`);if(v!==null&&String(v).trim()!==''){const n=Number(v);if(Number.isFinite(n)&&n>=0){a.currentPrice=n;a.priceUpdatedAt=nowLocal();await put('assets',a);count++}}}
 e.target.closest('dialog').close();await load();toast(`已更新 ${count} 檔現價`);
});

function formObject(form){return Object.fromEntries(new FormData(form).entries())}
assetForm.addEventListener('submit',async e=>{e.preventDefault();const x=formObject(e.target);x.id=x.id||uid();x.currentPrice=num(x.currentPrice);if(!x.priceUpdatedAt)x.priceUpdatedAt=nowLocal();await put('assets',x);e.target.closest('dialog').close();await load();toast('標的已儲存')});
accountForm.addEventListener('submit',async e=>{e.preventDefault();const x=formObject(e.target);x.id=x.id||uid();await put('accounts',x);e.target.closest('dialog').close();await load();toast('持有來源已儲存')});
transactionForm.addEventListener('submit',async e=>{e.preventDefault();const x=formObject(e.target);x.id=x.id||uid();['quantity','price','fee'].forEach(k=>x[k]=num(x[k]));await put('transactions',x);e.target.closest('dialog').close();await load();toast('交易已儲存')});
dividendForm.addEventListener('submit',async e=>{
 e.preventDefault();
 const x=formObject(e.target);
 x.id=x.id||uid();
 ['eligibleShares','perShare','netAmount','reinvestPrice','reinvestQuantity','residualCash'].forEach(k=>x[k]=num(x[k]));
 x.createReinvestTransaction=e.target.elements.createReinvestTransaction?.checked||false;
 const old=state.dividends.find(d=>d.id===x.id);
 if(old?.linkedTransactionId && (!x.createReinvestTransaction || x.mode!=='reinvest')){
   await del('transactions',old.linkedTransactionId);
   x.linkedTransactionId='';
 }
 if(x.mode==='reinvest' && x.createReinvestTransaction && x.reinvestQuantity>0){
   const sourceAccount=state.accounts.find(a=>a.id===x.accountId);
   let targetAccountId=x.accountId;
   if(x.reinvestAssetId && x.reinvestAssetId!==x.assetId){
     const match=state.accounts.find(a=>a.assetId===x.reinvestAssetId && a.name===sourceAccount?.name);
     if(match)targetAccountId=match.id;
     else{
       const newAccount={id:uid(),assetId:x.reinvestAssetId,name:sourceAccount?.name||'股息再投入',dividendMode:'cash',note:'由股息再投入自動建立'};
       await put('accounts',newAccount);targetAccountId=newAccount.id;
     }
   }
   const tx={
     id:old?.linkedTransactionId||uid(),
     assetId:x.reinvestAssetId||x.assetId,
     accountId:targetAccountId,
     type:'reinvest',
     date:x.reinvestDate||x.date,
     quantity:x.reinvestQuantity,
     price:x.reinvestPrice,
     fee:0,
     note:`由 ${assetName(x.assetId)} 配息再投入`
   };
   await put('transactions',tx);
   x.linkedTransactionId=tx.id;
 }
 await put('dividends',x);
 e.target.closest('dialog').close();
 await load();
 toast(x.mode==='reinvest'?'再投入配息已儲存':'配息已儲存');
});

exportBtn.onclick=async()=>{
 const payload={app:'Willy AI Investment System',version:APP_VERSION,exportedAt:new Date().toISOString(),data:state};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download=`Willy-Investment-Backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);
};
importFile.onchange=async e=>{
 try{const text=await e.target.files[0].text(),p=JSON.parse(text);if(!p.data)throw new Error('格式不正確');
  if(!confirm('匯入會取代目前所有資料，確定繼續？'))return;
  for(const s of stores){await clearStore(s);for(const r of (p.data[s]||[]))await put(s,r)}await load();toast('備份已還原');
 }catch(err){alert('匯入失敗：'+err.message)}finally{e.target.value=''}
};
clearBtn.onclick=async()=>{if(confirm('這會清除目前瀏覽器中的全部投資資料，確定嗎？')){for(const s of stores)await clearStore(s);await load();toast('全部資料已清除')}};
seedBtn.onclick=async()=>{
 if(state.assets.length&&!confirm('已有資料，仍要加入範例資料嗎？'))return;
 const a2421={id:uid(),symbol:'2421',name:'建準',market:'台股',type:'個股',currentPrice:125,priceUpdatedAt:nowLocal(),status:'active',note:''};
 const a0050={id:uid(),symbol:'0050',name:'元大台灣50',market:'台股',type:'ETF',currentPrice:0,priceUpdatedAt:nowLocal(),status:'active',note:''};
 await put('assets',a2421);await put('assets',a0050);
 const personal={id:uid(),assetId:a2421.id,name:'個人持股',dividendMode:'cash',note:'配息實際現金入帳'};
 const trust={id:uid(),assetId:a2421.id,name:'員工福利信託',dividendMode:'reinvest',note:'股息留在信託並再投入'};
 await put('accounts',personal);await put('accounts',trust);
 await put('transactions',{id:uid(),assetId:a2421.id,accountId:personal.id,type:'initial',date:today(),quantity:2031,price:125,fee:0,note:'初始持股'});
 await put('transactions',{id:uid(),assetId:a2421.id,accountId:trust.id,type:'initial',date:today(),quantity:970,price:106.81,fee:0,note:'員工福利信託初始持股'});
 await load();toast('Willy 範例資料已載入');
};

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;installBtn.classList.remove('hidden')});
installBtn.onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.classList.add('hidden')}};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');
(async()=>{db=await openDB();await load()})();
