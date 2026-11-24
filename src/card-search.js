import {description} from './cards.js';
const normalize=value=>String(value).normalize('NFKC').toLowerCase();
// Every whitespace-separated term must be present; no regex or executable input.
export function createCardSearch(query=''){
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 if(!terms.length)return ()=>true;
 return card=>{
 const text=normalize(`${card.name} ${description(card)}`);
 return terms.every(term=>text.includes(term));};
}
export function matchesCardSearch(card,query=''){return createCardSearch(query)(card);}
export function filterMana(card,mana){return mana==='all'||String(card.manaCost)===mana;}
export function deckUsage(decks,id){return decks.flatMap(d=>{const count=d.cards.reduce((n,c)=>n+(c===id?1:0),0);return count?[{name:d.name,count}]:[];});}

// Build the adoption index once per list update, not once per card.
export function buildDeckUsage(decks){const usage=new Map();for(const d of decks){const counts=new Map();for(const id of d.cards)counts.set(id,(counts.get(id)||0)+1);for(const [id,count] of counts){if(!usage.has(id))usage.set(id,[]);usage.get(id).push({name:d.name,count});}}return usage;}
