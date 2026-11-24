// Presentation only. No card definitions, image fetching or battle actions are changed here.
import {description,KEYWORD_LABELS} from './cards.js';
import {effectiveAttack,effectiveCost,hasKeyword,hasDivineShield,hasStealth,attackLimit} from './engine.js';
const TYPES=Object.freeze({minion:'ミニオン',spell:'スペル',secret:'秘策'});
function span(cls,text){const n=document.createElement('span');n.className=cls;n.textContent=text;return n;}
export function appendCardFace(parent,d,instance,art){
 const cost=span('cost',`◆ ${effectiveCost(d,instance)}`);cost.setAttribute('aria-label',`マナ ${effectiveCost(d,instance)}`);
 parent.append(cost,span('name',d.name),span('card-kind',TYPES[d.type]));
 // CSS-only emblem keeps empty or failed artwork from looking broken, without network requests.
 const emblem=span('card-emblem','');emblem.setAttribute('aria-hidden','true');emblem.hidden=!!art;parent.append(emblem);
 if(art){const img=document.createElement('img');img.className='card-art';img.alt='';img.decoding='async';img.onerror=()=>{img.hidden=true;emblem.hidden=false;};img.src=art;parent.append(img);}
 parent.append(span('desc',instance.silenced?'沈黙中':description(d)));
 if(d.type==='minion'){
  const attack=effectiveAttack(d,instance),health=instance.currentHealth??d.maxHealth;
  const stats=span('stats',`${attack} / `);stats.setAttribute('aria-label',`攻撃力 ${attack}、体力 ${health}`);stats.append(span('life',String(health)));parent.append(stats);
 }
}

// Identical live status display for local and network boards.
export function appendBoardStatus(parent,d,c){
 if(d.type!=='minion')return;
 if(hasKeyword(d,c,'divineShield'))parent.append(span(hasDivineShield(d,c)?'shield-active':'shield-spent',hasDivineShield(d,c)?'盾：有効':'盾：消費済み'));
 if(hasKeyword(d,c,'stealth'))parent.append(span(hasStealth(d,c)?'stealth-active':'stealth-spent',hasStealth(d,c)?'潜伏：有効':'潜伏：解除済み'));
 if(hasKeyword(d,c,'windfury'))parent.append(span('attack-count',`攻撃 ${c.attacksUsed}/${attackLimit(d,c)}`));
 if(c.grantedKeywords?.length)parent.append(span('muted',c.grantedKeywords.map(k=>`${KEYWORD_LABELS[k]}（付与）`).join('・')));
 if(c.tempAttack)parent.append(span('temp-attack',`一時 +${c.tempAttack}`));
}
