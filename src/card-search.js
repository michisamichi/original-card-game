import {description} from './cards.js';
const normalize=value=>String(value).normalize('NFKC').toLowerCase();
// Every whitespace-separated term must be present; no regex or executable input.
export function createCardSearch(query='',cache=null){
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 if(!terms.length)return ()=>true;
 return card=>{
 let entry=cache?.get(card);if(!entry){entry={name:normalize(card.name)};cache?.set(card,entry);}const remaining=terms.filter(term=>!entry.name.includes(term));
 if(!remaining.length)return true;
 const text=entry.text??(entry.text=normalize(description(card)));
 return remaining.every(term=>text.includes(term));};
}
// Lifetime is one read-only catalog render; rebuilding after a store write discards it.
export function createCardSearchIndex(){const cache=new WeakMap();return query=>createCardSearch(query,cache);}
export function matchesCardSearch(card,query=''){return createCardSearch(query)(card);}
export function filterMana(card,mana){return mana==='all'||String(card.manaCost)===mana;}
export function deckUsage(decks,id){return decks.flatMap(d=>{const count=d.cards.reduce((n,c)=>n+(c===id?1:0),0);return count?[{name:d.name,count}]:[];});}

// Build the adoption index once per list update, not once per card.
export function buildDeckUsage(decks){const usage=new Map();for(const d of decks){const counts=new Map();for(const id of d.cards)counts.set(id,(counts.get(id)||0)+1);for(const [id,count] of counts){if(!usage.has(id))usage.set(id,[]);usage.get(id).push({name:d.name,count});}}return usage;}

// Sort a copy so a view cannot mutate its source collection. Stable ID tie-break.
export function sortCards(cards,order="manaAsc"){return [...cards].sort((a,b)=>(order==="name"?a.name.localeCompare(b.name,"ja"):order==="manaDesc"?b.manaCost-a.manaCost:a.manaCost-b.manaCost)||a.id.localeCompare(b.id));}

// Only reuse a list within the same immutable catalog generation.
export function sameCardOrder(previous,next){return previous!==null&&previous.length===next.length&&previous.every((card,i)=>card===next[i]);}
