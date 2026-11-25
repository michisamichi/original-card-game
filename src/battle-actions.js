// Index the already validated actions once per render; never generate new actions.
const NO_ACTIONS=Object.freeze([]);
export function indexBattleActions(actions,selection){
 const byType={play:new Map(),attack:new Map()},targets=new Map();let end;
 for(const a of actions){if(a.type==='end'){end=a;continue;}const map=byType[a.type];if(!map)continue;const id=a.card||a.attacker;if(!map.has(id))map.set(id,[]);map.get(id).push(a);if(selection?.type===a.type&&selection.id===id&&a.target!==undefined)targets.set(a.target,a);}
 return {forCard:(type,id)=>byType[type]?.get(id)||NO_ACTIONS,target:id=>targets.get(id),end,hasTargets:targets.size>0};
}

// Use only legal targets and the player's visible cards for a concise touch hint.
export function selectionHint(index,selection,definition,player){
 if(!selection)return '';const list=index.forCard(selection.type,selection.id);const c=(player.hand||NO_ACTIONS).find(c=>c.instanceId===selection.id)||(player.board||NO_ACTIONS).find(c=>c.instanceId===selection.id);const name=c?definition(c.cardId)?.name:'';let n=0;for(const a of list)if(a.target!==undefined)n++;return n?`${name||'カード'}：対象を選択（${n}件）／再タップで解除`:'';
}
