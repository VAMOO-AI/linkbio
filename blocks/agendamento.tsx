"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { dispararEvento } from "@/lib/eventos";
import { origemGuardada } from "@/lib/origem-navegador";
import { linkWhatsApp } from "@/lib/whatsapp";

type Servico = { id: string; title: string; duracao: number; subtitle?: string; price_cents?: number };
type Horario = { inicio: string; dia: string; hora: string };
type Confirmacao = { servico: string; inicio: string; fim: string; meetUrl: string | null; local: string | null };
type Etapa = "servico" | "dia" | "hora" | "dados" | "pagar" | "pago-sem-horario" | "feito" | "fora";
type ModoPagamento = "mercadopago" | "email";
/** Pix pendente: o token consulta o estado; o resto é o que a tela mostra (e volta se a página recarregar). */
type Pendente = {
  token: string;
  modo: ModoPagamento;
  valorCentavos: number;
  copiaECola: string;
  qr: string;
  expiraEm: string;
  servico: string;
  inicio: string;
  fim: string;
  local: string | null;
};

const CONSULTA_MS = 10_000;

function reais(centavos: number): string {
  return `R$ ${(centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function guardado(chave: string): Pendente | null {
  try {
    const p = JSON.parse(localStorage.getItem(chave) ?? "null") as Pendente | null;
    // Uma hora depois do prazo não adianta mais olhar: o horário já foi solto.
    return p && Date.parse(p.expiraEm) + 60 * 60_000 > Date.now() ? p : null;
  } catch {
    return null;
  }
}

function guardar(chave: string, p: Pendente | null) {
  try {
    if (p) localStorage.setItem(chave, JSON.stringify(p));
    else localStorage.removeItem(chave);
  } catch {
    /* modo privado: segue sem guardar */
  }
}

const TOKEN = /^[A-Za-z0-9_-]{32,64}$/;
/** Pix atrasado: o aparelho lembra da reserva por 30 dias, para trocar o horário sem o link. */
const PAGO_SEM_HORARIO_MS = 30 * 24 * 60 * 60_000;

/** Reserva paga guardada neste aparelho: o token vale até `ate` (fim do horário ou prazo do Pix atrasado). */
function lerPago(chave: string): string | null {
  try {
    const p = JSON.parse(localStorage.getItem(chave) ?? "null") as { token?: string; ate?: string } | null;
    return p?.token && p.ate && Date.parse(p.ate) > Date.now() ? p.token : null;
  } catch {
    return null;
  }
}

function guardarPago(chave: string, p: { token: string; ate: string } | null) {
  try {
    if (p) localStorage.setItem(chave, JSON.stringify(p));
    else localStorage.removeItem(chave);
  } catch {
    /* modo privado: segue sem guardar */
  }
}

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
  modoPagamento,
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
  modoPagamento?: ModoPagamento;
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
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [copiado, setCopiado] = useState(false);
  /** Token da reserva paga (troca de horário). `trocando`: a escolha do horário remarca em vez de reservar. */
  const [tokenPago, setTokenPago] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);
  const chaveGuardada = `linkbio-agenda-pix-${id}`;
  const chavePaga = `linkbio-agenda-paga-${id}`;
  const tokenDoLink = useRef(false);
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

  // Reserva paga: veio pelo link "Trocar horário" do convite (?agenda=<token>) ou ficou guardada
  // neste aparelho (Pix atrasado, horário já pago). Mostra a reserva e deixa trocar o horário.
  useEffect(() => {
    if (!ativo) return;
    const url = new URL(window.location.href);
    const daUrl = url.searchParams.get("agenda");
    if (daUrl !== null) {
      tokenDoLink.current = true;
      // O token troca o horário: some da barra antes que os pixels de medição guardem a URL.
      url.searchParams.delete("agenda");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    const token = daUrl ?? (guardado(chaveGuardada) ? null : lerPago(chavePaga));
    if (!token || !TOKEN.test(token)) return;
    let vivo = true;
    void (async () => {
      try {
        const r = await fetch(`/api/agendamento?bloco=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const corpo = (await r.json()) as { ok: boolean; estado?: string; servico?: string; inicio?: string; fim?: string; meetUrl?: string | null };
        if (!vivo) return;
        const s = corpo.ok ? servicos.find((x) => x.id === corpo.servico) : undefined;
        if (!s || (corpo.estado !== "confirmado" && corpo.estado !== "pago_sem_horario")) {
          if (r.status === 404 || corpo.ok) guardarPago(chavePaga, null);
          return;
        }
        setServico(s);
        setTokenPago(token);
        if (corpo.estado === "confirmado" && corpo.inicio && corpo.fim) {
          guardarPago(chavePaga, { token, ate: corpo.fim });
          setConfirmacao({ servico: s.title, inicio: corpo.inicio, fim: corpo.fim, meetUrl: corpo.meetUrl ?? null, local: null });
          setEtapa("feito");
        } else {
          guardarPago(chavePaga, { token, ate: new Date(Date.now() + PAGO_SEM_HORARIO_MS).toISOString() });
          setEtapa("pago-sem-horario");
        }
      } catch {
        /* sem rede: segue o fluxo normal */
      }
    })();
    return () => {
      vivo = false;
    };
    // Só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarregou a página com um Pix em aberto: volta para a tela do Pix.
  useEffect(() => {
    if (!ativo) return;
    // Ordem dos efeitos: o de cima já tirou o ?agenda da barra; ele vale mais que o Pix guardado.
    if (tokenDoLink.current) return;
    const p = guardado(chaveGuardada);
    if (!p) return;
    const t = setTimeout(() => {
      setPendente(p);
      setEtapa("pagar");
    }, 0);
    return () => clearTimeout(t);
    // Só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tela do Pix: relógio do prazo e consulta do pagamento a cada 10 s.
  useEffect(() => {
    if (etapa !== "pagar" || !pendente) return;
    const p = pendente;
    let vivo = true;
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    async function consultar() {
      try {
        const r = await fetch(`/api/agendamento?bloco=${encodeURIComponent(id)}&token=${encodeURIComponent(p.token)}`, { cache: "no-store" });
        const corpo = (await r.json()) as { ok: boolean; estado?: string; meetUrl?: string | null; inicio?: string; fim?: string };
        if (!vivo || !corpo.ok) return;
        if (corpo.estado === "confirmado") {
          guardar(chaveGuardada, null);
          guardarPago(chavePaga, { token: p.token, ate: corpo.fim ?? p.fim });
          setTokenPago(p.token);
          setConfirmacao({ servico: p.servico, inicio: corpo.inicio ?? p.inicio, fim: corpo.fim ?? p.fim, meetUrl: corpo.meetUrl ?? null, local: p.local });
          setEtapa("feito");
          dispararEvento({ nome: "Lead", id: pedido.current, metodo: "agendamento" });
        } else if (corpo.estado === "pago_sem_horario") {
          guardar(chaveGuardada, null);
          guardarPago(chavePaga, { token: p.token, ate: new Date(Date.now() + PAGO_SEM_HORARIO_MS).toISOString() });
          setTokenPago(p.token);
          setEtapa("pago-sem-horario");
        } else if (corpo.estado === "expirado" || corpo.estado === "cancelado") {
          guardar(chaveGuardada, null);
          setPendente(null);
          pedido.current = novoPedido();
          setAviso("O prazo do Pix acabou e o horário foi liberado. Se você já pagou, chame no WhatsApp.");
          setHora(null);
          setEtapa(servico ? "dia" : "servico");
          if (servico) void buscar(servico);
        }
      } catch {
        /* sem rede: tenta de novo no próximo ciclo */
      }
    }
    const ciclo = setInterval(() => void consultar(), CONSULTA_MS);
    return () => {
      vivo = false;
      clearInterval(relogio);
      clearInterval(ciclo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, pendente]);

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

  function comecarTroca() {
    if (!servico) return;
    setTrocando(true);
    setAviso("");
    setDia(null);
    setHora(null);
    setEtapa("dia");
    void buscar(servico);
  }

  /** Esquece a reserva paga deste aparelho e volta ao começo, para marcar outro atendimento. */
  function marcarOutro() {
    guardarPago(chavePaga, null);
    setTokenPago(null);
    setTrocando(false);
    setConfirmacao(null);
    setAviso("");
    setDia(null);
    setHora(null);
    pedido.current = novoPedido();
    if (servicos.length > 1) {
      setServico(null);
      setEtapa("servico");
    } else {
      setEtapa("dia");
      void buscar(servicos[0]!);
    }
  }

  /** Troca de horário: a escolha do horário já remarca (o pagamento continua o mesmo). */
  async function remarcarPara(h: Horario) {
    if (!servico || !tokenPago || enviando) return;
    setEnviando(true);
    setAviso("");
    setHora(h);
    try {
      const r = await fetch("/api/agendamento", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "remarcar", bloco: id, token: tokenPago, inicio: h.inicio }),
      });
      const corpo = (await r.json()) as Partial<Confirmacao> & { ok: boolean; mensagem?: string };
      if (corpo.ok && corpo.inicio && corpo.fim) {
        guardarPago(chavePaga, { token: tokenPago, ate: corpo.fim });
        setConfirmacao({ servico: corpo.servico ?? servico.title, inicio: corpo.inicio, fim: corpo.fim, meetUrl: corpo.meetUrl ?? null, local: corpo.local ?? null });
        setTrocando(false);
        setEtapa("feito");
        return;
      }
      setAviso(corpo.mensagem || "Não deu para trocar agora. Tente de novo.");
      setHora(null);
      if (r.status === 409) void buscar(servico);
    } catch {
      setAviso("Sem conexão. Tente de novo.");
      setHora(null);
    } finally {
      setEnviando(false);
    }
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
      const corpo = (await r.json()) as Partial<Confirmacao> & {
        ok: boolean;
        mensagem?: string;
        motivo?: string;
        pagar?: boolean;
        pagamento?: Omit<Pendente, "servico" | "inicio" | "fim" | "local">;
      };
      if (corpo.ok && corpo.pagar && corpo.pagamento && corpo.inicio && corpo.fim && corpo.servico) {
        const p: Pendente = { ...corpo.pagamento, servico: corpo.servico, inicio: corpo.inicio, fim: corpo.fim, local: corpo.local ?? null };
        guardar(chaveGuardada, p);
        setPendente(p);
        setAgora(Date.now());
        setEtapa("pagar");
        return;
      }
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
    ...(modoPagamento && servicos.some((s) => (s.price_cents ?? 0) > 0) ? [{ chave: "pagar" as const, nome: "Pix" }] : []),
  ];
  const cobra = Boolean(modoPagamento && (servico?.price_cents ?? 0) > 0);
  const emailObrigatorio = pedirEmail || (cobra && modoPagamento === "mercadopago");
  const restante = pendente ? Math.max(0, Date.parse(pendente.expiraEm) - agora) : 0;
  const ordem = passos.findIndex((p) => p.chave === etapa);

  return (
    <section className="bloco-agendamento" id={`agendamento-${id}`} aria-label={title}>
      <h2 className="ag-titulo">{title}</h2>
      {intro && <p className="ag-intro">{intro}</p>}

      {trocando && (etapa === "dia" || etapa === "hora") && <p className="ag-intro">Escolha o novo horário. O Pix já pago continua valendo.</p>}

      {!trocando && etapa !== "fora" && etapa !== "feito" && etapa !== "pago-sem-horario" && (
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
                <span className="ag-servico-sub">
                  {s.subtitle ?? `${s.duracao} min`}
                  {modoPagamento && (s.price_cents ?? 0) > 0 ? ` · ${reais(s.price_cents!)}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {etapa === "dia" && (
        <div className="ag-etapa">
          {servicos.length > 1 && servico && !trocando && (
            <button type="button" className="ag-voltar" onClick={() => setEtapa("servico")}>
              ‹ {servico.title}
            </button>
          )}
          {aviso && <p className="ag-aviso" role="alert">{aviso}</p>}
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
                  disabled={trocando && enviando}
                  onClick={() => {
                    if (trocando) {
                      void remarcarPara(h);
                      return;
                    }
                    setHora(h);
                    setAviso("");
                    setEtapa("dados");
                  }}
                >
                  {trocando && enviando && hora?.inicio === h.inicio ? "Trocando…" : h.hora}
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
            {cobra && <span>{reais(servico.price_cents!)} no Pix</span>}
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
            {emailObrigatorio ? "E-mail" : "E-mail (opcional, para receber o convite)"}
            <input name="email" type="email" required={emailObrigatorio} maxLength={120} autoComplete="email" />
          </label>
          {aviso && <p className="ag-aviso" role="alert">{aviso}</p>}
          <button className="bloco-cta" type="submit" disabled={enviando}>
            {enviando ? "Marcando…" : cobra ? "Ir para o Pix" : "Confirmar horário"}
          </button>
          {cobra && <p className="ag-intro">O horário fica separado para você enquanto o Pix não cai.</p>}
        </form>
      )}

      {etapa === "pagar" && pendente && (
        <div className="ag-etapa ag-pix">
          <p className="ag-pergunta" tabIndex={-1} ref={(n) => { foco.current = n; }}>
            Pague o Pix para confirmar
          </p>
          <p className="ag-resumo">
            <strong>{pendente.servico}</strong>
            <span>{inicial(quando(pendente.inicio, tz))}</span>
          </p>
          <p className="ag-pix-valor">
            {reais(pendente.valorCentavos)}
            {pendente.modo === "email" && <small>Pague exatamente este valor, com os centavos: é assim que o Pix é reconhecido.</small>}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ag-pix-qr" src={pendente.qr} alt="QR Code do Pix" width={220} height={220} />
          <button
            type="button"
            className="bloco-cta"
            onClick={() => {
              void navigator.clipboard?.writeText(pendente.copiaECola).then(
                () => setCopiado(true),
                () => setCopiado(false),
              );
            }}
          >
            {copiado ? "Código copiado" : "Copiar Pix copia e cola"}
          </button>
          <p className="ag-carregando" role="status" aria-live="polite">
            {restante > 0
              ? `Horário separado por mais ${Math.floor(restante / 60_000)}:${String(Math.floor((restante % 60_000) / 1000)).padStart(2, "0")}. Assim que o Pix cair, a confirmação aparece aqui.`
              : "Conferindo o pagamento…"}
          </p>
          {aviso && <p className="ag-aviso" role="alert">{aviso}</p>}
        </div>
      )}

      {etapa === "pago-sem-horario" && (
        <div className="ag-vazio" role="status">
          <p className="ag-pergunta" tabIndex={-1} ref={(n) => { foco.current = n; }}>
            Pix recebido
          </p>
          <p>
            O pagamento chegou depois do prazo e o horário já tinha sido ocupado. Seu pagamento está garantido:
            {tokenPago ? " escolha outro horário aqui ou chame no WhatsApp." : " chame no WhatsApp para escolher outro horário."}
          </p>
          {tokenPago && servico && (
            <button type="button" className="bloco-cta" onClick={comecarTroca}>
              Escolher outro horário
            </button>
          )}
          <a
            className={tokenPago ? "agenda-link" : "bloco-cta"}
            href={linkWhatsApp(whatsapp, `Oi! Paguei o Pix${pendente ? ` de ${reais(pendente.valorCentavos)} (${pendente.servico})` : ""} mas o horário foi ocupado. Quero escolher outro.`)}
            target="_blank"
            rel="noopener"
          >
            {tokenPago ? "Chamar no WhatsApp" : "Escolher outro horário no WhatsApp"}
          </a>
        </div>
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
              Link da chamada
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
            {tokenPago && (
              <button type="button" className="agenda-link" onClick={comecarTroca}>
                Trocar horário
              </button>
            )}
          </div>
          {tokenPago && (
            <p className="ag-intro">
              Para cancelar, chame no WhatsApp.{" "}
              <button type="button" className="ag-voltar" onClick={marcarOutro}>
                Marcar outro atendimento
              </button>
            </p>
          )}
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
