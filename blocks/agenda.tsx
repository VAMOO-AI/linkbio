import { eventosVisiveis, linkGoogle, type EventoAgenda } from "@/lib/agenda";

function formataData(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Agenda. A página é estática: evento passado some na próxima publicação
 * ou na atualização de hora em hora (revalidate da rota).
 */
export function AgendaBlock({
  title,
  url,
  items,
  tz,
}: {
  title?: string;
  url?: string;
  items: EventoAgenda[];
  tz: string;
}) {
  const visiveis = eventosVisiveis(items, tz);
  if (!visiveis.length && !url) return null;
  return (
    <section className="bloco-agenda" aria-label={title ?? "Agenda"}>
      {title && <h2 className="agenda-titulo">{title}</h2>}
      {visiveis.length > 0 && (
        <ul className="agenda-lista">
          {visiveis.map((ev) => (
            <li key={ev.id} className="agenda-evento">
              <p className="agenda-quando">
                <time dateTime={ev.time ? `${ev.date}T${ev.time}` : ev.date}>
                  {formataData(ev.date)}
                  {ev.time ? ` às ${ev.time}` : ""}
                </time>
                {ev.duration ? <span className="agenda-duracao"> · {ev.duration} min</span> : null}
              </p>
              <p className="agenda-nome">{ev.title}</p>
              {ev.place &&
                (ev.place.startsWith("https://") ? (
                  <a className="agenda-local" href={ev.place}>
                    {ev.place.replace(/^https:\/\//, "")}
                  </a>
                ) : (
                  <p className="agenda-local">{ev.place}</p>
                ))}
              {ev.description && <p className="agenda-texto">{ev.description}</p>}
              <p className="agenda-acoes">
                <span className="agenda-rotulo">Adicionar à agenda</span>
                <a className="agenda-link" href={linkGoogle(ev, tz)} target="_blank" rel="noopener">
                  Google Agenda
                </a>
                <a className="agenda-link" href={`/agenda/${ev.id}.ics`}>
                  Baixar .ics
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
      {url && (
        <a className="agenda-externo" href={url} target="_blank" rel="noopener">
          Agendar horário
        </a>
      )}
    </section>
  );
}
