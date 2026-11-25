// Display-only glossary of the current engine's fixed keywords.
import {KEYWORD_LABELS} from './cards.js';
const HELP=Object.freeze({
 taunt:'攻撃対象にできる挑発持ちがいる間、相手は挑発持ちだけを攻撃できる。スペルには適用されない。潜伏中は無効。',
 charge:'召喚したターンから相手ミニオンやヒーローを攻撃できる。',
 rush:'召喚したターンは相手ミニオンだけを攻撃できる。速攻も持つ場合は速攻が優先される。',
 divineShield:'正のダメージを一度だけ無効化する。直接破壊には適用されない。',
 windfury:'1ターンに最大2回攻撃できる。通常の攻撃制限は引き続き適用される。',
 lifesteal:'自身の攻撃・反撃・効果で通したダメージ分、自分のヒーローを回復する（最大HPまで）。',
 poisonous:'自身が正のダメージを通したミニオンを倒す。ヒーローには適用されない。',
 stealth:'相手の攻撃・手動対象選択を受けない。全体・ランダム効果などは対象になり得る。攻撃宣言や自身がダメージを通すと解除される。',
 spellDamage:'場にいる間、自分のスペルによるダメージを+1する。秘策やミニオンの効果には適用されない。'
});
export function keywordHelp(keys){return [...new Set(keys||[])].filter(k=>Object.hasOwn(HELP,k)&&Object.hasOwn(KEYWORD_LABELS,k)).map(k=>({label:KEYWORD_LABELS[k],text:HELP[k]}));}
export function createKeywordHelp(keys){const rows=keywordHelp(keys);if(!rows.length)return null;const details=document.createElement('details');details.className='keyword-help';const summary=document.createElement('summary');summary.textContent='特殊能力の説明';details.append(summary);const list=document.createElement('dl');for(const {label,text} of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=text;list.append(dt,dd);}details.append(list);return details;}
