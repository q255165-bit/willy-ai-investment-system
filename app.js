
const APP_VERSION='3.3.0';
const KEY='wais-v3.3-data';

const defaultData=()=>({
 version:APP_VERSION,
 holdings:[
  {id:crypto.randomUUID(),symbol:'0050',name:'元大台灣50',type:'ETF',shares:29050,totalCost:2302878,averageCost:79.27,currentPrice:106,priceUpdatedAt:'',note:'核心長期持有'},
  {id:crypto.randomUUID(),symbol:'00997A',name:'主動群益美國增長',type:'主動式ETF',shares:40000,totalCost:408968,averageCost:10.22,currentPrice:12.07,priceUpdatedAt:'',note:'成長型部位'},
  {id:crypto.randomUUID(),symbol:'00400A',name:'主動國泰動能高息',type:'主動式ETF',shares:10000,totalCost:98800,averageCost:9.88,currentPrice:14.1,priceUpdatedAt:'',note:'配息用途'},
  {id:crypto.randomUUID(),symbol:'2421',name:'建準（一般持股）',type:'個股',shares:2031,totalCost:253875,averageCost:125,currentPrice:138,priceUpdatedAt:'',note:'不含員工福利信託'}
 ],
 trustSnapshots:[
  {id:crypto.randomUUID(),date:'2026-07-14',kind:'self',shares:519.5,marketValue:71760,cash:117,principal:57000,fees:0,dividendReinvest:'',note:'依信託平台畫面'},
  {id:crypto.randomUUID(),date:'2026-07-14',kind:'company',shares:519.5,marketValue:71622,cash:259,principal:57000,fees:0,dividendReinvest:'',note:'依信託平台畫面'}
 ],
 dividends:[]
});

let data=loadData();

