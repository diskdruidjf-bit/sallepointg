'use strict';
document.querySelectorAll('.mobile-menu-toggle').forEach(button=>{
  const links=document.getElementById(button.getAttribute('aria-controls'));
  const close=()=>{links.classList.remove('nav-open');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Ouvrir le menu');};
  button.addEventListener('click',()=>{const open=!links.classList.contains('nav-open');links.classList.toggle('nav-open',open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');});
  links.addEventListener('click',event=>{if(event.target.closest('a'))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
});
