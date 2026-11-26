import {bindSearchInput} from './search-input.js';
// Read-only public history. Never resolve cards from either hand, deck or secrets.
import {CLASS_SKILLS} from './class-skills.js';
import {CATALOG,KEYWORD_LABELS} from './cards.js';
import {TIMING_LABELS} from './effects.js';
export function battleLogRows(match,definition,{seat}={}){
 const visible=new Map();for(const p of match.players||[])for(const c of [...(p.board||[]),...(p.grave||[])])visible.set(c.instanceId,c.cardId);
 const name=id=>id&&definition(id)?.name||'カード';
 const who=i=>seat===0||seat===1?(i===seat?'自分':'相手'):`P${i+1}`;
 const target=(seat,id)=>id==='hero'||id===undefined?`${who(seat)}のHP`:visible.has(id)?name(visible.get(id)):`${who(seat)}のミニオン`;
 return (match.events||[]).slice(-64).flatMap(e=>{let text;const p=who(e.seat),n=()=>name(e.cardId);switch(e.type){
 case 'skill':text=`${p}：スキル ${CLASS_SKILLS[e.classId]?.name??''}`;break;
 case 'armorChange':text=`${p}：装甲 ${e.amount>=0?'+':''}${e.amount}`;break;
 case 'manaChange':text=`${p}：マナ ${e.mana>=0?'+':''}${e.mana} ／ 最大マナ ${e.maxMana>=0?'+':''}${e.maxMana}`;break;
 case 'costChange':text=`${p}：手札${e.count}枚のコスト${e.direction==='down'?'減少':'増加'}`;break;
 case 'silence':text=`${n()}：沈黙`;break;
 case 'transform':text=`${n()}に変身`;break;
 case 'setStat':text=`${n()}：${e.stat==='attack'?'攻撃力':'体力'}を${e.amount}に変更`;break;
 case 'turn':text=`ターン ${e.turn}：${p}`;break;
 case 'specialSummon':text=`${p}：${n()}を特殊召喚`;break;
 case 'revive':text=`${p}：${n()}を蘇生`;break;
 case 'recover':text=`${p}：${n()}を墓地から回収`;break;
 case 'returnHand':text=`${n()}を手札に戻す`;break;
 case 'fetch':text=`${p}：山札からカードを取得`;break;
 case 'discard':text=`${p}：${n()}を破棄`;break;
 case 'generate':text=`${p}：カードを生成`;break;
 case 'draw':text=`${p}：ドロー`;break;
 case 'burn':text=`${p}：手札上限で${n()}を破棄`;break;
 case 'secretSet':text=`${p}：秘策を設置`;break;
 case 'secretReveal':text=`${n()}：秘策発動`;break;
 case 'play':text=`${p}：${n()}を使用`;break;
 case 'attack':text=`${target(e.seat,e.attacker)} → ${target(1-e.seat,e.target)}：攻撃`;break;
 case 'attackCancelled':text='攻撃中止';break;
 case 'damage':text=`${target(e.seat,e.target)}：${e.amount} ダメージ`;break;
 case 'heal':text=`${target(e.seat,e.target)}：${e.amount} 回復`;break;
 case 'lifesteal':text=`${p}：生命奪取で${e.amount}回復`;break;
 case 'death':text=`${n()}が死亡`;break;
 case 'destroy':text=`${n()}：効果で破壊`;break;
 case 'poisonous':text=`${n()}：猛毒で破壊`;break;
 case 'shieldBroken':text=`${n()}：聖なる盾で${e.prevented}ダメージ無効`;break;
 case 'stealthBroken':text=`${n()}：潜伏解除`;break;
 case 'keywordGranted':text=`${n()}：${KEYWORD_LABELS[e.keyword]||'特殊能力'}を付与`;break;
 case 'tempBuff':text=`${target(e.seat,e.target)}：攻撃力+${e.attack}（ターン終了まで）`;break;
 case 'tempExpired':text=`${target(e.seat,e.target)}：一時強化終了`;break;
 case 'buff':text=`${target(e.seat,e.target)}：攻撃力+${e.attack} / 体力+${e.health}`;break;
 case 'weaken':text=`${target(e.seat,e.target)}：攻撃力-${e.attack} / 体力-${e.health}`;break;
 case 'ability':text=`${n()}：${TIMING_LABELS[e.when]||'自動'}効果`;break;
 case 'abilityFollowUp':text=`${n()}：追加効果`;break;
 case 'abilitySkipped':text='対象なし：効果不発';break;
 case 'finish':text=e.winner===null?'対戦終了：引き分け':`対戦終了：${who(e.winner)} 勝利`;break;
 default:return [];
 }return [{type:e.type,text}];});
}
const el=(tag,cls,text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=text;return e;};
// Filter only the already-public, bounded history. No state or transport changes.
const combat=new Set(['attack','attackCancelled','damage','heal','lifesteal','death','destroy','poisonous','shieldBroken','stealthBroken']);
const category=type=>combat.has(type)?'combat':type==='turn'||type==='finish'?'turns':'cards';
// The compact history uses only explicitly public played/revealed cards.
// A set secret, a draw, and any unrecognized event must never resolve a card ID.
export function recentPublicCards(events,definition,seat){
 if(seat!==0&&seat!==1)return [];
 const result=[];for(let i=events.length-1;i>=0&&result.length<2;i--){const e=events[i];
  if((e.seat!==0&&e.seat!==1)||!['play','secretReveal','specialSummon','revive','transform','returnHand','recover','discard','burn','death'].includes(e.type)||typeof e.cardId!=='string')continue;
  if(e.type==='death'&&(typeof e.instanceId!=='string'||!/^([01]):(0|[1-9][0-9]?)$/.test(e.instanceId)||!e.instanceId.startsWith(`${e.seat}:`)))continue;
  const d=definition(e.cardId);if(!d||typeof d.name!=='string'||!d.name.trim()||(e.type==='secretReveal'?d.type!=='secret':e.type==='play'?!['minion','spell'].includes(d.type):['recover','discard','burn'].includes(e.type)?!['minion','spell','secret'].includes(d.type):d.type!=='minion'))continue;
  result.push({name:d.name,type:d.type,side:e.seat===seat?'自分':'相手',art:Object.hasOwn(CATALOG,e.cardId)?e.cardId:null,...(e.type==='specialSummon'?{label:'特殊召喚'}:e.type==='revive'?{label:'蘇生'}:e.type==='transform'?{label:'変身後'}:e.type==='returnHand'?{label:'手札へ戻る'}:e.type==='recover'?{label:'墓地回収'}:e.type==='discard'?{label:'手札破棄'}:e.type==='burn'?{label:'上限で消失'}:e.type==='death'?{label:'撃破'}:{})});
 }return result;
}
function publicCardStrip(events,definition,seat,onSelect){const cards=recentPublicCards(events,definition,seat);if(!cards.length)return null;
 const strip=el('div','public-card-strip');strip.setAttribute('aria-label','直近の公開カード');strip.append(el('span','public-card-heading','公開カード履歴'));
 for(const c of cards){const entry=el('button','public-card-entry public-card-'+c.type);entry.type='button';entry.onclick=()=>onSelect(c.name);entry.setAttribute('data-history-side',c.side==='自分'?'own':'enemy');if(c.label==='撃破')entry.setAttribute('data-history-defeat','true');if(c.label==='手札へ戻る')entry.setAttribute('data-history-return','true');if(c.label==='墓地回収')entry.setAttribute('data-history-grave','recover');else if(c.label==='手札破棄'||c.label==='上限で消失')entry.setAttribute('data-history-grave','loss');const art=el('span','public-card-art');art.setAttribute('aria-hidden','true');if(c.art)art.setAttribute('data-standard-art',c.art);const info=el('span','public-card-info');info.append(el('span','public-card-side',c.side+'・'+(c.label??{minion:'召喚',spell:'スペル',secret:'秘策発動'}[c.type])),el('span','public-card-name',c.name));entry.append(art,info);entry.setAttribute('title',c.side+'・'+(c.label??{minion:'召喚',spell:'スペル',secret:'秘策発動'}[c.type])+'：'+c.name);entry.setAttribute('aria-label',c.side+'・'+(c.label??{minion:'召喚',spell:'スペル',secret:'秘策発動'}[c.type])+'：'+c.name+'のログを確認');strip.append(entry);}return strip;
}
export function createBattleLog(match,definition,state={},options={}){
 const rows=battleLogRows(match,definition,options),container=el('div','battle-history');
 const categories={all:rows,combat:[],cards:[],turns:[]};for(const row of rows)categories[category(row.type)].push(row);
 const strip=publicCardStrip(match.events||[],definition,options.seat,name=>{if(!current()||binding.isComposing())return;details.open=true;state.filter=filter.value='all';state.query=search.value=name;clearRecovery();update();close.focus?.({preventScroll:true});});if(strip)container.append(strip);
 const recent=el('div','log',rows.slice(-5).map(r=>r.text).join(' ｜ '));container.append(recent);
 const matchKey=options.seat===0||options.seat===1?`${match.matchId}:${options.seat}`:match.matchId;const key=options.scope?`${options.scope}:${matchKey}`:matchKey;
 const same=state.key===key,details=el('details','battle-log-details');details.open=same&&!!state.details?.open;
 // A replaced input cannot keep the native IME session. Preserve only its text,
 // without applying it, in the same open room/match/seat.
 let recovered=details.open&&typeof state.draft==='string'&&state.draft!==(state.query||'');
 const draft=recovered?state.draft:'';if(!recovered)state.draft=null;
 state.key=key;state.details=details;details.setAttribute('data-log-key',key);if(!same){state.filter='all';state.query='';state.scrollTop=0;state.anchor=null;}
 const summary=el('summary','action',`対戦ログ（直近${rows.length}件）`);details.append(summary);
 const pane=el('div','battle-log-pane'),heading=el('div','battle-log-heading'),close=el('button','action','ログを閉じる');close.type='button';const closeLog=()=>{if(!current()||!details.open)return;details.open=false;syncClosedControls();update();summary.focus?.();};close.onclick=closeLog;heading.append(el('h3','','対戦ログ'),close);pane.append(heading);
 const filter=el('select','battle-log-filter');filter.setAttribute('aria-label','対戦ログの絞り込み');
 for(const [value,label] of [['all','すべて'],['combat','戦闘・HP'],['cards','カード・効果'],['turns','ターン・勝敗']]){const opt=el('option','',label);opt.value=value;opt.textContent=`${label}（${categories[value].length}）`;filter.append(opt);}filter.value=state.filter||'all';
 const search=el('input','battle-log-search');search.type='search';search.maxLength=80;search.placeholder='ログ内を検索';search.setAttribute('aria-label','対戦ログ検索');search.setAttribute('data-log-key',key);search.value=recovered?draft:state.query||'';
 const recovery=el('div','battle-log-recovery'),applyDraft=el('button','action','検索を適用');applyDraft.type='button';const recoveryText=el('p','muted','通信更新前の入力を復元しました。必要に応じて修正し、検索を適用してください。');recoveryText.setAttribute('role','status');recovery.append(recoveryText,applyDraft);recovery.hidden=!recovered;
 const count=el('p','muted'),list=el('ol','battle-log-list'),empty=el('p','battle-log-empty','該当するログはありません');
 const reset=el('button','action battle-log-reset','絞り込み解除');reset.type='button';
 const controls=el('div','battle-log-controls');controls.append(filter,reset);
 const latest=el('button','action battle-log-latest','最新へ');latest.type='button';const countBar=el('div','battle-log-countbar');countBar.append(count,latest);
 for(const [control,id] of [[summary,'summary'],[close,'close'],[filter,'filter'],[reset,'reset'],[search,'search'],[latest,'latest'],[applyDraft,'apply']])control.setAttribute('data-log-control',id);
 const current=()=>state.details===details&&details.isConnected!==false;let renderedOpen=details.open;details.onkeydown=e=>{if(e.key==='Escape'&&!e.isComposing&&e.keyCode!==229&&!e.defaultPrevented&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.repeat&&!binding.isComposing()&&current()&&details.open){e.preventDefault();e.stopPropagation?.();closeLog();}};
 const normalize=s=>String(s).normalize('NFKC').toLowerCase();
 // Anchor only uniquely identifiable public rows; duplicate or expired rows fall back to pixel position.
 let displayed=[];const normalizedText=new Map();
 const rowKey=r=>JSON.stringify([r.type,r.text]);
 const uniqueIndex=(rows,key)=>{let found=-1;for(let i=0;i<rows.length;i++)if(rowKey(rows[i])===key){if(found!==-1)return -1;found=i;}return found;};
 const remember=()=>{if(!current()||!details.open)return;const top=list.scrollTop||0;state.scrollTop=top;state.anchor=null;latest.disabled=top<=0;
 if(top<=0||typeof list.getBoundingClientRect!=='function')return;const bounds=list.getBoundingClientRect();if(!bounds.height)return;
 const i=Array.from(list.children).findIndex(child=>child.getBoundingClientRect().bottom>bounds.top+list.clientTop);if(i<0)return;const key=rowKey(displayed[i]);if(uniqueIndex(displayed,key)!==i)return;
 state.anchor={key,offset:list.children[i].getBoundingClientRect().top-bounds.top};};
 const update=(preserve=false,initial=false)=>{if(state.details!==details||!initial&&!current())return;const top=preserve?state.scrollTop||0:0,anchor=preserve?state.anchor:null;const terms=normalize(state.query||'').trim().split(/\s+/).filter(Boolean);const candidates=Object.hasOwn(categories,filter.value)?categories[filter.value]:rows;const filtered=details.open&&terms.length?candidates.filter(r=>{let text=normalizedText.get(r);if(text===undefined){text=normalize(r.text);normalizedText.set(r,text);}return terms.every(t=>text.includes(t));}):candidates;count.textContent=`新しい順・${filtered.length}/${rows.length}件（最大64件）`;reset.disabled=filter.value==='all'&&!search.value&&!state.query;empty.hidden=!details.open||filtered.length>0;list.hidden=details.open&&filtered.length===0;const next=details.open?[...filtered].reverse():[];if(next.length!==displayed.length||next.some((r,i)=>r!==displayed[i])){displayed=next;list.replaceChildren(...displayed.map(r=>el('li',`log-event log-${r.type}`,r.text)));}renderedOpen=details.open;state.scrollTop=top;state.anchor=anchor;latest.disabled=top<=0;list.scrollTop=top;
 // The new view is still detached. Restore the same visible event after layout, if unambiguous.
 if(top&&typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{if(!current()||!details.open||state.scrollTop!==top||state.anchor!==anchor)return;list.scrollTop=top;const i=anchor?uniqueIndex(displayed,anchor.key):-1;if(i>=0&&typeof list.getBoundingClientRect==='function'){const bounds=list.getBoundingClientRect();if(bounds.height)list.scrollTop+=list.children[i].getBoundingClientRect().top-bounds.top-anchor.offset;}remember();});};
 list.onscroll=remember;latest.onclick=()=>{if(current()&&details.open&&!latest.disabled){list.scrollTop=0;state.scrollTop=0;state.anchor=null;latest.disabled=true;}};
 filter.onchange=()=>{if(current()&&details.open&&Object.hasOwn(categories,filter.value)&&filter.value!==(state.filter||'all')){state.filter=filter.value;update();}else if(current()&&!details.open)filter.value=state.filter||'all';};const clearRecovery=()=>{state.draft=null;recovered=false;recovery.hidden=true;reset.disabled=filter.value==='all'&&!search.value&&!state.query;};const binding=bindSearchInput(search,{current:()=>current()&&details.open,read:()=>state.query||'',apply:value=>{state.query=value;update();},settled:clearRecovery,draft:value=>{state.draft=value;}});applyDraft.onclick=()=>{if(current()&&details.open&&recovered&&binding.commit())search.focus?.();};reset.onclick=()=>{if(current()&&details.open&&!reset.disabled&&!binding.isComposing()){state.filter=filter.value='all';state.query=search.value='';clearRecovery();update();}};const syncClosedControls=()=>{binding.cancelComposition();search.value=state.query||'';filter.value=state.filter||'all';clearRecovery();};details.ontoggle=()=>{if(!current()||details.open===renderedOpen)return;syncClosedControls();update();};update(same&&details.open,true);pane.append(controls,search,recovery,countBar,empty,list);details.append(pane);container.append(details);return container;
}

// Preserve focus for the same public log only, including non-search controls.
export function captureBattleLogFocus(root){
 const field=document.activeElement,details=root.querySelector?.('.battle-log-details');
 const key=details?.getAttribute?.('data-log-key'),control=field?.getAttribute?.('data-log-control');
 if(!key||!control||!details.contains?.(field))return ()=>{};
 const start=control==='search'?field.selectionStart:null,end=control==='search'?field.selectionEnd:null,direction=control==='search'?field.selectionDirection:null;
 return ()=>{const next=root.querySelector?.('.battle-log-details');if(next?.getAttribute('data-log-key')!==key)return;const target=next.open&&Array.from(next.querySelectorAll('[data-log-control]')).find(e=>e.getAttribute('data-log-control')===control&&!e.disabled&&(control!=='apply'||!e.parentElement.hidden));const summary=next.querySelector('summary');const focus=target||summary;focus?.focus({preventScroll:true});if(target&&control==='search'&&start!=null&&end!=null)target.setSelectionRange(start,end,direction||'none');};
}
