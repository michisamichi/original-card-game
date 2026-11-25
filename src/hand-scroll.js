// A scroll offset belongs to one visible hand, never to another match or seat.
export function captureHandScroll(root,view){
 const hand=root.querySelector?.('.hand');
 const key=hand?.getAttribute?.('data-hand-key');
 const sameView=root.className==='view-'+view;
 const offset=key&&sameView?hand.scrollLeft:0;
 return ()=>{
  // A delayed restore must not change a hand in another view.
  if(root.className!=='view-'+view)return;
  const next=root.querySelector?.('.hand');if(!next)return;
  if(!key||!sameView||!Number.isFinite(offset)||next.getAttribute?.('data-hand-key')!==key){next.scrollLeft=0;return;}
  const limit=next.scrollWidth-next.clientWidth;
  next.scrollLeft=Math.min(Math.max(0,offset),Number.isFinite(limit)?Math.max(0,limit):Infinity);
 };
}
