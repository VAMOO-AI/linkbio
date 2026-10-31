/** Números em destaque. A fonte de cada número fica visível embaixo dele, não só num title. */
export function NumerosBlock({
  title,
  items,
}: {
  title?: string;
  items: { valor: string; legenda: string; fonte: string }[];
}) {
  return (
    <section className="bloco-numeros" aria-label={title ?? "Números"}>
      {title && <h2 className="numeros-titulo">{title}</h2>}
      <ul className="numeros-lista" data-qtd={items.length}>
        {items.map((n, i) => (
          <li key={`${i}-${n.legenda}`} className="numeros-item">
            <strong className="numeros-valor">{n.valor}</strong>
            <span className="numeros-legenda">{n.legenda}</span>
            <small className="numeros-fonte">Fonte: {n.fonte}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
