import { describe, expect, test } from "vitest";
import { eventoPassou, eventosVisiveis, gerarIcs, linkGoogle } from "../lib/agenda";

const tz = "America/Sao_Paulo";
/** 13/10/2026 12:00 em São Paulo (UTC−3, sem horário de verão). */
const agora = new Date("2026-10-13T15:00:00Z");

const base = {
  id: "encontro",
  title: "Aula, parte 1; nível",
  date: "2099-06-15",
  time: "19:00",
  duration: 90,
  place: "https://exemplo.com/sala",
  description: "Linha 1\nLinha 2, com vírgula",
};

describe("eventos passados", () => {
  test("some depois do fim; o dia inteiro fica até a meia-noite", () => {
    expect(eventoPassou({ date: "2026-10-12", title: "Ontem", id: "a" }, tz, agora)).toBe(true);
    expect(eventoPassou({ date: "2026-10-14", title: "Amanhã", id: "b" }, tz, agora)).toBe(false);
    expect(eventoPassou({ date: "2026-10-13", title: "Dia", id: "c" }, tz, agora)).toBe(false);
    expect(eventoPassou({ date: "2026-10-13", time: "11:00", duration: 30, title: "Manhã", id: "d" }, tz, agora)).toBe(true);
    expect(eventoPassou({ date: "2026-10-13", time: "12:00", duration: 60, title: "Agora", id: "e" }, tz, agora)).toBe(false);
    expect(eventoPassou({ date: "2026-10-13", time: "11:00", title: "Sem duração", id: "f" }, tz, agora)).toBe(true);
  });

  test("eventosVisiveis tira só os passados e mantém a ordem", () => {
    const itens = [
      { id: "passado", title: "Velho", date: "2020-01-15" },
      { id: "futuro", title: "Novo", date: "2099-06-15" },
    ];
    expect(eventosVisiveis(itens, tz, agora).map((e) => e.id)).toEqual(["futuro"]);
  });
});

describe("Google Agenda", () => {
  test("com hora, manda início e fim no fuso", () => {
    const url = new URL(linkGoogle(base, tz));
    expect(`${url.origin}${url.pathname}`).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe(base.title);
    expect(url.searchParams.get("dates")).toBe("20990615T190000/20990615T203000");
    expect(url.searchParams.get("ctz")).toBe(tz);
    expect(url.searchParams.get("location")).toBe(base.place);
    expect(url.searchParams.get("details")).toBe(base.description);
  });

  test("dia inteiro usa a data seguinte como fim e não manda fuso", () => {
    const url = new URL(linkGoogle({ id: "dia", title: "Retiro", date: "2099-06-15" }, tz));
    expect(url.searchParams.get("dates")).toBe("20990615/20990616");
    expect(url.searchParams.get("ctz")).toBeNull();
  });

  test("hora sem duração dura uma hora no link", () => {
    const url = new URL(linkGoogle({ id: "h", title: "Papo", date: "2099-06-15", time: "23:30" }, tz));
    expect(url.searchParams.get("dates")).toBe("20990615T233000/20990616T003000");
  });
});

describe("arquivo .ics", () => {
  test("UID estável, TZID, duração e texto escapado", () => {
    const ics = gerarIcs(base, tz, new Date("2026-10-13T15:00:00Z"));
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:encontro@linkbio");
    expect(ics).toContain("DTSTART;TZID=America/Sao_Paulo:20990615T190000");
    expect(ics).toContain("DURATION:PT90M");
    expect(ics).toContain("SUMMARY:Aula\\, parte 1\\; nível");
    expect(ics).toContain("DESCRIPTION:Linha 1\\nLinha 2\\, com vírgula");
    expect(ics).toContain("LOCATION:https://exemplo.com/sala");
    expect(ics).toContain("DTSTAMP:20261013T150000Z");
    expect(ics).toContain("END:VEVENT");
    expect(ics.split(/\r?\n/).filter(Boolean).every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });

  test("dia inteiro usa VALUE=DATE e o UID não muda com o título", () => {
    const a = gerarIcs({ id: "retiro", title: "Retiro", date: "2099-06-15" }, tz);
    const b = gerarIcs({ id: "retiro", title: "Outro nome", date: "2099-01-01" }, tz);
    expect(a).toContain("DTSTART;VALUE=DATE:20990615");
    expect(a).not.toContain("DURATION");
    expect(a).toContain("UID:retiro@linkbio");
    expect(b).toContain("UID:retiro@linkbio");
  });

  test("barra invertida no texto é escapada", () => {
    const ics = gerarIcs({ id: "x", title: "A\\B", date: "2099-06-15" }, tz);
    expect(ics).toContain("SUMMARY:A\\\\B");
  });
});
