/** Evento da agenda e o que a página, o Google e o arquivo .ics precisam. */

export type EventoAgenda = {
  id: string;
  title: string;
  date: string;
  time?: string;
  duration?: number;
  place?: string;
  description?: string;
};

function dois(n: number): string {
  return String(n).padStart(2, "0");
}

/** Data e minutos no fuso (parede do relógio, sem passar por Date local da máquina). */
function relogio(tz: string, agora: Date): { data: string; minutos: number } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(agora)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  let hora = Number(partes.hour);
  if (hora === 24) hora = 0;
  return { data: `${partes.year}-${partes.month}-${partes.day}`, minutos: hora * 60 + Number(partes.minute) };
}

/**
 * Passou quando a data é anterior a hoje no fuso, ou quando o horário (mais a duração)
 * já acabou. Sem hora, o dia inteiro continua na página até a meia-noite.
 * Sem duração, acaba no minuto seguinte ao início.
 */
export function eventoPassou(
  evento: Pick<EventoAgenda, "date" | "time" | "duration">,
  tz: string,
  agora = new Date(),
): boolean {
  const local = relogio(tz, agora);
  if (evento.date < local.data) return true;
  if (evento.date > local.data || !evento.time) return false;
  const [h, m] = evento.time.split(":").map(Number) as [number, number];
  const fim = h * 60 + m + (evento.duration ?? 1);
  return local.minutos >= fim;
}

export function eventosVisiveis<T extends Pick<EventoAgenda, "date" | "time" | "duration">>(
  itens: readonly T[],
  tz: string,
  agora = new Date(),
): T[] {
  return itens.filter((e) => !eventoPassou(e, tz, agora));
}

/** Soma minutos numa data e hora de parede (não é fuso: 23:30 + 60 = dia seguinte 00:30). */
function somar(data: string, hora: string, minutos: number): { data: string; hora: string } {
  const [y, mo, d] = data.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hora.split(":").map(Number) as [number, number];
  const dt = new Date(Date.UTC(y, mo - 1, d, hh, mm + minutos));
  return {
    data: `${dt.getUTCFullYear()}-${dois(dt.getUTCMonth() + 1)}-${dois(dt.getUTCDate())}`,
    hora: `${dois(dt.getUTCHours())}:${dois(dt.getUTCMinutes())}`,
  };
}

function compacta(data: string, hora?: string): string {
  const d = data.replaceAll("-", "");
  return hora ? `${d}T${hora.replace(":", "")}00` : d;
}

/** Link "Adicionar à agenda" do Google. Sem hora, é o dia inteiro. Sem duração, uma hora. */
export function linkGoogle(evento: EventoAgenda, tz: string): string {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", evento.title);
  if (evento.time) {
    const fim = somar(evento.date, evento.time, evento.duration ?? 60);
    url.searchParams.set("dates", `${compacta(evento.date, evento.time)}/${compacta(fim.data, fim.hora)}`);
    url.searchParams.set("ctz", tz);
  } else {
    const fim = somar(evento.date, "00:00", 24 * 60);
    url.searchParams.set("dates", `${compacta(evento.date)}/${compacta(fim.data)}`);
  }
  if (evento.place) url.searchParams.set("location", evento.place);
  if (evento.description) url.searchParams.set("details", evento.description);
  return url.toString();
}

function escapar(texto: string): string {
  return texto.replaceAll("\\", "\\\\").replaceAll(/\r\n|\n|\r/g, "\\n").replaceAll(";", "\\;").replaceAll(",", "\\,");
}

function seloUtc(d: Date): string {
  return `${d.getUTCFullYear()}${dois(d.getUTCMonth() + 1)}${dois(d.getUTCDate())}T${dois(d.getUTCHours())}${dois(d.getUTCMinutes())}${dois(d.getUTCSeconds())}Z`;
}

/** Quebra em 75 octetos (RFC 5545). A continuação começa com espaço. */
function dobrar(linhas: string[]): string {
  const saida: string[] = [];
  for (const linha of linhas) {
    const bytes = Buffer.from(linha, "utf8");
    if (bytes.length <= 75) {
      saida.push(linha);
      continue;
    }
    let i = 0;
    let primeiro = true;
    while (i < bytes.length) {
      const limite = primeiro ? 75 : 74;
      let fim = Math.min(i + limite, bytes.length);
      while (fim > i && fim < bytes.length && (bytes[fim]! & 0xc0) === 0x80) fim -= 1;
      const pedaco = bytes.subarray(i, fim).toString("utf8");
      saida.push(primeiro ? pedaco : ` ${pedaco}`);
      primeiro = false;
      i = fim;
    }
  }
  return `${saida.join("\r\n")}\r\n`;
}

/**
 * Arquivo .ics de um evento. UID estável (`id@linkbio`): mudar o título não cria outro evento.
 * Com hora, DTSTART leva o fuso da bio. Sem hora, é o dia inteiro.
 */
export function gerarIcs(evento: EventoAgenda, tz: string, agora = new Date()): string {
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//linkbio//agenda//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${evento.id}@linkbio`,
    `DTSTAMP:${seloUtc(agora)}`,
  ];
  if (evento.time) {
    linhas.push(`DTSTART;TZID=${tz}:${compacta(evento.date, evento.time)}`);
    if (evento.duration) linhas.push(`DURATION:PT${evento.duration}M`);
  } else {
    linhas.push(`DTSTART;VALUE=DATE:${compacta(evento.date)}`);
  }
  linhas.push(`SUMMARY:${escapar(evento.title)}`);
  if (evento.place) linhas.push(`LOCATION:${escapar(evento.place)}`);
  if (evento.description) linhas.push(`DESCRIPTION:${escapar(evento.description)}`);
  linhas.push("END:VEVENT", "END:VCALENDAR");
  return dobrar(linhas);
}
