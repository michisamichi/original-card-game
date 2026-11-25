// Read-only catalog details. One preview is created on demand; no storage or match changes.
import {appendCardFace} from './card-face.js';
import {description} from './cards.js';
import {createKeywordHelp} from './keyword-help.js';
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
export function createCatalogDetail(artFor=()=>null,{usageFor=null}={}){
 const dialog=el('dialog','catalog-detail');dialog.setAttribute('aria-label','カード詳細');
 const content=el('div','catalog-detail-content'),closeButton=el('button','action','閉じる');closeButton.type='button';
 let opener=null,items=[],index=-1;
 const nav=el('div','catalog-detail-nav'),prev=el('button','action','‹ 前へ'),next=el('button','action','次へ ›'),position=el('span','catalog-detail-position');
 prev.type=next.type='button';position.setAttribute('role','status');nav.append(prev,position,next);nav.hidden=true;
 function move(delta){if(!dialog.open||dialog.isConnected===false)return;const i=index+delta;if(i<0||i>=items.length)return;const pressed=delta<0?prev:next,wasFocused=document.activeElement===pressed;index=i;paint(items[i]);if(pressed.disabled&&wasFocused)(delta<0?next:prev).focus?.();}
 prev.onclick=()=>move(-1);next.onclick=()=>move(1);
 dialog.onkeydown=e=>{if(!dialog.open||dialog.isConnected===false||index<0||items.length<2||e.isComposing||e.keyCode===229||['SELECT','INPUT','TEXTAREA'].includes(e.target?.tagName)||e.target?.isContentEditable||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;const delta=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0;if(delta){e.preventDefault();move(delta);}};
 const clear=()=>{content.replaceChildren();items=[];index=-1;nav.hidden=true;const old=opener;opener=null;if(old?.isConnected!==false)old?.focus?.();};
 function close(){if(!dialog.open)return;if(typeof dialog.close==='function')dialog.close();else dialog.open=false;clear();}
 closeButton.onclick=close;dialog.onclose=()=>{if(!dialog.open&&opener)clear();};
 dialog.oncancel=e=>{e.preventDefault();close();};
 dialog.onclick=e=>{if(e.target===dialog)close();};
 dialog.append(closeButton,content,nav);
 function paint(d){const helpOpen=!!content.querySelector?.('.keyword-help')?.open;const preview=el('div',`card ${d.type} detail-card`);appendCardFace(preview,d,d,artFor(d));
  const info=el('div','catalog-detail-info');info.append(el('p','eyebrow','CARD DETAILS'),el('h2','',d.name),el('p','detail-type',`${{minion:'ミニオン',spell:'スペル',secret:'秘策'}[d.type]} ・ マナ ${d.manaCost}`));
  if(d.type==='minion')info.append(el('p','detail-stats',`攻撃力 ${d.attack} ／ 体力 ${d.maxHealth}`));
  info.append(el('h3','','カード効果'),el('p','detail-description',description(d)||'効果なし'));const help=createKeywordHelp(d.keywords);if(help){help.open=helpOpen;info.append(help);}
  if(usageFor){const usage=usageFor(d);const group=el('div','detail-deck-usage');group.append(el('h3','',`採用デッキ（${usage.length}件）`));if(usage.length){const list=el('ul','detail-deck-list');for(const u of usage)list.append(el('li','',`${u.name} ×${u.count}`));group.append(list);}else group.append(el('p','muted','保存済みデッキで未採用'));info.append(group);}
  content.replaceChildren(preview,info);nav.hidden=index<0||items.length<2;position.textContent=index<0?'':`${index+1} / ${items.length}`;prev.disabled=index<=0;next.disabled=index>=items.length-1;
 }
 function show(d,source,sequence=[]){if(dialog.isConnected===false||source?.isConnected===false)return;if(dialog.open)close();opener=source;items=sequence.slice();index=items.indexOf(d);paint(d);if(typeof dialog.showModal==='function')dialog.showModal();else dialog.open=true;closeButton.focus?.();
 }
 return {dialog,show,close};
}
