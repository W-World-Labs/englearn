/** Embedded in exported HTML. Kept independent of the app, network and account state. */
export const offlineScript = String.raw`(()=>{
'use strict';
const {pack,m}=JSON.parse(document.getElementById('pack-data').textContent);
const byId=new Map(pack.cards.map(c=>[c.id,c])),el=id=>document.getElementById(id),key='lingolearn:portable:'+pack.id;
let rounds=[],draft=null,mode='all',revealed=false,storageFailed=false,invalidSaved=null;
function uuid(){return 'offline-'+(globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));}
function valid(r,complete){
 return r && typeof r.id==='string' && /^[a-zA-Z0-9-]{1,100}$/.test(r.id) && Number.isSafeInteger(r.startedAt) && r.startedAt>0 && r.startedAt<=Date.now()+30000 && Array.isArray(r.cards) && r.cards.length>0 && r.cards.length<=20 && new Set(r.cards).size===r.cards.length && r.cards.every(id=>byId.has(id)) && Array.isArray(r.ratings) && r.ratings.length<=r.cards.length && r.ratings.every(v=>[0,1,2].includes(v)) && (!complete || r.ratings.length===r.cards.length && Number.isSafeInteger(r.at) && r.at>=r.startedAt && r.at<=Date.now()+30000);
}
function normalize(r,complete){return {id:r.id,startedAt:r.startedAt,cards:[...r.cards],ratings:[...r.ratings],...(complete?{at:r.at}:{})};}
function prefix(old,next){return old.startedAt===next.startedAt && JSON.stringify(old.cards)===JSON.stringify(next.cards) && JSON.stringify(old.ratings)===JSON.stringify(next.ratings.slice(0,old.ratings.length));}
function persist(){if(invalidSaved!==null)return;try{localStorage.setItem(key,JSON.stringify({rounds,draft}));storageFailed=false;}catch{storageFailed=true;}el('save-status').textContent=storageFailed?m.storage:m.saved;}
try{
 const raw=localStorage.getItem(key);
 if(raw){try{const s=JSON.parse(raw);if(!s || !Array.isArray(s.rounds) || s.rounds.length>1000 || !s.rounds.every(r=>valid(r,true)) || new Set(s.rounds.map(r=>r.id)).size!==s.rounds.length || s.draft && (!valid(s.draft,false) || s.rounds.some(r=>r.id===s.draft.id)))throw Error();rounds=s.rounds.map(r=>normalize(r,true));draft=s.draft?normalize(s.draft,false):null;}catch{invalidSaved=raw;}}
}catch{storageFailed=true;}
function latest(){const result=new Map();[...rounds].sort((a,b)=>a.at-b.at).forEach(r=>r.cards.forEach((id,i)=>result.set(id,r.ratings[i])));return result;}
function start(){
 if(invalidSaved!==null || rounds.length>=1000){render();return;}
 const seen=latest(),ids=pack.cards.filter(c=>mode==='all' || seen.get(c.id)===0).sort((a,b)=>(seen.has(a.id)?seen.get(a.id)+1:0)-(seen.has(b.id)?seen.get(b.id)+1:0)).slice(0,20).map(c=>c.id);
 if(!ids.length){draft=null;render();return;}
 draft={id:uuid(),startedAt:Date.now(),cards:ids,ratings:[]};revealed=false;persist();render();
}
function textBlock(parent,text,tag='p'){const node=document.createElement(tag);node.textContent=text;parent.appendChild(node);}
function render(){
 revealed=false;el('recall-front').replaceChildren();el('recall-back').replaceChildren();el('recall-back').hidden=true;el('rating').hidden=true;
 const blocked=invalidSaved!==null || rounds.length>=1000;
 el('all').disabled=blocked;el('weak').disabled=blocked;el('reveal').hidden=!draft || blocked;el('next').hidden=!!draft && !blocked;el('next').textContent=blocked?m.reset:m.next;
 el('round-status').textContent=draft?m.progress+' '+draft.ratings.length+'/'+draft.cards.length:m.done+' · '+rounds.length;
 if(invalidSaved!==null){textBlock(el('recall-front'),m.invalid);return;}
 if(rounds.length>=1000){textBlock(el('recall-front'),m.full);return;}
 if(!draft){textBlock(el('recall-front'),m.none);return;}
 if(draft.ratings.length===draft.cards.length){rounds.push({...draft,at:Math.max(Date.now(),draft.startedAt)});draft=null;persist();render();return;}
 const card=byId.get(draft.cards[draft.ratings.length]);textBlock(el('recall-front'),card.front,'h3');card.choices.forEach((choice,i)=>textBlock(el('recall-front'),String.fromCharCode(65+i)+'. '+choice));textBlock(el('recall-back'),card.answer[pack.locale],'strong');textBlock(el('recall-back'),card.explanation[pack.locale]);card.examples.forEach(line=>textBlock(el('recall-back'),line));
}
el('reveal').onclick=()=>{if(!draft || invalidSaved!==null)return;revealed=true;el('recall-back').hidden=false;el('rating').hidden=false;el('reveal').hidden=true;};
document.querySelectorAll('[data-rating]').forEach(button=>button.onclick=()=>{if(!draft || !revealed)return;draft.ratings.push(Number(button.dataset.rating));persist();render();});
function replace(nextMode){if(draft?.ratings.length && !confirm(m.resetConfirm))return;mode=nextMode;start();}
el('all').onclick=()=>replace('all');el('weak').onclick=()=>replace('weak');
el('next').onclick=()=>{if(invalidSaved!==null || rounds.length>=1000){if(!confirm(m.resetConfirm))return;invalidSaved=null;rounds=[];draft=null;}start();};
el('print').onclick=()=>window.print();
el('export').onclick=()=>{
 const content=invalidSaved??JSON.stringify({format:'lingolearn-review-results',version:1,rounds,draft},null,2),url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='lingolearn-review-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
el('import').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;
 try{
  if(file.size>5000000 || invalidSaved!==null)throw Error();
  const data=JSON.parse(await file.text());
  if(data.format!=='lingolearn-review-results' || data.version!==1 || !Array.isArray(data.rounds) || (!data.rounds.length && !data.draft) || data.rounds.length>1000 || !data.rounds.every(r=>valid(r,true)) || new Set(data.rounds.map(r=>r.id)).size!==data.rounds.length || data.draft && (!valid(data.draft,false) || data.rounds.some(r=>r.id===data.draft.id)))throw Error();
  const incomingDraft=data.draft?normalize(data.draft,false):null,existing=new Map(rounds.map(r=>[r.id,r]));let nextDraft=draft;
  for(const r of data.rounds){const incoming=normalize(r,true),old=existing.get(r.id);if(nextDraft?.id===r.id){if(!prefix(nextDraft,incoming))throw Error();nextDraft=null;}if(old && JSON.stringify(old)!==JSON.stringify(incoming))throw Error();existing.set(r.id,incoming);}
  if(existing.size>1000)throw Error();
  if(incomingDraft){const completed=existing.get(incomingDraft.id);if(completed){if(!prefix(incomingDraft,completed))throw Error();}else{if(nextDraft?.id===incomingDraft.id && !prefix(nextDraft,incomingDraft))throw Error();if(nextDraft && nextDraft.id!==incomingDraft.id && nextDraft.ratings.length && !confirm(m.resetConfirm))return;nextDraft=incomingDraft;}}
  if(existing.size>=1000 && nextDraft)throw Error();
  rounds=[...existing.values()];draft=nextDraft;persist();render();el('save-status').textContent=m.imported;
 }catch{el('save-status').textContent=m.invalid;}finally{event.target.value='';}
};
if(invalidSaved===null && !draft && !rounds.length)start();else render();if(storageFailed)el('save-status').textContent=m.storage;else if(!el('save-status').textContent)el('save-status').textContent=m.saved;
})();`;
