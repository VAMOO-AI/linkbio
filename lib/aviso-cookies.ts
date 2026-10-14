import { RE_GA4, RE_META } from "./pixel";

/**
 * Script do aviso de cookies. Só existe quando há um ID válido: a página sem pixel
 * não ganha este texto nem um arquivo de JavaScript a mais.
 * O ID entra com JSON.stringify, então não quebra o script.
 */
export function scriptDeCookies(meta: string | null, ga4: string | null): string | null {
  const metaOk = meta && RE_META.test(meta) ? meta : null;
  const ga4Ok = ga4 && RE_GA4.test(ga4) ? ga4 : null;
  if (!metaOk && !ga4Ok) return null;
  return `(function(){
var meta=${JSON.stringify(metaOk)};
var ga4=${JSON.stringify(ga4Ok)};
var chave="linkbio-cookies";
function ler(){try{var v=localStorage.getItem(chave);return v==="aceito"||v==="recusado"?v:null;}catch(e){return null;}}
function guardar(v){try{localStorage.setItem(chave,v);}catch(e){}}
function carregar(){
if(meta){
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");
fbq("init",meta);fbq("track","PageView");
}
if(ga4){
var s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(ga4);document.head.appendChild(s);
window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};window.gtag("js",new Date());window.gtag("config",ga4);
}
document.addEventListener("click",function(e){
var alvo=e.target&&e.target.closest?e.target.closest("a[href]"):null;
var href=alvo?alvo.getAttribute("href")||"":"";
if(!/wa\\.me|api\\.whatsapp\\.com|whatsapp\\.com\\/send|[?&]wa=1(?:&|$)/i.test(href))return;
if(window.fbq)window.fbq("track","Contact");
if(window.gtag)window.gtag("event","generate_lead",{method:"whatsapp"});
});
}
function perguntar(){
var barra=document.createElement("div");
barra.className="aviso-cookies";
barra.setAttribute("role","dialog");
barra.setAttribute("aria-label","Cookies");
var texto=document.createElement("p");
texto.textContent="Usamos cookies para medir visitas. Nada disso é carregado se você recusar.";
var acoes=document.createElement("div");
acoes.className="aviso-acoes";
function botao(rotulo,classe,aoClicar){
var b=document.createElement("button");
b.type="button";b.className=classe;b.textContent=rotulo;b.addEventListener("click",aoClicar);return b;
}
acoes.appendChild(botao("Recusar","aviso-recusar",function(){guardar("recusado");barra.remove();}));
acoes.appendChild(botao("Aceitar","aviso-aceitar",function(){guardar("aceito");barra.remove();carregar();}));
barra.appendChild(texto);barra.appendChild(acoes);
document.body.appendChild(barra);
}
function iniciar(){
var atual=ler();
if(atual==="recusado")return;
if(atual==="aceito")carregar();
else perguntar();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar);
else iniciar();
})();`;
}