function loadData(){
 try{
  const raw=localStorage.getItem(KEY);
  if(!raw)return defaultData();
  const p=JSON.parse(raw);
  return {
   version:APP_VERSION,
   holdings:Array.isArray(p.holdings)?p.holdings:[],
   trustSnapshots:Array.isArray(p.trustSnapshots)?p.trustSnapshots:[],
   dividends:Array.isArray(p.dividends)?p.dividends:[]
  };
 }catch(e){
  console.error(e);return defaultData();
 }
}
function saveData(){localStorage.setItem(KEY,JSON.stringify(data));}
function uid(){return crypto.randomUUID()}
function n(v){return Number(v||0)}
function money(v){return new Intl.NumberFormat('zh-TW',{style:'currency',currency:'TWD',maximumFractionDigits:0}).format(n(v))}
function price(v){return new Intl.NumberFormat('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:4}).format(n(v))}
function today(){return new Date().toISOString().slice(0,10)}
function nowLocal(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}

function latestTrust(kind){
 const rows=data.trustSnapshots.filter(x=>x.kind===kind).sort((a,b)=>b.date.localeCompare(a.date));
 return rows[0]||null;
}
function trustCalc(row){
 if(!row)return {shares:0,marketValue:0,cash:0,principal:0,fees:0,currentValue:0,pnl:0,returnRate:0,stockCost:0,avgCost:0};
 const currentValue=n(row.marketValue)+n(row.cash);
 const pnl=currentValue-n(row.principal)-n(row.fees);
 const returnRate=n(row.principal)?pnl/n(row.principal)*100:0;
 const stockCost=Math.max(0,n(row.principal)-n(row.cash));
 const avgCost=n(row.shares)?stockCost/n(row.shares):0;
 return {...row,currentValue,pnl,returnRate,stockCost,avgCost};
}
function combinedTrust(){
 const a=trustCalc(latestTrust('self')),b=trustCalc(latestTrust('company'));
 const shares=a.shares+b.shares,marketValue=a.marketValue+b.marketValue,cash=a.cash+b.cash,principal=a.principal+b.principal,fees=a.fees+b.fees;
 const currentValue=marketValue+cash,pnl=currentValue-principal-fees,returnRate=principal?pnl/principal*100:0,stockCost=Math.max(0,principal-cash),avgCost=shares?stockCost/shares:0;
 return {shares,marketValue,cash,principal,fees,currentValue,pnl,returnRate,stockCost,avgCost};
}
function render(){
 renderSummary();renderHoldings();renderTrust();renderDividends();fillAssetSelect();
}
function renderSummary(){
 const holdingMarket=data.holdings.reduce((s,x)=>s+n(x.shares)*n(x.currentPrice),0);
 const holdingCost=data.holdings.reduce((s,x)=>s+n(x.totalCost),0);
 const trust=combinedTrust();
 const totalMarket=holdingMarket+trust.currentValue,totalCost=holdingCost+trust.principal,pnl=totalMarket-totalCost;
 sumMarket.textContent=money(totalMarket);sumCost.textContent=money(totalCost);sumPnl.textContent=money(pnl);sumPnl.className=pnl>=0?'positive':'negative';
 sumCashDiv.textContent=money(data.dividends.filter(x=>x.mode==='cash').reduce((s,x)=>s+n(x.amount),0));
 sumReinvestDiv.textContent=money(data.dividends.filter(x=>x.mode==='reinvest').reduce((s,x)=>s+n(x.amount),0));
 sumAssets.textContent=data.holdings.length;
}
function holdingCard(x){
 const market=n(x.shares)*n(x.currentPrice),pnl=market-n(x.totalCost),avg=n(x.averageCost)|| (n(x.shares)?n(x.totalCost)/n(x.shares):0);
 return `<article class="asset-card">
  <header><div><h3>${x.symbol}</h3><small>${x.name}</small></div><strong>NT$ ${price(x.currentPrice)}</strong></header>
  <div class="asset-stats">
   <div><span>持股</span><strong>${n(x.shares).toLocaleString()} 股</strong></div>
   <div><span>成本均價</span><strong>NT$ ${price(avg)}</strong></div>
   <div><span>總投入成本</span><strong>${money(x.totalCost)}</strong></div>
   <div><span>市值</span><strong>${money(market)}</strong></div>
   <div><span>參考損益</span><strong class="${pnl>=0?'positive':'negative'}">${money(pnl)}</strong></div>
   <div><span>更新時間</span><strong>${x.priceUpdatedAt?new Date(x.priceUpdatedAt).toLocaleString('zh-TW'):'—'}</strong></div>
  </div>
  <div class="card-actions"><button class="mini" data-edit-holding="${x.id}">編輯</button><button class="mini delete" data-delete-holding="${x.id}">刪除</button></div>
 </article>`;
}
function renderHoldings(){
 const html=data.holdings.map(holdingCard).join('')||'<div class="muted">尚無一般持股</div>';
 homeCards.innerHTML=html;holdingCards.innerHTML=html;
}
function trustHtml(r){
 return `<div class="kv">
  <span>持有股數</span><strong>${n(r.shares).toLocaleString()}</strong>
  <span>標的市值</span><strong>${money(r.marketValue)}</strong>
  <span>現金</span><strong>${money(r.cash)}</strong>
  <span>參考現值</span><strong>${money(r.currentValue)}</strong>
  <span>本金餘額</span><strong>${money(r.principal)}</strong>
  <span>應付費用</span><strong>${money(r.fees)}</strong>
  <span>參考損益</span><strong class="${r.pnl>=0?'positive':'negative'}">${money(r.pnl)}</strong>
  <span>參考報酬率</span><strong class="${r.returnRate>=0?'positive':'negative'}">${r.returnRate.toFixed(2)}%</strong>
  <span>推算成本均價</span><strong>NT$ ${price(r.avgCost)}</strong>
 </div>`;
}
function renderTrust(){
 const a=trustCalc(latestTrust('self')),b=trustCalc(latestTrust('company')),t=combinedTrust();
 selfTrust.innerHTML=trustHtml(a);companyTrust.innerHTML=trustHtml(b);totalTrust.innerHTML=trustHtml(t);
 const rows=[...data.trustSnapshots].sort((a,b)=>b.date.localeCompare(a.date));
 trustHistory.innerHTML=rows.map(r=>{const c=trustCalc(r);return `<tr><td>${r.date}</td><td>${r.kind==='self'?'自提':'公提'}</td><td>${n(r.shares).toLocaleString()}</td><td>${money(r.marketValue)}</td><td>${money(r.cash)}</td><td>${money(r.principal)}</td><td>NT$ ${price(c.avgCost)}</td><td><button class="mini" data-edit-trust="${r.id}">編輯</button> <button class="mini delete" data-delete-trust="${r.id}">刪除</button></td></tr>`}).join('')||'<tr><td colspan="8" class="muted">尚無資料</td></tr>';
}
function fillAssetSelect(){
 dividendForm.assetId.innerHTML='<option value="">請選擇</option>'+data.holdings.map(x=>`<option value="${x.id}">${x.symbol} ${x.name}</option>`).join('');
}
function renderDividends(){
 dividendTable.innerHTML=[...data.dividends].sort((a,b)=>b.date.localeCompare(a.date)).map(x=>{
  const asset=data.holdings.find(a=>a.id===x.assetId);
  const mode=x.mode==='cash'?'現金入帳':x.mode==='reinvest'?'股息再投入':'僅記錄';
  return `<tr><td>${x.date}</td><td>${asset?asset.symbol:'—'}</td><td>${x.source}</td><td>${mode}</td><td>${money(x.amount)}</td><td>${x.note||''}</td><td><button class="mini" data-edit-dividend="${x.id}">編輯</button> <button class="mini delete" data-delete-dividend="${x.id}">刪除</button></td></tr>`;
 }).join('')||'<tr><td colspan="7" class="muted">尚無資料</td></tr>';
}

function switchView(view){
 document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===view));
 document.querySelectorAll('.tab,.mobile-tab').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
}
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-view]');if(nav)switchView(nav.dataset.view);
 const op=e.target.closest('[data-open]');if(op){
  const d=document.getElementById(op.dataset.open);d.querySelector('form').reset();
  d.querySelector('[name=id]').value='';
  d.querySelectorAll('[name=date]').forEach(x=>x.value=today());
  const pu=d.querySelector('[name=priceUpdatedAt]');if(pu)pu.value=nowLocal();
  d.showModal();
 }
 const close=e.target.closest('[data-close]');if(close)close.closest('dialog').close();

 const eh=e.target.closest('[data-edit-holding]');if(eh){const x=data.holdings.find(a=>a.id===eh.dataset.editHolding);openEdit(holdingDialog,holdingForm,x)}
 const dh=e.target.closest('[data-delete-holding]');if(dh&&confirm('確定刪除此標的？')){data.holdings=data.holdings.filter(a=>a.id!==dh.dataset.deleteHolding);saveData();render();toast('已刪除')}
 const et=e.target.closest('[data-edit-trust]');if(et){const x=data.trustSnapshots.find(a=>a.id===et.dataset.editTrust);openEdit(trustDialog,trustForm,x)}
 const dt=e.target.closest('[data-delete-trust]');if(dt&&confirm('確定刪除此快照？')){data.trustSnapshots=data.trustSnapshots.filter(a=>a.id!==dt.dataset.deleteTrust);saveData();render();toast('已刪除')}
 const ed=e.target.closest('[data-edit-dividend]');if(ed){const x=data.dividends.find(a=>a.id===ed.dataset.editDividend);openEdit(dividendDialog,dividendForm,x)}
 const dd=e.target.closest('[data-delete-dividend]');if(dd&&confirm('確定刪除此配息？')){data.dividends=data.dividends.filter(a=>a.id!==dd.dataset.deleteDividend);saveData();render();toast('已刪除')}
});
function openEdit(dialog,form,obj){
 form.reset();Object.entries(obj).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v});dialog.showModal();
}
function formObj(form){return Object.fromEntries(new FormData(form).entries())}

