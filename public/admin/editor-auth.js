
const EditorAuth=(()=>{
  const trip=(window.AdminTrip?.trip||new URLSearchParams(location.search).get('trip')||'bruessel-2026').toLowerCase();
  const withTrip=path=>`${path}${path.includes('?')?'&':'?'}trip=${encodeURIComponent(trip)}`;
  let cfg,app,account,access,tokenValue;
  async function init(){
    cfg=await fetch(withTrip('/api/media/config'),{cache:'no-store'}).then(r=>r.json());
    app=new msal.PublicClientApplication({
      auth:{clientId:cfg.clientId,authority:'https://login.microsoftonline.com/'+cfg.tenantId,redirectUri:cfg.redirectUri,navigateToLoginRequestUrl:false},
      cache:{cacheLocation:'sessionStorage',storeAuthStateInCookie:false},system:{allowNativeBroker:false}
    });
    await app.initialize();account=app.getAllAccounts()[0]||null;
    if(account)await ensure();
  }
  async function token(){
    if(tokenValue)return tokenValue;
    if(!account){const x=await app.loginPopup({scopes:['User.Read'],prompt:'select_account'});account=x.account||app.getAllAccounts()[0]}
    try{tokenValue=(await app.acquireTokenSilent({scopes:['User.Read'],account})).accessToken}
    catch{tokenValue=(await app.acquireTokenPopup({scopes:['User.Read'],account})).accessToken}
    return tokenValue;
  }
  async function ensure(){
    const tk=await token();const r=await fetch(withTrip('/api/access/me'),{headers:{authorization:'Bearer '+tk},cache:'no-store'});const d=await r.json();
    if(!r.ok||!d.access||!['admin','teacher'].includes(d.access.role))throw new Error(d.message||'Kein Zugriff.');
    access=d.access;return access;
  }
  async function api(url,options={}){
    await ensure();const tk=await token();const headers={...(options.headers||{}),authorization:'Bearer '+tk};
    if(options.body&&!headers['content-type'])headers['content-type']='application/json';
    const r=await fetch(withTrip(url),{...options,headers,cache:'no-store'});const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.message||`Fehler ${r.status}`);return d;
  }
  return {init,ensure,api,trip,get config(){return cfg},get access(){return access}};
})();
