import Image from "next/image";
import type { ChaveDe } from "@/config/opcoes";
import { categoriasDe, MAX_CATEGORIAS, type Produto } from "@/config/schema";
import { alvoProduto, hrefDoClique } from "@/lib/cliques";

function formataPreco(p: Produto): { rotulo?: string; valor?: string } {
  if (p.price_cents === undefined) return { rotulo: p.price_label };
  const valor =
    p.price_cents === 0
      ? "Grátis"
      : (p.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return { rotulo: p.price_label, valor };
}

type Props = {
  id: string;
  title?: string;
  layout: ChaveDe<"productsLayout">;
  filter: boolean;
  items?: string[];
  catalog: Produto[];
  chave?: string | null;
};

/**
 * Vitrine do catálogo. O filtro é feito só com CSS: rádios irmãos da lista,
 * cada um com regra estática em globals.css (índices 1 a 6). Sem JavaScript.
 */
export function ProductsBlock({ id, title, layout, filter, items, catalog, chave = null }: Props) {
  const produtos = items
    ? items.map((pid) => catalog.find((p) => p.id === pid)).filter((p): p is Produto => p !== undefined)
    : catalog;
  const categorias = categoriasDe(produtos).slice(0, MAX_CATEGORIAS);
  const comFiltro = filter && categorias.length > 1;
  const nome = `filtro-${id}`;
  const tituloId = `${id}-titulo`;

  return (
    <section
      className="bloco-produtos"
      data-layout={layout}
      aria-labelledby={title ? tituloId : undefined}
      aria-label={title ? undefined : "Produtos"}
    >
      {title && (
        <h2 className="produtos-titulo" id={tituloId}>
          {title}
        </h2>
      )}
      {comFiltro &&
        ["Todos", ...categorias].map((cat, i) => (
          <input
            key={cat}
            className="filtro-radio sr-only"
            type="radio"
            name={nome}
            id={`${nome}-${i}`}
            data-i={i}
            aria-label={`Filtrar por categoria: ${cat}`}
            defaultChecked={i === 0}
          />
        ))}
      {comFiltro && (
        <div className="filtro-chips">
          {["Todos", ...categorias].map((cat, i) => (
            <label key={cat} htmlFor={`${nome}-${i}`} data-i={i}>
              {cat}
              <span className="filtro-conta" aria-hidden="true">
                {i === 0 ? produtos.length : produtos.filter((p) => p.category === cat).length}
              </span>
            </label>
          ))}
        </div>
      )}
      <ul className="produtos-lista">
        {produtos.map((p, n) => {
          const preco = formataPreco(p);
          const c = p.category ? categorias.indexOf(p.category) + 1 : 0;
          return (
            <li key={p.id} data-c={c || undefined}>
              <a className="produto" href={hrefDoClique(chave ? alvoProduto(p.id) : null, p.url)} target="_blank" rel="noopener">
                <span className="produto-foto" data-tom={(n % 3) + 1}>
                  {p.image && <Image src={p.image} alt="" fill sizes="(max-width: 640px) 45vw, 180px" />}
                  {p.category && <span className="produto-tag">{p.category}</span>}
                </span>
                <span className="produto-nome">{p.title}</span>
                {(preco.rotulo || preco.valor) && (
                  <span className="produto-preco">
                    {preco.rotulo && <small>{preco.rotulo}</small>}
                    {preco.valor}
                  </span>
                )}
                <span className="produto-acao">{p.cta ?? "Ver detalhes"}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
