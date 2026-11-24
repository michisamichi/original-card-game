// Read-only view of cards already visible to the current player. No game actions.
import {description,KEYWORD_LABELS} from './cards.js';
import {effectiveCost,effectiveAttack,effectiveMaxHealth,hasDivineShield,hasStealth,hasKeyword,attackLimit} from './engine.js';
const element=(tag,cls='',text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=text;return e;};
export function createBattleInspector(groups,definition,{artFor=()=>null,state={},key=""}={}){
 const details=element('details','battle-inspector');
 const same=state.key===key,previous=same?state.selected:null;details.open=same&&!!state.details?.open;state.key=key;state.details=details;state.selected=null;
 const summary=element('summary','action','カード詳細');details.append(summary);
 const pane=element('div','inspector-pane');const close=element('button','action','閉じる');close.type='button';close.onclick=()=>{details.open=false;};
 pane.append(close,element('h3','','カード詳細（閲覧のみ）'));
 const list=groups.flatMap(({label,cards,board=false},group)=>cards.map(c=>({label,c,board,group,d:definition(c.cardId)})));
 if(!list.length){pane.append(element('p','muted','表示できるカードがありません'));details.append(pane);return details;}
 const select=element('select');select.setAttribute('aria-label','詳細を見るカード');
 list.forEach((entry,i)=>{const opt=element('option','',`${entry.label}：${entry.d.name}`);opt.value=String(i);select.append(opt);});
 const info=element('div','inspector-info');
 const nav=element('div','inspector-navigation'),prev=element('button','action','前のカード'),next=element('button','action','次のカード'),position=element('span','muted');prev.type=next.type='button';nav.append(prev,position,next);
 function step(delta){const n=Number(select.value)+delta;if(n>=0&&n<list.length){select.value=String(n);show();}}prev.onclick=()=>step(-1);next.onclick=()=>step(1);
 function show(){const entry=list[Number(select.value)];if(!entry)return;const {c,d,board,group}=entry;state.selected=c.instanceId??null;const i=Number(select.value);prev.disabled=i===0;next.disabled=i===list.length-1;position.textContent=`${i+1} / ${list.length}`;const nodes=[element('h3','',d.name),element('p','inspector-mana',`マナ ${effectiveCost(d,c)}`),element('p','',c.silenced?'沈黙中（元の効果は無効）':description(d))];
 const art=artFor(group,c);if(art){const img=element('img','inspector-art');img.alt='';img.decoding='async';img.onerror=()=>{img.hidden=true;};img.src=art;nodes.splice(1,0,img);}
 if(d.type==='minion'){nodes.push(element('p','inspector-stats',`攻撃力 ${effectiveAttack(d,c)} ／ 体力 ${c.currentHealth??d.maxHealth}${board?` / ${effectiveMaxHealth(d,c)}`:''}`));if(board){nodes.push(element('p','muted',`攻撃回数 ${c.attacksUsed}/${attackLimit(d,c)}`));if(hasKeyword(d,c,'divineShield'))nodes.push(element('p','',hasDivineShield(d,c)?'聖なる盾：有効':'聖なる盾：消費済み'));if(!c.silenced&&d.keywords.includes('stealth'))nodes.push(element('p','',hasStealth(d,c)?'潜伏：有効':'潜伏：解除済み'));if(c.grantedKeywords?.length)nodes.push(element('p','',`付与：${c.grantedKeywords.map(k=>KEYWORD_LABELS[k]).join('・')}`));if(c.tempAttack)nodes.push(element('p','',`一時攻撃力 +${c.tempAttack}`));}}
 info.replaceChildren(...nodes);}
 const retained=previous==null?-1:list.findIndex(x=>x.c.instanceId===previous);select.value=String(retained<0?0:retained);select.onchange=show;show();pane.append(select,nav,info);details.append(pane);return details;
}
