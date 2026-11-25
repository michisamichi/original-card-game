// A scroll offset belongs to one visible hand, never to another match or seat.
export function captureHandScroll(root,view){
 const hand=root.querySelector?.('.hand');
 const key=hand?.getAttribute?.('data-hand-key');
 const sameView=root.className==='view-'+view;
 const offset=key&&sameView?hand.scrollLeft:0;
 return ()=>{const next=root.querySelector?.('.hand');if(!next)return;next.scrollLeft=key&&sameView&&Number.isFinite(offset)&&next.getAttribute?.('data-hand-key')===key?Math.max(0,offset):0;};
}
