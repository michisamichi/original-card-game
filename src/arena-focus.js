// Restore focus only to the same still-enabled control in the same rendered match.
// Never move focus across rooms, seats, zones or navigation, and never activate a control.
export function captureArenaFocus(root,view){
 const arena=root.querySelector?.('.tabletop-arena');
 const key=arena?.getAttribute?.('data-arena-key'),field=globalThis.document?.activeElement;
 if(!key||root.className!=='view-'+view||!field||!arena.contains?.(field))return ()=>{};
 const control=field.getAttribute?.('data-arena-control');
 if(!control)return ()=>{};
 return ()=>{
  if(root.className!=='view-'+view)return;
  const next=root.querySelector?.('.tabletop-arena');
  if(next?.getAttribute?.('data-arena-key')!==key)return;
  // Do not steal focus from another active control (e.g. an open reading panel).
  const active=globalThis.document?.activeElement;
  if(active&&active!==document.body&&active!==document.documentElement&&active!==field)return;
  const target=Array.from(next.querySelectorAll('[data-arena-control]')).find(e=>e.getAttribute('data-arena-control')===control&&!e.disabled);
  target?.focus?.({preventScroll:true});
 };
}

// Escape belongs to the focused tabletop control, never a text field or reading panel.
export function isArenaEscape(e){
 return e.key==='Escape'&&!e.defaultPrevented&&!e.isComposing&&e.keyCode!==229&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.repeat&&!!e.target?.getAttribute?.('data-arena-control')&&!e.target?.isContentEditable;
}
