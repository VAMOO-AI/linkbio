import Image from "next/image";

type Depoimento = { quote: string; name: string; role?: string; avatar?: string };

export function TestimonialsBlock({ title, items }: { title?: string; items: Depoimento[] }) {
  return (
    <section className="bloco-depoimentos" aria-label={title ?? "Depoimentos"}>
      {title && <p className="depoimentos-titulo">{title}</p>}
      <ul className="depoimentos-lista">
        {items.map((d) => (
          <li key={`${d.name}-${d.quote.slice(0, 20)}`}>
            <figure className="depoimento">
              <blockquote>{d.quote}</blockquote>
              <figcaption>
                {d.avatar ? (
                  <Image className="depoimento-foto" src={d.avatar} alt="" width={32} height={32} />
                ) : (
                  <span className="depoimento-inicial" aria-hidden="true">
                    {d.name.charAt(0)}
                  </span>
                )}
                <span>
                  <span className="depoimento-nome">{d.name}</span>
                  {d.role && <span className="depoimento-papel">{d.role}</span>}
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
