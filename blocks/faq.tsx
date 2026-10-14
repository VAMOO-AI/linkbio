/** Perguntas frequentes com details/summary: abre e fecha sem JavaScript. */
export function FaqBlock({
  title,
  openFirst,
  items,
}: {
  title?: string;
  openFirst?: boolean;
  items: { q: string; a: string }[];
}) {
  return (
    <section className="bloco-faq" aria-label={title ?? "Perguntas frequentes"}>
      {title && <h2 className="faq-titulo">{title}</h2>}
      <div className="faq-lista">
        {items.map((item, i) => (
          <details key={item.q} open={openFirst && i === 0}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
