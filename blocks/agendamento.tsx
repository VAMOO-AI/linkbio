"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { dispararEvento } from "@/lib/eventos";
import { origemGuardada } from "@/lib/origem-navegador";
import { linkWhatsApp } from "@/lib/whatsapp";

type Servico = { id: string; title: string; duracao: number; subtitle?: string };
type Horario = { inicio: string; dia: string; hora: string };
type Confirmacao = { servico: string; inicio: string; fim: string; meetUrl: string | null; local: string | null };
type Etapa = "servico" | "dia" | "hora" | "dados" | "feito" | "fora";

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function novoPedido(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
  );
}

function inicial(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function diaPorExtenso(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(Date.UTC(a, m - 1, d)),
  );
}

function quando(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Link "adicionar ao Google Agenda" (para quem não deixou e-mail e não recebe convite). */
function linkGoogleAgenda(c: Confirmacao, titulo: string): string {
  const f = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `${c.servico} · ${titulo}`,
    dates: `${f(c.inicio)}/${f(c.fim)}`,
  });
  const onde = c.meetUrl ?? c.local;
  if (onde) p.set("location", onde);
  return `https://calendar.google.com/calendar/render?${p}`;
}

/**
 * Agendamento: serviço → dia → horário → nome e WhatsApp. Os horários vêm do servidor na hora
 * (a página é estática). Sem banco ou sem Google ligado, vira o botão de WhatsApp.
 */
