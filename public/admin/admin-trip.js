(()=>{
  const KEY='bsr-admin-active-trip';
  const params=new URLSearchParams(location.search);
  const requested=(params.get('trip')||'').trim().toLowerCase();
  let stored='';try{stored=(localStorage.getItem(KEY)||'').trim().toLowerCase()}catch{}
  const trip=requested||stored||'bruessel-2026';
  try{localStorage.setItem(KEY,trip)}catch{}
  const q=path=>{
    const u=new URL(path,location.origin);
    u.searchParams.set('trip',trip);
    return u.pathname+u.search+u.hash;
  };
  const resource=resource=>{
    if(trip==='bruessel-2026')return `/content/${resource}.json`;
    return `/api/trips/public-resource?trip=${encodeURIComponent(trip)}&resource=${encodeURIComponent(resource)}`;
  };
  async function config(){
    const r=await fetch(`/api/media/config?trip=${encodeURIComponent(trip)}`,{cache:'no-store'});
    const d=await r.json();if(!r.ok)throw new Error(d.message||'Reise konnte nicht geladen werden.');return d;
  }
  async function routes(){
    const r=await fetch('/api/trips/routes',{cache:'no-store'});const d=await r.json();
    return (d.routes||[]).filter(x=>x.published!==false&&x.status!=='draft');
  }
  async function apply(){
    const cfg=await config(),label=cfg.tripLabel||cfg.tripTitle||trip;
    document.querySelectorAll('[data-trip-label]').forEach(x=>x.textContent=label);
    document.querySelectorAll('[data-trip-link]').forEach(x=>x.href=q(x.getAttribute('data-trip-link')));
    document.querySelectorAll('[data-trip-website]').forEach(x=>x.href=cfg.publicUrl||cfg.backUrl||'/');
    const sel=document.getElementById('activeTripSelect');
    if(sel){
      const rs=await routes();sel.innerHTML=rs.map(x=>`<option value="${x.id}">${x.title||x.id}</option>`).join('');
      if(![...sel.options].some(o=>o.value===trip)){const o=document.createElement('option');o.value=trip;o.textContent=label;sel.prepend(o)}
      sel.value=trip;sel.onchange=()=>{try{localStorage.setItem(KEY,sel.value)}catch{}const u=new URL(location.href);u.searchParams.set('trip',sel.value);location.href=u.pathname+u.search+u.hash};
    }
    return cfg;
  }
  window.AdminTrip={trip,q,resource,config,routes,apply,key:KEY};
})();