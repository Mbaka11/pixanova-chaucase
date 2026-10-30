import { language } from './language.js';
const en=language==='en';
const compact=matchMedia('(max-width:600px)');
const demos=[...document.querySelectorAll('.sample-demo')];
demos.forEach(demo=>{demo.open=!compact.matches;});
compact.addEventListener('change',()=>demos.forEach(demo=>{demo.open=!compact.matches;}));
document.querySelector('[data-main-site]')?.setAttribute('href',en?'https://www.pixanova.ca/en':'https://www.pixanova.ca/');
document.querySelector('[data-contact-site]')?.setAttribute('href',en?'https://www.pixanova.ca/en/contact':'https://www.pixanova.ca/contact');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const videos=[...document.querySelectorAll('.sample-video')];
const visible=new Set();
const manualPause=new WeakSet();
videos.forEach(video=>{
 video.addEventListener('pause',()=>{if(visible.has(video)&&!reduced.matches)manualPause.add(video);});
 video.addEventListener('play',()=>manualPause.delete(video));
});
if('IntersectionObserver'in window){
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){
  if(entry.isIntersecting){visible.add(entry.target);if(!reduced.matches&&!manualPause.has(entry.target))entry.target.play().catch(()=>{});}
  else{visible.delete(entry.target);entry.target.pause();}
 }},{threshold:.3});
 videos.forEach(video=>observer.observe(video));
}
reduced.addEventListener('change',()=>{if(reduced.matches)videos.forEach(video=>video.pause());});
