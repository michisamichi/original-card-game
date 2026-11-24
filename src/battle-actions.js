// Index the already validated actions once per render; never generate new actions.
export function indexBattleActions(actions,selection){
 const byType={play:new Map(),attack:new Map()},targets=new Map();let end;
 for(const a of actions){if(a.type==='end'){end=a;continue;}const map=byType[a.type];if(!map)continue;const id=a.card||a.attacker;if(!map.has(id))map.set(id,[]);map.get(id).push(a);if(selection?.type===a.type&&selection.id===id&&a.target!==undefined)targets.set(a.target,a);}
 return {forCard:(type,id)=>byType[type]?.get(id)||[],target:id=>targets.get(id),end,hasTargets:targets.size>0};
}

// Use only legal targets and the player's visible cards for a concise touch hint.
export function selectionHint(index,selection,definition,player){
 if(!selection)return '';const list=index.forCard(selection.type,selection.id);const c=[...(player.hand||[]),...(player.board||[])].find(c=>c.instanceId===selection.id);const name=c?definition(c.cardId)?.name:'';const n=list.filter(a=>a.target!==undefined).length;return n?`${name||'カード'}：対象を選択（${n}件）／再タップで解除`:'';
}
