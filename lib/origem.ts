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

/** Script do <head>. `contarVisita`: só com features.analytics e o banco ligados. */
export function scriptDaOrigem({ contarVisita }: { contarVisita: boolean }): string {
  const visita = contarVisita
    ? `if(location.pathname==="/"){var kv="linkbio-visita-"+(o||"direto"),ja=null;try{ja=ss.getItem(kv);ss.setItem(kv,"1");}catch(e){}
if(!ja){var corpo=JSON.stringify({origem:o||"direto"});
if(!(navigator.sendBeacon&&navigator.sendBeacon("/api/visita",new Blob([corpo],{type:"application/json"}))))fetch("/api/visita",{method:"POST",headers:{"content-type":"application/json"},body:corpo,keepalive:true}).catch(function(){});}}
`
    : "";
  return `(function(){try{
var q=new URLSearchParams(location.search),d=document.documentElement,ss=null;try{ss=window.sessionStorage;}catch(e){}
function n(v){v=(v||"").trim().toLowerCase();return /^[a-z0-9-]{1,20}$/.test(v)&&v!=="direto"?v:null;}
var o=null,brutos=[q.get("src"),q.get("utm_source")];for(var i=0;i<2;i++){if(brutos[i]&&brutos[i].trim()){o=n(brutos[i]);break;}}
try{if(o)ss.setItem(${JSON.stringify(CHAVE_ORIGEM)},o);else o=n(ss.getItem(${JSON.stringify(CHAVE_ORIGEM)}));}catch(e){}
if(o)d.setAttribute("data-origem",o);
var u={},novo=false;try{u=JSON.parse(ss.getItem(${JSON.stringify(CHAVE_UTM)})||"{}")||{};}catch(e){u={};}
${JSON.stringify(CHAVES_CAMPANHA)}.forEach(function(k){var v=q.get(k);if(v){u[k]=v.slice(0,200);novo=true;}});
if(novo)try{ss.setItem(${JSON.stringify(CHAVE_UTM)},JSON.stringify(u));}catch(e){}
document.addEventListener("submit",function(e){var f=e.target;if(!f||!f.querySelector)return;var c=JSON.stringify(u),a=f.querySelector('input[name="origem"]'),b=f.querySelector('input[name="utm"]');if(a)a.value=o||"";if(b)b.value=c==="{}"?"":c;},true);
${visita}}catch(e){}})();`;
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