holdingForm.addEventListener('submit',e=>{
 e.preventDefault();const x=formObj(e.target);x.id=x.id||uid();
 ['shares','totalCost','averageCost','currentPrice'].forEach(k=>x[k]=n(x[k]));
 if(!x.averageCost&&x.shares)x.averageCost=x.totalCost/x.shares;
 data.holdings=data.holdings.filter(a=>a.id!==x.id);data.holdings.push(x);saveData();e.target.closest('dialog').close();render();toast('持股已儲存');
});
trustForm.addEventListener('submit',e=>{
 e.preventDefault();const x=formObj(e.target);x.id=x.id||uid();
 ['shares','marketValue','cash','principal','fees','dividendReinvest'].forEach(k=>x[k]=x[k]===''?'':n(x[k]));
 data.trustSnapshots=data.trustSnapshots.filter(a=>a.id!==x.id);data.trustSnapshots.push(x);saveData();e.target.closest('dialog').close();render();toast('信託快照已儲存');
});
dividendForm.addEventListener('submit',e=>{
 e.preventDefault();const x=formObj(e.target);x.id=x.id||uid();x.amount=n(x.amount);
 data.dividends=data.dividends.filter(a=>a.id!==x.id);data.dividends.push(x);saveData();e.target.closest('dialog').close();render();toast('配息已儲存');
});

exportBtn.onclick=()=>{
 const payload={app:'Willy AI Investment System',version:APP_VERSION,exportedAt:new Date().toISOString(),data};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download=`WAIS-Backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);
};
importFile.onchange=async e=>{
 try{
  const file=e.target.files[0];if(!file)return;
  const parsed=JSON.parse(await file.text()),raw=parsed.data||parsed;
  if(!Array.isArray(raw.holdings))throw new Error('備份格式不正確');
  if(!confirm('匯入會取代目前資料，確定繼續？'))return;
  data={version:APP_VERSION,holdings:raw.holdings||[],trustSnapshots:raw.trustSnapshots||[],dividends:raw.dividends||[]};
  saveData();render();toast('匯入成功');
 }catch(err){alert('匯入失敗：'+err.message)}finally{e.target.value=''}
};
restoreDefaultBtn.onclick=()=>{if(confirm('確定恢復 Willy 初始資料？目前資料將被取代。')){data=defaultData();saveData();render();toast('已恢復初始資料')}};
clearBtn.onclick=()=>{if(confirm('確定清除全部資料？')){data={version:APP_VERSION,holdings:[],trustSnapshots:[],dividends:[]};saveData();render();toast('已清除')}};

render();
