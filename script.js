const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".main-nav");
if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Fermer le menu" : "Ouvrir le menu");
  });
  nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }));
}
document.getElementById("year").textContent = new Date().getFullYear();

document.querySelectorAll("[data-img]").forEach(el=>{const i=new Image();i.onload=()=>{el.style.backgroundImage="url("+i.src+")";el.classList.add("has-img")};i.src=el.dataset.img});
(function(){
  var header=document.querySelector(".site-header");
  if(header){var f=function(){header.classList.toggle("scrolled",window.scrollY>10)};f();window.addEventListener("scroll",f,{passive:true})}
  if(!("IntersectionObserver" in window)||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  document.documentElement.classList.add("js");
  var els=document.querySelectorAll(".section-heading,.about-copy,.tools-line,.pfe-sub,.contact-box,.skills-grid>*,.steps>*,.timeline>*,.projects-grid>*,.results-grid>*,.blog-grid>*,.metrics>*");
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;var el=e.target;io.unobserve(el);el.classList.add("in");setTimeout(function(){el.classList.remove("reveal","in");el.style.transitionDelay=""},1200)})},{threshold:.12,rootMargin:"0px 0px -6% 0px"});
  els.forEach(function(el){var i=Array.prototype.indexOf.call(el.parentNode.children,el);el.style.transitionDelay=(i%4)*90+"ms";el.classList.add("reveal");io.observe(el)});
})();
