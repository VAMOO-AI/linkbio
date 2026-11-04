import { normalizarOrigem } from "./cliques";
import { CHAVE_ORIGEM, CHAVE_UTM, CHAVES_CAMPANHA } from "./origem-navegador";

/**
 * Conteúdo por origem. A página continua estática: um script curto no <head> lê `?src=` (senão
 * `utm_source`), guarda na sessão e marca `<html data-origem>` antes de pintar. O CSS gerado da
 * config (cssDeOrigem) mostra ou esconde cada bloco com regra `origem`. Sem JavaScript, ou sem
 * origem, vale a página de sempre: aparece todo bloco que não tem `mostrar`.
 */

export type RegraOrigem = { mostrar?: string[]; esconder?: string[] };

/** Origem válida da busca da URL, ou null. "direto" é a ausência de origem, não uma origem. */
export function origemDaBusca(busca: string): string | null {
  const q = new URLSearchParams(busca);
  for (const bruto of [q.get("src"), q.get("utm_source")]) {
    if (!bruto?.trim()) continue;
    const o = normalizarOrigem(bruto);
    return o === "direto" ? null : o;
  }
  return null;
}

/**
 * Sem `?src=` nem `utm_source`, o site de onde a pessoa veio (`document.referrer`) vira a origem,
 * só para estas redes. Site desconhecido continua "direto": não inventa origem a partir de domínio.
 */
export const REDES_DO_REFERRER: readonly (readonly [string, string])[] = [
  ["instagram.com", "instagram"],
  ["facebook.com", "facebook"],
  ["fb.com", "facebook"],
  ["threads.net", "threads"],
  ["t.co", "x"],
  ["x.com", "x"],
  ["twitter.com", "x"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["tiktok.com", "tiktok"],
  ["linkedin.com", "linkedin"],
  ["lnkd.in", "linkedin"],
  ["google.com", "google"],
  ["google.com.br", "google"],
  ["bing.com", "bing"],
  ["whatsapp.com", "whatsapp"],
];

/** Origem pelo referrer, ou null. `hostAtual`: o próprio site não conta (navegação interna). */
export function origemDoReferrer(referrer: string, hostAtual: string): string | null {
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host.replace(/^www\./, "") === hostAtual.toLowerCase().replace(/^www\./, "")) return null;
  for (const [dominio, origem] of REDES_DO_REFERRER) {
    if (host === dominio || host.endsWith(`.${dominio}`)) return origem;
  }
  return null;
}

