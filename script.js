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
(function(){var b=document.getElementById("quiz-go"),r=document.getElementById("quiz-result"),f=document.getElementById("quiz-form");if(!b||!f)return;var en=document.documentElement.lang==="en";
b.addEventListener("click",function(){var n=0,a=0;for(var i=0;i<8;i++){var c=f.querySelector('input[name="q'+i+'"]:checked');if(c){a++;n+=Number(c.value)}}
if(a<8){r.className="quiz-result show";r.innerHTML="<p>"+(en?"Answer all 8 questions to see your score.":"Répondez aux 8 questions pour voir votre score.")+"</p>";return}
var m=en?(n>=7?"Good foundations. The next step is to measure and accelerate.":n>=4?"You have foundations, but there are quick wins left to capture.":"There is a lot to gain: an audit would help set priorities."):(n>=7?"De bonnes bases. L’étape suivante est de mesurer et d’accélérer.":n>=4?"Vous avez des fondations, mais il reste des gains rapides à aller chercher.":"Il y a beaucoup à gagner : un audit permettrait de fixer les priorités.");
r.className="quiz-result show";r.innerHTML="<b>"+n+" / 8</b><p>"+m+"</p><a class=\"button button-primary\" href=\"#contact\">"+(en?"Let’s talk about your site":"Parlons de votre site")+" <span>↗</span></a>"})})();
(function(){var en=document.documentElement.lang==="en",loc=en?"en-US":"fr-FR";
function fmt(v,d){return Number(v).toLocaleString(loc,{minimumFractionDigits:d,maximumFractionDigits:d})}
var cs=document.querySelectorAll(".count");
function show(el,p){var d=+el.dataset.dec||0;el.textContent=(el.dataset.pre||"")+fmt(+el.dataset.to*p,d)+(el.dataset.suf||"")}
if(cs.length){if(!("IntersectionObserver" in window)||window.matchMedia("(prefers-reduced-motion: reduce)").matches){cs.forEach(function(e){show(e,1)})}else{
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;io.unobserve(e.target);var el=e.target,t0=performance.now();(function step(t){var p=Math.min((t-t0)/1200,1);show(el,1-Math.pow(1-p,3));if(p<1)requestAnimationFrame(step)})(t0)})},{threshold:.4});cs.forEach(function(e){io.observe(e)})}}
var h=document.getElementById("calc-h"),n=document.getElementById("calc-n"),m=document.getElementById("calc-m"),y=document.getElementById("calc-y");
if(h&&n&&m&&y){var up=function(){var a=Math.max(0,Math.min(500,+h.value||0)),b=Math.max(1,Math.min(100,+n.value||1)),s=a*b*0.95;m.textContent=fmt(s,s<10?1:0);y.textContent=fmt(s*12,0)};h.addEventListener("input",up);n.addEventListener("input",up);up()}
})();
(function(){var b=document.getElementById("pick-go"),f=document.getElementById("pick-form"),r=document.getElementById("pick-result");if(!b||!f)return;var en=document.documentElement.lang==="en";
var N={meta:"Meta Ads (Facebook and Instagram)",google:"Google Ads",li:"LinkedIn Ads"},NF={meta:"Meta Ads (Facebook et Instagram)",google:"Google Ads",li:"LinkedIn Ads"};
var W={meta:["Ideal for awareness: you reach a wide audience with visuals and video.","Idéal pour se faire connaître : vous touchez un large public avec des visuels et des vidéos."],google:["You capture people already searching for your product or service, so they are close to a decision.","Vous captez des personnes qui cherchent déjà votre produit ou service, donc proches de la décision."],li:["You target decision makers by role and industry, with a higher cost per click.","Vous ciblez des décideurs par fonction et secteur, avec un coût par clic plus élevé."]};
function val(i){var c=f.querySelector('input[name="pk'+i+'"]:checked');return c?c.value:null}
b.addEventListener("click",function(){var o=val(0),c=val(1),g=val(2);if(!o||!c||!g){r.className="quiz-result show";r.innerHTML="<p>"+(en?"Answer the 3 questions to see the recommendation.":"Répondez aux 3 questions pour voir la recommandation.")+"</p>";return}
var p,s=null,m=g==="m",bb=c==="b";
if(o==="n"){p="meta";s=bb?(m?"li":null):(m?"google":null)}else if(o==="l"){if(bb){p=m?"li":"google";s=m?"google":null}else{p="google";s=m?"meta":null}}else{p="google";s=m?(bb?"li":"meta"):null}
var nm=en?N:NF,i=en?0:1;
var h="<b>"+nm[p]+"</b><p>"+(en?"Start with ":"Commencez par ")+nm[p]+". "+W[p][i]+" "+(s?(en?"With a comfortable budget, add ":"Avec un budget confortable, ajoutez ")+nm[s]+". ":(en?"Measure the cost per result before expanding.":"Mesurez d’abord le coût par résultat avant d’étendre."))+"</p><a class=\"button button-primary\" href=\"#contact\">"+(en?"Let’s talk about your project":"Parlons de votre projet")+" <span>↗</span></a>";
r.className="quiz-result show";r.innerHTML=h})})();
