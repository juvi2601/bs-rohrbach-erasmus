(() => {
  const KEY='bsr-theme';
  const root=document.documentElement;
  const media=window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function preferred(){
    const saved=localStorage.getItem(KEY);
    if(saved==='dark'||saved==='light') return saved;
    return media&&media.matches ? 'dark' : 'light';
  }
  function apply(theme){
    root.dataset.theme=theme;
    root.style.colorScheme=theme;
    document.querySelectorAll('[data-theme-toggle]').forEach(btn=>{
      const dark=theme==='dark';
      btn.textContent=dark?'☀️':'🌙';
      btn.setAttribute('aria-label',dark?'Hellen Modus aktivieren':'Dunklen Modus aktivieren');
      btn.setAttribute('title',dark?'Heller Modus':'Dunkler Modus');
      btn.setAttribute('aria-pressed',String(dark));
    });
  }
  function toggle(){
    const next=root.dataset.theme==='dark'?'light':'dark';
    localStorage.setItem(KEY,next); apply(next);
  }
  apply(preferred());

  document.addEventListener('DOMContentLoaded',()=>{
    let host=document.querySelector('.header-actions')||document.querySelector('.top-actions')||document.querySelector('.upload-header');
    if(!host) return;
    if(host.querySelector('[data-theme-toggle]')) return;
    const btn=document.createElement('button');
    btn.type='button'; btn.className='theme-toggle'; btn.dataset.themeToggle='';
    btn.addEventListener('click',toggle);
    if(host.classList.contains('upload-header')){
      const back=host.querySelector('.back-link');
      back ? host.insertBefore(btn,back) : host.appendChild(btn);
    } else {
      host.insertBefore(btn,host.firstChild);
    }
    apply(root.dataset.theme||preferred());
  });

  if(media && media.addEventListener){
    media.addEventListener('change',()=>{ if(!localStorage.getItem(KEY)) apply(preferred()); });
  }
})();