const RE_HOST = /^(?=.{4,100}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Domínio de onde veio a visita, para Resultados. Só o host, sem caminho nem busca (o caminho pode
 * levar dado pessoal). Fora: o próprio site, IP, localhost e o que não parece domínio.
 */
export function siteDaVisita(host: string | null | undefined, siteUrl: string): string | null {
  const h = (host ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (!RE_HOST.test(h) || /^[\d.]+$/.test(h)) return null;
  let proprio = "";
  try {
    proprio = new URL(siteUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    proprio = "";
  }
  return h === proprio ? null : h;
}

/**
 * Regras por bloco, pela posição em `config.blocks` (o mesmo índice de `data-bloco-origem`).
 * Os valores já passaram pelo schema (slug curto), então entram no seletor sem escapar.
 */
export function cssDeOrigem(blocks: readonly { type: string; origem?: RegraOrigem }[]): string {
  const regras: string[] = [];
  blocks.forEach((b, i) => {
    const sel = `[data-bloco-origem="${i}"]`;
    if (b.origem?.mostrar?.length) {
      regras.push(`${sel}{display:none}`);
      for (const o of b.origem.mostrar) regras.push(`html[data-origem="${o}"] ${sel}{display:contents}`);
    }
    for (const o of b.origem?.esconder ?? []) regras.push(`html[data-origem="${o}"] ${sel}{display:none}`);
  });
  return regras.join("\n");
}

/** Saída rápida: a aba some antes disto. O painel fala em "menos de 3 segundos". */
export const SAIDA_RAPIDA_MS = 3000;

/** Toque nestes elementos é ação de verdade, não "toque sem link". */
// Só papéis de controle: `role="img"`, `group` e `status` e o `tabindex="-1"` do foco programático
// cobrem área que não abre nada, e o `closest` sobe por eles.
const INTERATIVOS =
  'a,button,input,select,textarea,label,summary,video,iframe,[contenteditable],[tabindex]:not([tabindex="-1"]),' +
  "[role=button],[role=link],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=menuitem],[role=option]";

/**
 * Engajamento (lib/engajamento.ts), dentro do script da origem para usar `o` e `ss`. Roda depois que
 * o <body> existe. Cada seção é um `[data-secao]` com `display: contents` (sem caixa): o observador
 * olha o primeiro descendente que tem caixa. "Chegou na seção" = a parte visível passa da metade do
 * bloco ou da metade da tela (bloco alto nunca mostra metade de si). Uma vez por seção por sessão.
 * Saída rápida: a aba some antes de 3 s sem nenhum toque em link ou envio de formulário.
 * O lote sai a cada 2 s e quando a aba some (sendBeacon), porque no iOS o pagehide sozinho se perde.
 */
function scriptDoEngajamento(): string {
  return `if(location.pathname==="/"){var fila={s:[],t:[]},rapida=false,agiu=false,saiu=false,tm=null;
function nova(k){try{if(ss.getItem(k))return false;ss.setItem(k,"1");}catch(e){}return true;}
function envia(){if(tm){clearTimeout(tm);tm=null;}if(!fila.s.length&&!fila.t.length&&!rapida)return;
var corpo=JSON.stringify({origem:o||"direto",secoes:fila.s,toques:fila.t,rapida:rapida});fila={s:[],t:[]};rapida=false;
if(!(navigator.sendBeacon&&navigator.sendBeacon("/api/engajamento",new Blob([corpo],{type:"application/json"}))))fetch("/api/engajamento",{method:"POST",headers:{"content-type":"application/json"},body:corpo,keepalive:true}).catch(function(){});}
function depois(){if(!tm)tm=setTimeout(envia,2000);}
function caixa(el){while(el&&getComputedStyle(el).display==="contents")el=el.firstElementChild;return el;}
function inicia(){if(!("IntersectionObserver" in window))return;var lim=[];for(var i=0;i<=20;i++)lim.push(i/20);
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;
if(e.intersectionRect.height<Math.min(e.boundingClientRect.height,innerHeight)*0.5)return;
var k=e.target.getAttribute("data-secao-alvo");io.unobserve(e.target);if(k&&nova("linkbio-secao-"+k)){fila.s.push(k);depois();}});},{threshold:lim});
document.querySelectorAll("[data-secao]").forEach(function(s){var c=caixa(s.firstElementChild);if(!c)return;c.setAttribute("data-secao-alvo",s.getAttribute("data-secao"));io.observe(c);});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",inicia);else inicia();
document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;if(t.closest(${JSON.stringify(INTERATIVOS)})){agiu=true;return;}
var s=t.closest("[data-secao]");if(!s)return;try{if(String(getSelection())!=="")return;if(getComputedStyle(t).cursor==="pointer")return;}catch(x){}
var k=s.getAttribute("data-secao");if(k&&nova("linkbio-toque-"+k)){fila.t.push(k);depois();}},true);
document.addEventListener("submit",function(){agiu=true;},true);
function some(){if(!saiu){saiu=true;if(!agiu&&performance.now()<${SAIDA_RAPIDA_MS}&&nova("linkbio-saida-rapida"))rapida=true;}envia();}
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")some();});
addEventListener("pagehide",some);}
`;
}

/**
 * Script do <head>. `contarVisita`: só com features.analytics e o banco ligados. `engajamento`: a
 * mesma condição; liga a rolagem por seção, o toque sem link e a saída rápida.
 * Origem que não está na URL (guardada na sessão ou vinda do referrer) vai no toque do atalho
 * `/r/` como `?src=`: o servidor só enxerga a URL e o Referer, e o clique contaria como "direto".
 */
export function scriptDaOrigem({ contarVisita, engajamento = false }: { contarVisita: boolean; engajamento?: boolean }): string {
  const visita = contarVisita
    ? `if(location.pathname==="/"){var kv="linkbio-visita-"+(o||"direto"),ja=null;try{ja=ss.getItem(kv);ss.setItem(kv,"1");}catch(e){}
if(!ja){var cv={origem:o||"direto"};try{var sh=document.referrer?new URL(document.referrer).hostname.toLowerCase():"";if(sh&&sh.replace(/^www[.]/,"")!==location.hostname.toLowerCase().replace(/^www[.]/,""))cv.site=sh;}catch(e){}
var corpo=JSON.stringify(cv);
if(!(navigator.sendBeacon&&navigator.sendBeacon("/api/visita",new Blob([corpo],{type:"application/json"}))))fetch("/api/visita",{method:"POST",headers:{"content-type":"application/json"},body:corpo,keepalive:true}).catch(function(){});}}
`
    : "";
  return `(function(){try{
var q=new URLSearchParams(location.search),d=document.documentElement,ss=null;try{ss=window.sessionStorage;}catch(e){}
function n(v){v=(v||"").trim().toLowerCase();return /^[a-z0-9-]{1,20}$/.test(v)&&v!=="direto"?v:null;}
var o=null,brutos=[q.get("src"),q.get("utm_source")];for(var i=0;i<2;i++){if(brutos[i]&&brutos[i].trim()){o=n(brutos[i]);break;}}
try{if(o)ss.setItem(${JSON.stringify(CHAVE_ORIGEM)},o);else o=n(ss.getItem(${JSON.stringify(CHAVE_ORIGEM)}));}catch(e){}
if(!o&&document.referrer){try{var rh=new URL(document.referrer).hostname.toLowerCase(),R=${JSON.stringify(REDES_DO_REFERRER)};
if(rh.replace(/^www[.]/,"")!==location.hostname.toLowerCase().replace(/^www[.]/,"")){for(var j=0;j<R.length;j++){if(rh===R[j][0]||rh.slice(-R[j][0].length-1)==="."+R[j][0]){o=R[j][1];break;}}}
if(o)ss.setItem(${JSON.stringify(CHAVE_ORIGEM)},o);}catch(e){}}
if(o)d.setAttribute("data-origem",o);
document.addEventListener("click",function(e){if(!o)return;var a=e.target&&e.target.closest?e.target.closest('a[href^="/r/"]'):null;if(!a)return;
try{var ur=new URL(a.href,location.href);if(!ur.searchParams.get("src")&&!ur.searchParams.get("utm_source")){ur.searchParams.set("src",o);a.href=ur.pathname+ur.search;}}catch(x){}},true);
var u={},novo=false;try{u=JSON.parse(ss.getItem(${JSON.stringify(CHAVE_UTM)})||"{}")||{};}catch(e){u={};}
${JSON.stringify(CHAVES_CAMPANHA)}.forEach(function(k){var v=q.get(k);if(v){u[k]=v.slice(0,200);novo=true;}});
if(novo)try{ss.setItem(${JSON.stringify(CHAVE_UTM)},JSON.stringify(u));}catch(e){}
document.addEventListener("submit",function(e){var f=e.target;if(!f||!f.querySelector)return;var c=JSON.stringify(u),a=f.querySelector('input[name="origem"]'),b=f.querySelector('input[name="utm"]');if(a)a.value=o||"";if(b)b.value=c==="{}"?"":c;},true);
${visita}${engajamento ? scriptDoEngajamento() : ""}}catch(e){}})();`;
}

/** Origem e campanha que chegam com o lead ou a reserva. Sem campo, vale o `?src=` do Referer. */
export function lerOrigemDoEnvio(
  bruto: { origem?: unknown; utm?: unknown },
  referer?: string | null,
): { origem: string | null; utm: Record<string, string> | null } {
  let origem: string | null = null;
  if (typeof bruto.origem === "string" && bruto.origem.trim()) {
    const o = normalizarOrigem(bruto.origem);
    origem = o === "direto" ? null : o;
  } else if (referer) {
    try {
      origem = origemDaBusca(new URL(referer).search);
    } catch {
      origem = null;
    }
  }
  let obj: unknown = bruto.utm;
  if (typeof obj === "string") {
    try {
      obj = obj.trim() ? JSON.parse(obj) : null;
    } catch {
      obj = null;
    }
  }
  const utm: Record<string, string> = {};
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const k of CHAVES_CAMPANHA) {
      const v = (obj as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim()) utm[k] = v.trim().slice(0, 200);
    }
  }
  return { origem, utm: Object.keys(utm).length ? utm : null };
}

/** PostgREST responde PGRST204 quando a coluna não existe: banco que ainda não rodou a 0010. */
export function semColunaDeOrigem(erro: unknown): boolean {
  return erro instanceof Error && /PGRST204/.test(erro.message) && /'(origem|utm)'/.test(erro.message);
}
