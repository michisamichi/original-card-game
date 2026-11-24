// Local, read-only checks. Never connect, reveal credentials or write storage.
export function firebaseConfigStatus(config){
 if(config==null)return 'unconfigured';
 const nonempty=v=>typeof v==='string'&&v.trim().length>0;
 return config&&['projectId','apiKey','appId'].every(k=>nonempty(config[k]))&&typeof config.databaseURL==='string'&&/^https:\/\/[a-z0-9-]+(?:\.firebaseio\.com|\.[a-z0-9-]+\.firebasedatabase\.app)\/?$/.test(config.databaseURL)?'configured':'invalid';
}
export function diagnosticRows({config,storageError='',env=globalThis}={}){
 const check=fn=>{try{return !!fn();}catch{return false;}};
 const state=firebaseConfigStatus(config);
 return [
 ['Firebase設定',state==='configured'?'形式確認済み（実接続未確認）':state==='unconfigured'?'未設定：新ゲーム専用の設定が必要':'設定形式不正'],
 ['端末保存',storageError?'読込エラー：既存データ保護中':check(()=>env.localStorage&&typeof env.localStorage.getItem==='function')?'読込機能あり（書込未確認）':'利用不可'],
 ['通信機能',check(()=>typeof env.fetch==='function'&&typeof env.AbortController==='function')?'利用可能':'利用不可'],
 ['乱数生成',check(()=>typeof env.crypto?.getRandomValues==='function')?'利用可能':'利用不可'],
 ['ネットワーク',env.navigator?.onLine===false?'オフライン':'接続状態は未確認']
 ];
}
export function renderDiagnostics(options){const wrap=document.createElement('details');wrap.className='diagnostic-panel';const summary=document.createElement('summary');summary.textContent='動作環境・設定診断';wrap.append(summary);for(const [name,status] of diagnosticRows(options)){const row=document.createElement('p');row.textContent=`${name}：${status}`;wrap.append(row);}const note=document.createElement('p');note.className='muted';note.textContent='端末内の形式確認のみ。Firebase認証・アクセス制御・実通信は別途検証が必要です。';wrap.append(note);return wrap;}
