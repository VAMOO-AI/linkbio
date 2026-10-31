import { PorOrigem } from "@/app/(site)/por-origem";
import { cssDeOrigem, scriptDaOrigem } from "@/lib/origem";

/** Mesmo script, CSS e invólucro da bio, com três blocos de teste. */
const blocos = [
  { type: "text", texto: "Para todos" },
  { type: "text", texto: "Só stories", origem: { mostrar: ["stories"] } },
  { type: "text", texto: "Menos bio", origem: { esconder: ["bio"] } },
];

export default function PaginaOrigem() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: scriptDaOrigem({ contarVisita: false }) }} />
      <style dangerouslySetInnerHTML={{ __html: cssDeOrigem(blocos) }} />
      {blocos.map((b, i) => (
        <PorOrigem key={i} origem={b.origem} pos={i}>
          <p>{b.texto}</p>
        </PorOrigem>
      ))}
      <a href="/r/link.teste">Atalho</a>
      <form method="post" action="/e2e/origem">
        <input type="hidden" name="origem" defaultValue="" />
        <input type="hidden" name="utm" defaultValue="" />
        <button type="submit">Enviar</button>
      </form>
    </>
  );
}
