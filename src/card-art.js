// Presentation only; never sent to the rules engine.
export const ART_MAX_EDGE=320, ART_MAX_CHARS=48000, ART_TOTAL_CHARS=1800000, ART_INPUT_BYTES=12*1024*1024;
const PREFIX='data:image/jpeg;base64,';
export function validateArt(value){
 if(typeof value!=='string'||value.length>ART_MAX_CHARS||!value.startsWith(PREFIX))throw Error('カード画像の形式・容量が不正');
 const encoded=value.slice(PREFIX.length);let bytes;
 try{bytes=atob(encoded);if(btoa(bytes)!==encoded)throw Error();}catch{throw Error('画像のBase64が不正');}
 const b=i=>bytes.charCodeAt(i),n=bytes.length;
 if(n<12||b(0)!==255||b(1)!==216||b(n-2)!==255||b(n-1)!==217)throw Error('JPEG画像が不正');
 // Bounded header and dimension check, not a full JPEG decoder.
 let i=2,dimensions=false;
 while(i<n-2){if(b(i++)!==255)break;while(b(i)===255)i++;const marker=b(i++);if(marker===218){if(dimensions&&i+2<n){const len=b(i)*256+b(i+1);if(len>=6&&i+len<n-2)return value;}break;}
  if(i+2>n)break;const len=b(i)*256+b(i+1);if(len<2||i+len>n-2)break;
  if([192,193,194].includes(marker)){if(dimensions||len<8)break;const h=b(i+3)*256+b(i+4),w=b(i+5)*256+b(i+6);if(!w||!h||w>ART_MAX_EDGE||h>ART_MAX_EDGE)break;dimensions=true;}
  i+=len;
 }
 throw Error('JPEG画像の寸法またはヘッダーが不正');
}
export function normalizeArt(raw,cards){
 if(raw===undefined)return {};if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('画像保存形式が不正');
 const ids=new Set(cards.map(c=>c.id)),result={};let total=0;
 for(const [id,value] of Object.entries(raw)){if(!ids.has(id))throw Error('画像のカード参照が不正');result[id]=validateArt(value);total+=value.length;if(total>ART_TOTAL_CHARS)throw Error('画像の合計容量上限を超えています');}
 return result;
}
export function setArt(raw,id,value){const next={...raw};if(value)next[id]=validateArt(value);else delete next[id];return next;}
export async function compressArt(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<=0||file.size>ART_INPUT_BYTES)throw Error('JPEG・PNG・WebP（12MB以下）を選択してください');
 const url=URL.createObjectURL(file);try{
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('画像を読み込めません'));img.src=url;});
  const w=img.naturalWidth,h=img.naturalHeight;if(!w||!h||w*h>40000000)throw Error('画像の画素数が大きすぎます');
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('画像変換を利用できません');
  for(const edge of [ART_MAX_EDGE,256,192,128]){const scale=Math.min(1,edge/Math.max(w,h));canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));ctx.fillStyle='#182536';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   for(const quality of [.8,.65,.5]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=ART_MAX_CHARS)return validateArt(data);}}
  throw Error('画像を容量上限まで圧縮できません');
 }finally{URL.revokeObjectURL(url);}
}
