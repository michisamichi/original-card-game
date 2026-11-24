// Read-only public history. Never resolve cards from either hand, deck or secrets.
import {KEYWORD_LABELS} from './cards.js';
import {TIMING_LABELS} from './effects.js';
export function battleLogRows(match,definition){
 const visible=new Map();for(const p of match.players||[])for(const c of [...(p.board||[]),...(p.grave||[])])visible.set(c.instanceId,c.cardId);
 const name=id=>id&&definition(id)?.name||'カード';
 const who=seat=>`P${seat+1}`;
 const target=(seat,id)=>id==='hero'||id===undefined?`${who(seat)}のHP`:visible.has(id)?name(visible.get(id)):`${who(seat)}のミニオン`;
 return (match.events||[]).slice(-64).flatMap(e=>{let text;const p=who(e.seat),n=()=>name(e.cardId);switch(e.type){
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
export function createBattleLog(match,definition,state={}){
 const rows=battleLogRows(match,definition),container=el('div','battle-history');
 const recent=el('div','log',rows.slice(-5).map(r=>r.text).join(' ｜ '));container.append(recent);
 const details=el('details','battle-log-details');details.open=state.key===match.matchId&&!!state.details?.open;state.key=match.matchId;state.details=details;
 details.append(el('summary','action',`対戦ログ（直近${rows.length}件）`));
 const list=el('ol','battle-log-list');const update=()=>{list.replaceChildren();if(details.open)for(const r of [...rows].reverse())list.append(el('li',`log-event log-${r.type}`,r.text));};details.ontoggle=update;update();
 details.append(el('p','muted','新しい順・最大64件'),list);container.append(details);return container;
}
