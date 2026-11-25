// Search-only binding. Do not interrupt composition or rebuild for duplicate
// input after compositionend. The caller owns the committed query (and reset).
export function bindSearchInput(field,{current=()=>true,read,apply,settled=()=>{},draft=()=>{}}){
 let composing=false;
 const commit=()=>{if(composing||!current()||field.isConnected===false)return false;if(field.value!==read())apply(field.value);settled();return true;};
 field.addEventListener?.('compositionstart',()=>{if(current()&&field.isConnected!==false)composing=true;});
 field.addEventListener?.('compositionend',()=>{composing=false;commit();});
 field.oninput=e=>{if(!current()||field.isConnected===false)return;if(e?.isComposing)composing=true;if(composing){draft(field.value);return;}commit();};
 return {commit,isComposing:()=>composing,cancelComposition:()=>{composing=false;}};
}
