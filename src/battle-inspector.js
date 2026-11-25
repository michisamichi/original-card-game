// Read-only view of cards already visible to the current player. No game actions.
import {CATALOG,description,KEYWORD_LABELS} from './cards.js';
import {createKeywordHelp} from './keyword-help.js';
import {effectiveCost,effectiveAttack,effectiveMaxHealth,hasDivineShield,hasStealth,hasKeyword,attackLimit} from './engine.js';
const element=(tag,cls='',text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=text;return e;};
export function createBattleInspector(groups,definition,{artFor=()=>null,state={},key="",lazy=false}={}){
 const details=element('details','battle-inspector');details.setAttribute('data-inspector-key',key);
 const same=state.key===key,previous=same?state.selected:null,previousHelpOpen=same&&!!state.help?.open;state.help=null;details.open=same&&!!state.details?.open;state.key=key;state.details=details;state.selected=null;
 const summary=element('summary','action','カード詳細');summary.setAttribute('data-inspector-control','summary');details.append(summary);
 const pane=element('div','inspector-pane');const close=element('button','action','閉じる');close.type='button';close.setAttribute('data-inspector-control','close');close.onclick=()=>{if(state.details===details&&details.isConnected!==false&&details.open){details.open=false;summary.focus?.();}};details.onkeydown=e=>{if(state.details===details&&details.isConnected!==false&&details.open&&e.key==='Escape'&&!e.isComposing&&e.keyCode!==229&&!e.defaultPrevented&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.repeat){e.preventDefault();close.onclick();}};
 pane.append(close,element('h3','','カード詳細（閲覧のみ）'));
 const list=groups.flatMap(({label,cards,board=false},group)=>cards.map(c=>({label,c,board,group,d:definition(c.cardId)})));
 if(!list.length){if(previous!=null)details.open=false;pane.append(element('p','muted','表示できるカードがありません'));details.append(pane);return details;}
 const select=element('select');select.setAttribute('aria-label','詳細を見るカード');select.setAttribute('data-inspector-control','select');
 const sections=new Map(),zoneMeta=new Map(),zoneButtons=new Map(),zoneNav=element('div','inspector-zone-nav');zoneNav.setAttribute('role','group');zoneNav.setAttribute('aria-label','閲覧するゾーン');list.forEach((entry,i)=>{if(!sections.has(entry.group)){const section=element('optgroup');section.setAttribute('label',entry.label);sections.set(entry.group,section);zoneMeta.set(entry.group,{first:i,count:0});select.append(section);}zoneMeta.get(entry.group).count++;const opt=element('option','',`${entry.label}：${entry.d.name}`);opt.value=String(i);sections.get(entry.group).append(opt);});
 for(const [group,section] of sections){const {first,count}=zoneMeta.get(group);const b=element('button','action inspector-zone-jump',`${list[first].label} ${count}`);b.type='button';b.setAttribute('aria-pressed','false');b.setAttribute('data-inspector-control',`zone-${group}`);b.onclick=()=>{if(!interactive()||!details.open)return;select.value=String(first);show();};zoneButtons.set(group,b);zoneNav.append(b);}
 const info=element('div','inspector-info'),zonePosition=element('p','inspector-zone-position');zonePosition.setAttribute('aria-live','polite');
 const nav=element('div','inspector-navigation'),prev=element('button','action','前のカード'),next=element('button','action','次のカード'),position=element('span','muted');prev.type=next.type='button';prev.setAttribute('data-inspector-control','prev');next.setAttribute('data-inspector-control','next');nav.append(prev,position,next);
 const current=()=>state.details===details;
 const interactive=()=>current()&&details.isConnected!==false;
 function step(delta){if(!interactive()||!details.open)return;const n=Number(select.value)+delta;if(n>=0&&n<list.length){const pressed=delta<0?prev:next,wasFocused=document.activeElement===pressed;select.value=String(n);show();if(pressed.disabled&&wasFocused)(delta<0?next:prev).focus?.();}}prev.onclick=()=>step(-1);next.onclick=()=>step(1);
 const escape=details.onkeydown;details.onkeydown=e=>{escape(e);if(!interactive()||!details.open||e.defaultPrevented||e.isComposing||e.keyCode===229||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||['SELECT','INPUT','TEXTAREA'].includes(e.target?.tagName)||e.target?.isContentEditable)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}};
 let painted=false,acceptedIndex=0;
 function show(restoreHelp=false,paint=true){if(!current())return;if(!/^\d+$/.test(select.value)||!list[Number(select.value)]){select.value=String(acceptedIndex);return;}const entry=list[Number(select.value)];const {c,d,board,group}=entry;const priorSelected=state.selected;if(painted&&paint&&!restoreHelp&&priorSelected===c.instanceId)return;state.selected=c.instanceId??null;details.setAttribute('data-inspector-selected',state.selected??'');if(priorSelected!==state.selected&&painted)pane.scrollTop=0;for(const [g,b] of zoneButtons)b.setAttribute('aria-pressed',String(g===group));const i=Number(select.value);acceptedIndex=i;prev.disabled=i===0;next.disabled=i===list.length-1;position.textContent=`${i+1} / ${list.length}`;const {first,count}=zoneMeta.get(group);zonePosition.textContent=`${entry.label} ${i-first+1} / ${count} 枚`;if(!paint){painted=false;return;}painted=true;const mana=effectiveCost(d,c),liveKeywords=board&&d.type==='minion'?Object.keys(KEYWORD_LABELS).filter(k=>hasKeyword(d,c,k)):null;const nodes=[element('p','inspector-zone',`${entry.label} ／ ${{minion:'ミニオン',spell:'スペル',secret:'秘策'}[d.type]}`),element('h3','inspector-name',d.name),element('p','inspector-mana',`マナ ${mana}`),element('p','inspector-description',c.silenced?'沈黙中（元の効果は無効）':description(d)||'効果なし')];
 info.setAttribute('data-kind',d.type);
 const art=artFor(group,c);const illustration=element('div','inspector-illustration');const emblem=element('span','inspector-emblem');emblem.setAttribute('aria-hidden','true');if(Object.hasOwn(CATALOG,d.id))emblem.setAttribute('data-standard-art',d.id);emblem.hidden=!!art;illustration.append(emblem);if(art){const img=element('img','inspector-art');img.alt='';img.decoding='async';img.onerror=()=>{img.hidden=true;emblem.hidden=false;};img.src=art;illustration.append(img);}nodes.splice(2,0,illustration);
 if(mana!==d.manaCost)nodes.push(element('p','inspector-base','基本マナ '+d.manaCost));
 if(d.type==='minion'){const attack=effectiveAttack(d,c),max=effectiveMaxHealth(d,c);nodes.push(element('p','inspector-stats',`攻撃力 ${attack} ／ 体力 ${c.currentHealth??d.maxHealth}${board?` / ${max}`:''}`));if(board){if(attack!==d.attack||max!==d.maxHealth||c.currentHealth!==max)nodes.push(element('p','inspector-base',`基本攻撃力 ${d.attack} ／ 基本体力 ${d.maxHealth}`));nodes.push(element('p','muted',`攻撃回数 ${c.attacksUsed}/${attackLimit(d,c)}`));if(liveKeywords.includes('divineShield'))nodes.push(element('p','',hasDivineShield(d,c)?'聖なる盾：有効':'聖なる盾：消費済み'));if(liveKeywords.includes('stealth'))nodes.push(element('p','',hasStealth(d,c)?'潜伏：有効':'潜伏：解除済み'));const active=liveKeywords.filter(k=>k!=='divineShield'&&k!=='stealth');if(active.length){const badges=element('div','inspector-active-keywords');badges.setAttribute('aria-label','有効な特殊能力');for(const k of active)badges.append(element('span','inspector-keyword',KEYWORD_LABELS[k]));nodes.push(badges);}if(c.grantedKeywords?.length)nodes.push(element('p','',`付与：${c.grantedKeywords.map(k=>KEYWORD_LABELS[k]).join('・')}`));if(c.tempAttack)nodes.push(element('p','',`一時攻撃力 +${c.tempAttack}`));}}
 const help=createKeywordHelp(d.type==='minion'?(board?liveKeywords:d.keywords):[]);if(help){help.children[0]?.setAttribute('data-inspector-control','help');help.open=restoreHelp?previousHelpOpen:state.selected===priorSelected&&!!state.help?.open;nodes.push(help);}state.help=help;
 info.replaceChildren(...nodes);}
 const retained=previous==null?-1:list.findIndex(x=>x.c.instanceId===previous);if(previous!=null&&retained<0)details.open=false;select.value=String(retained<0?0:retained);select.onchange=()=>{if(!interactive())return;if(details.open)show();else select.value=String(acceptedIndex);};show(retained>=0,!lazy||details.open);details.ontoggle=()=>{if(interactive()&&details.open&&!painted)show();};pane.append(zoneNav,select,nav,zonePosition,info);details.append(pane);details.openCard=(id,{focus=false}={})=>{if(!interactive()||typeof id!=='string')return false;const i=list.findIndex(x=>x.c.instanceId===id);if(i<0)return false;select.value=String(i);show();details.open=true;if(focus)summary.focus?.({preventScroll:true});return true;};return details;
}

// Restore scroll and focus only for the same room/match/seat and visible card.
// No delayed callbacks: detached DOM cannot move focus in another screen.
export function captureBattleInspector(root){
 const details=root.querySelector?.('.battle-inspector[open]');
 const key=details?.getAttribute?.('data-inspector-key');
 const selected=details?.getAttribute?.('data-inspector-selected');
 if(!key||!selected)return ()=>{};
 const pane=details.querySelector('.inspector-pane'),top=pane?.scrollTop||0;
 const field=document.activeElement;
 const control=details.contains(field)?field?.getAttribute?.('data-inspector-control'):null;
 return ()=>{
  const next=root.querySelector?.('.battle-inspector');
  if(next?.getAttribute('data-inspector-key')!==key)return;
  const summary=next.querySelector('summary');
  if(!next.open||next.getAttribute('data-inspector-selected')!==selected){if(control)summary?.focus({preventScroll:true});return;}
  const target=control&&Array.from(next.querySelectorAll('[data-inspector-control]')).find(e=>e.getAttribute('data-inspector-control')===control&&!e.disabled);
  if(control)(target||summary)?.focus({preventScroll:true});
  const newPane=next.querySelector('.inspector-pane');if(newPane)newPane.scrollTop=top;
 };
}
