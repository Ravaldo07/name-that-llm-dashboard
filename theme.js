/* Apply the saved theme before styles paint; no account or research data here. */
(()=>{
 const key='research.theme',system=matchMedia('(prefers-color-scheme: dark)');
 let preference=null;
 try{const saved=localStorage.getItem(key);if(['light','dark'].includes(saved))preference=saved;}catch{}
 function apply(){
  const dark=preference?preference==='dark':system.matches;
  document.documentElement.dataset.theme=dark?'dark':'light';
  for(const button of document.querySelectorAll('[data-theme-toggle]')){
   button.textContent=dark?'☀ Day mode':'☾ Night mode';
   button.setAttribute('aria-pressed',String(dark));
   button.setAttribute('aria-label',dark?'Switch to day mode':'Switch to night mode');
   button.title=dark?'Switch to day mode':'Switch to night mode';
  }
 }
 apply();
 document.addEventListener('DOMContentLoaded',()=>{
  apply();
  for(const button of document.querySelectorAll('[data-theme-toggle]'))button.addEventListener('click',()=>{
   preference=document.documentElement.dataset.theme==='dark'?'light':'dark';
   try{localStorage.setItem(key,preference);}catch{}
   apply();
  });
 });
 system.addEventListener('change',()=>{if(!preference)apply();});
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null){preference=['light','dark'].includes(event.newValue)?event.newValue:null;apply();}});
})();