export function AgendamentoBlock({
  id,
  title,
  intro,
  servicos,
  pedirEmail = false,
  ativo,
  whatsapp,
  tz,
  dono,
  abertoEm,
}: {
  id: string;
  title: string;
  intro?: string;
  servicos: Servico[];
  pedirEmail?: boolean;
  ativo: boolean;
  whatsapp: string;
  tz: string;
  dono: string;
  abertoEm: number;
}) {
  const base = useId();
  const [etapa, setEtapa] = useState<Etapa>(ativo ? (servicos.length > 1 ? "servico" : "dia") : "fora");
  const [servico, setServico] = useState<Servico | null>(servicos.length === 1 ? servicos[0]! : null);
  const [horarios, setHorarios] = useState<Horario[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mes, setMes] = useState(0);
  const [dia, setDia] = useState<string | null>(null);
  const [hora, setHora] = useState<Horario | null>(null);
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const pedido = useRef(novoPedido());
  const foco = useRef<HTMLElement | null>(null);

  const waMarcar = linkWhatsApp(whatsapp, `Oi! Quero marcar um horário${servico ? `: ${servico.title}` : ""}.`);

  /** Só a rede: devolve os horários ou null (agenda fora do ar). */
  async function carregar(s: Servico): Promise<Horario[] | null> {
    try {
      const r = await fetch(`/api/agendamento?bloco=${encodeURIComponent(id)}&servico=${encodeURIComponent(s.id)}`, { cache: "no-store" });
      const corpo = (await r.json()) as { ok: boolean; horarios?: Horario[] };
      return corpo.ok && corpo.horarios ? corpo.horarios : null;
    } catch {
      return null;
    }
  }

  function aplicar(lista: Horario[] | null) {
    setCarregando(false);
    if (!lista) {
      setEtapa("fora");
      return;
    }
    setHorarios(lista);
    setMes(0);
  }

  async function buscar(s: Servico) {
    setCarregando(true);
    aplicar(await carregar(s));
  }

  useEffect(() => {
    const unico = servicos.length === 1 ? servicos[0] : undefined;
    if (!ativo || !unico) return;
    let vivo = true;
    void carregar(unico).then((lista) => {
      if (vivo) aplicar(lista);
    });
    return () => {
      vivo = false;
    };
    // Só na montagem: a escolha do serviço dispara a busca nas outras vezes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    foco.current?.focus({ preventScroll: true });
  }, [etapa]);

  const porDia = useMemo(() => {
    const m = new Map<string, Horario[]>();
    for (const h of horarios ?? []) m.set(h.dia, [...(m.get(h.dia) ?? []), h]);
    return m;
  }, [horarios]);

  const meses = useMemo(() => [...new Set([...porDia.keys()].map((d) => d.slice(0, 7)))].sort(), [porDia]);
  const mesAtual = meses[mes];

  function escolherServico(s: Servico) {
    setServico(s);
    setAviso("");
    setDia(null);
    setHora(null);
    setEtapa("dia");
    void buscar(s);
  }

  async function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!servico || !hora || enviando) return;
    const dados = new FormData(ev.currentTarget);
    setEnviando(true);
    setAviso("");
    try {
      const r = await fetch("/api/agendamento", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bloco: id,
          servico: servico.id,
          inicio: hora.inicio,
          nome: dados.get("nome"),
          whatsapp: dados.get("whatsapp"),
          email: dados.get("email") ?? "",
          empresa: dados.get("empresa") ?? "",
          aberto: String(abertoEm),
          request_id: pedido.current,
          ...origemGuardada(),
        }),
      });
      const corpo = (await r.json()) as Partial<Confirmacao> & { ok: boolean; mensagem?: string; motivo?: string };
      if (corpo.ok && corpo.inicio && corpo.fim && corpo.servico) {
        setConfirmacao({ servico: corpo.servico, inicio: corpo.inicio, fim: corpo.fim, meetUrl: corpo.meetUrl ?? null, local: corpo.local ?? null });
        setEtapa("feito");
        // O mesmo pedido devolve a mesma reserva: o id dele deduplica o Lead.
        dispararEvento({ nome: "Lead", id: pedido.current, metodo: "agendamento" });
        return;
      }
      setAviso(corpo.mensagem || "Não deu para marcar agora. Tente de novo.");
      if (r.status === 409) {
        // Horário tomado: nova tentativa é outro pedido, e a lista volta atualizada.
        pedido.current = novoPedido();
        setHora(null);
        setEtapa("hora");
        void buscar(servico);
      }
      if (r.status === 503) setEtapa("fora");
    } catch {
      setAviso("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const passos: { chave: Etapa; nome: string }[] = [
    ...(servicos.length > 1 ? [{ chave: "servico" as const, nome: "Serviço" }] : []),
    { chave: "dia", nome: "Dia" },
    { chave: "hora", nome: "Horário" },
    { chave: "dados", nome: "Dados" },
  ];
  const ordem = passos.findIndex((p) => p.chave === etapa);

  return (
    <section className="bloco-agendamento" id={`agendamento-${id}`} aria-label={title}>
      <h2 className="ag-titulo">{title}</h2>
      {intro && <p className="ag-intro">{intro}</p>}

      {etapa !== "fora" && etapa !== "feito" && (
        <ol className="ag-passos" aria-hidden="true">
          {passos.map((p, i) => (
            <li key={p.chave} data-feito={i <= ordem || undefined}>
              <b>{i + 1}</b>
              {p.nome}
            </li>
          ))}
        </ol>
      )}

      {etapa === "servico" && (
        <div className="ag-etapa">
          <p className="ag-pergunta" tabIndex={-1} ref={(n) => { foco.current = n; }}>
            Qual atendimento?
          </p>
          <div className="ag-opcoes">
            {servicos.map((s) => (
              <button key={s.id} type="button" className="ag-servico" onClick={() => escolherServico(s)}>
                <span className="ag-servico-nome">{s.title}</span>
                <span className="ag-servico-sub">{s.subtitle ?? `${s.duracao} min`}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {etapa === "dia" && (
        <div className="ag-etapa">
          {servicos.length > 1 && servico && (
            <button type="button" className="ag-voltar" onClick={() => setEtapa("servico")}>
              ‹ {servico.title}
            </button>
          )}
          {carregando || !horarios ? (
            <p className="ag-carregando" role="status">Buscando horários livres…</p>
          ) : meses.length === 0 ? (
            <div className="ag-vazio">
              <p>Nenhum horário livre nos próximos dias.</p>
              <a className="bloco-cta" href={waMarcar} target="_blank" rel="noopener">
                Chamar no WhatsApp
              </a>
            </div>
          ) : (
            mesAtual && (
              <Calendario
                base={base}
                mes={mesAtual}
                livres={porDia}
                escolhido={dia}
                temAnterior={mes > 0}
                temProximo={mes < meses.length - 1}
                mudarMes={(d) => setMes((m) => m + d)}
                escolher={(d) => {
                  setDia(d);
                  setHora(null);
                  setEtapa("hora");
                }}
                refFoco={(n) => {
                  foco.current = n;
                }}
              />
            )
          )}
        </div>
      )}

      {etapa === "hora" && dia && (
        <div className="ag-etapa">
          <button type="button" className="ag-voltar" onClick={() => setEtapa("dia")}>
            ‹ Outro dia
          </button>
          <p className="ag-pergunta" tabIndex={-1} ref={(n) => { foco.current = n; }}>
            Horários em {diaPorExtenso(dia)}
          </p>
          {aviso && <p className="ag-aviso" role="alert">{aviso}</p>}
          {carregando ? (
            <p className="ag-carregando" role="status">Atualizando…</p>
          ) : (porDia.get(dia) ?? []).length === 0 ? (
            <p className="ag-carregando">Esse dia lotou. Volte e escolha outro.</p>
          ) : (
            <div className="ag-horas">
              {(porDia.get(dia) ?? []).map((h) => (
                <button
                  key={h.inicio}
                  type="button"
                  className="ag-hora"
                  aria-pressed={hora?.inicio === h.inicio}
                  onClick={() => {
                    setHora(h);
                    setAviso("");
                    setEtapa("dados");
                  }}
                >
                  {h.hora}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {etapa === "dados" && servico && hora && (
        <form className="ag-etapa" onSubmit={enviar}>
          <button type="button" className="ag-voltar" onClick={() => setEtapa("hora")}>
            ‹ Outro horário
          </button>
          <p className="ag-resumo" tabIndex={-1} ref={(n) => { foco.current = n; }}>
            <strong>{servico.title}</strong>
            <span>
              {inicial(diaPorExtenso(hora.dia))}, {hora.hora}
            </span>
          </p>
          <div className="lead-isca" aria-hidden="true">
            <label>
              Empresa
              <input name="empresa" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="lead-campo">
            Nome
            <input name="nome" required minLength={2} maxLength={80} autoComplete="name" />
          </label>
          <label className="lead-campo">
            WhatsApp
            <input name="whatsapp" required maxLength={20} inputMode="tel" autoComplete="tel" placeholder="(11) 98765-4321" />
          </label>
          <label className="lead-campo">
            {pedirEmail ? "E-mail" : "E-mail (opcional, para receber o convite)"}
            <input name="email" type="email" required={pedirEmail} maxLength={120} autoComplete="email" />
          </label>
          {aviso && <p className="ag-aviso" role="alert">{aviso}</p>}
          <button className="bloco-cta" type="submit" disabled={enviando}>
            {enviando ? "Marcando…" : "Confirmar horário"}
          </button>
        </form>
      )}

      {etapa === "feito" && confirmacao && (
        <div className="ag-feito" role="status">
          <p className="ag-pergunta" tabIndex={-1} ref={(n) => { foco.current = n; }}>
            Horário marcado
          </p>
          <p className="ag-resumo">
            <strong>{confirmacao.servico}</strong>
            <span>{inicial(quando(confirmacao.inicio, tz))}</span>
          </p>
          {confirmacao.meetUrl && (
            <a className="agenda-externo" href={confirmacao.meetUrl} target="_blank" rel="noopener">
              Link da chamada (Google Meet)
            </a>
          )}
          {!confirmacao.meetUrl && confirmacao.local && <p className="ag-intro">Local: {confirmacao.local}</p>}
          <div className="agenda-acoes">
            <a className="agenda-link" href={linkGoogleAgenda(confirmacao, dono)} target="_blank" rel="noopener">
              Pôr na minha agenda
            </a>
            <a
              className="agenda-link"
              href={linkWhatsApp(whatsapp, `Oi! Acabei de marcar ${confirmacao.servico} para ${quando(confirmacao.inicio, tz)}.`)}
              target="_blank"
              rel="noopener"
            >
              Avisar no WhatsApp
            </a>
          </div>
        </div>
      )}

      {etapa === "fora" && (
        <div className="ag-vazio">
          <p>Para marcar um horário, chame no WhatsApp.</p>
          <a className="bloco-cta" href={waMarcar} target="_blank" rel="noopener">
            Marcar pelo WhatsApp
          </a>
        </div>
      )}
    </section>
  );
}

function Calendario({
  base,
  mes,
  livres,
  escolhido,
  temAnterior,
  temProximo,
  mudarMes,
  escolher,
  refFoco,
}: {
  base: string;
  mes: string;
  livres: Map<string, Horario[]>;
  escolhido: string | null;
  temAnterior: boolean;
  temProximo: boolean;
  mudarMes: (delta: number) => void;
  escolher: (dia: string) => void;
  refFoco: (n: HTMLElement | null) => void;
}) {
  const [ano, m] = mes.split("-").map(Number) as [number, number];
  const primeiro = new Date(Date.UTC(ano, m - 1, 1)).getUTCDay();
  const dias = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const nome = inicial(new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(ano, m - 1, 1))));
  const idMes = `${base}-mes`;
  return (
    <div className="ag-cal">
      <div className="ag-cal-topo">
        <span className="ag-pergunta" id={idMes} tabIndex={-1} ref={refFoco} aria-live="polite">
          {nome}
        </span>
        <span className="ag-cal-nav">
          <button type="button" onClick={() => mudarMes(-1)} disabled={!temAnterior} aria-label="Mês anterior">
            ‹
          </button>
          <button type="button" onClick={() => mudarMes(1)} disabled={!temProximo} aria-label="Próximo mês">
            ›
          </button>
        </span>
      </div>
      <div className="ag-cal-grade" role="group" aria-labelledby={idMes}>
        {SEMANA.map((d, i) => (
          <i key={`s${i}`} aria-hidden="true">
            {d}
          </i>
        ))}
        {Array.from({ length: primeiro }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {Array.from({ length: dias }, (_, i) => {
          const chave = `${mes}-${String(i + 1).padStart(2, "0")}`;
          const livre = livres.has(chave);
          return (
            <button
              key={chave}
              type="button"
              disabled={!livre}
              data-livre={livre || undefined}
              aria-pressed={escolhido === chave}
              aria-label={`${diaPorExtenso(chave)}${livre ? "" : ", sem horário"}`}
              onClick={() => escolher(chave)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
