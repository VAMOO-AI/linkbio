import { EVENTOS_DA_BIO } from "./eventos";
import { RE_CLARITY, RE_GA4, RE_META, type IdsPixel } from "./pixel";

/**
 * Script do aviso de cookies. Só existe quando há um ID válido: a página sem pixel
 * não ganha este texto nem um arquivo de JavaScript a mais.
 * O ID entra com JSON.stringify, então não quebra o script.
 * Depois do aceite: PageView, Contact no toque no WhatsApp, Lead no formulário e na agenda
 * (com eventID, para deduplicar se um dia houver API de conversões) e, no Clarity, um evento por toque contado.
 */
export function scriptDeCookies(ids: IdsPixel): string | null {
  const metaOk = ids.meta && RE_META.test(ids.meta) ? ids.meta : null;
  const ga4Ok = ids.ga4 && RE_GA4.test(ids.ga4) ? ids.ga4 : null;
  const clarityOk = ids.clarity && RE_CLARITY.test(ids.clarity) ? ids.clarity : null;
  if (!metaOk && !ga4Ok && !clarityOk) return null;
  const carregaMeta = metaOk ? `if(meta){
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");
fbq("init",meta);fbq("track","PageView");
}
` : "";
  const carregaGa4 = ga4Ok ? `if(ga4){
var s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(ga4);document.head.appendChild(s);
window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};window.gtag("js",new Date());window.gtag("config",ga4);
}
` : "";
  const carregaClarity = clarityOk ? `if(clarity){
(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+encodeURIComponent(i);y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",clarity);
window.clarity("consent");
window.clarity("set","origem",document.documentElement.getAttribute("data-origem")||"direto");
}
` : "";
  return `(function(){
var meta=${JSON.stringify(metaOk)};
var ga4=${JSON.stringify(ga4Ok)};
var clarity=${JSON.stringify(clarityOk)};
var nomes=${JSON.stringify(EVENTOS_DA_BIO)};
var chave="linkbio-cookies";
function ler(){try{var v=localStorage.getItem(chave);return v==="aceito"||v==="recusado"?v:null;}catch(e){return null;}}
function guardar(v){try{localStorage.setItem(chave,v);}catch(e){}}
function idNovo(nome){return nome.toLowerCase()+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);}
function marcar(nome,id,metodo){
if(nomes.indexOf(nome)<0)return;
var eventID=id?nome.toLowerCase()+"-"+id:idNovo(nome);
if(window.fbq)window.fbq("track",nome,{},{eventID:eventID});
if(window.gtag)window.gtag("event","generate_lead",{method:metodo||(nome==="Contact"?"whatsapp":"formulario")});
if(window.clarity)window.clarity("event",nome.toLowerCase()+(metodo?"_"+metodo:""));
}
function carregar(){
${carregaMeta}${carregaGa4}${carregaClarity}document.addEventListener("click",function(e){
var alvo=e.target&&e.target.closest?e.target.closest("a[href]"):null;
var href=alvo?alvo.getAttribute("href")||"":"";
var contado=href.match(/^\\/r\\/([a-z0-9.-]+)/);
if(contado&&window.clarity)window.clarity("event","toque_"+contado[1]);
if(!/wa\\.me|api\\.whatsapp\\.com|whatsapp\\.com\\/send|[?&]wa=1(?:&|$)/i.test(href))return;
marcar("Contact",null,"whatsapp");
});
document.addEventListener("linkbio:evento",function(e){var d=e.detail||{};marcar(d.nome,d.id,d.metodo);});
var pronto=document.querySelector("[data-linkbio-evento]");
if(pronto)marcar(pronto.getAttribute("data-linkbio-evento"),pronto.getAttribute("data-linkbio-evento-id"),pronto.getAttribute("data-linkbio-evento-metodo"));
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
