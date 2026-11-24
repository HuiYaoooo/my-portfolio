import whatsapp from './vendor/simple-icons/whatsapp.svg?raw';
import xiaohongshu from './vendor/simple-icons/xiaohongshu.svg?raw';
import instagram from './vendor/simple-icons/instagram.svg?raw';
import linkedin from './vendor/simple-icons/linkedin.svg?raw';
import github from './vendor/simple-icons/github.svg?raw';

// Keep brand silhouettes intact; currentColor gives every mark the same ink.
const brand=svg=>svg.replace('<svg ', '<svg aria-hidden="true" focusable="false" fill="currentColor" ');
const outline=paths=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const icons={
  email:outline('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>'),
  phone:outline('<path d="m8 3 2 4-2.6 2.6a15.4 15.4 0 0 0 7 7L17 14l4 2v3a2 2 0 0 1-2.2 2C9.5 20 4 14.5 3 5.2A2 2 0 0 1 5 3h3Z"/>'),
  location:outline('<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>'),
  whatsapp:brand(whatsapp),xiaohongshu:brand(xiaohongshu),
  instagram:brand(instagram),linkedin:brand(linkedin),github:brand(github),
};

export function addContactIcons(html){
  const template=document.createElement('template');
  template.innerHTML=html;
  template.content.querySelectorAll('[data-contact-icon]').forEach(item=>{
    const svg=icons[item.dataset.contactIcon];
    if(!svg)return;
    const icon=document.createElement('span');
    icon.className='contact-method-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=svg;
    const label=document.createElement('span');label.textContent=item.textContent;
    item.replaceChildren(icon,label);
  });
  return template.innerHTML;
}
