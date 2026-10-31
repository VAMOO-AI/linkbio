import { NumerosBlock } from "@/blocks/numeros";

/** Bloco números com 2 e com 4 itens (o de 4 vira 2 por linha em tela estreita). */
export default function PaginaNumeros() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <NumerosBlock
        title="Em números"
        items={[
          { valor: "+300", legenda: "alunos formados", fonte: "plataforma, out/2026" },
          { valor: "12", legenda: "turmas", fonte: "histórico de turmas" },
        ]}
      />
      <NumerosBlock
        items={[
          { valor: "1,2 mil", legenda: "projetos publicados no ar", fonte: "contagem do painel em out/2026" },
          { valor: "8", legenda: "anos", fonte: "desde 2018" },
          { valor: "40", legenda: "empresas atendidas", fonte: "contratos assinados" },
          { valor: "98%", legenda: "recomendam", fonte: "pesquisa de saída, 2026" },
        ]}
      />
    </main>
  );
}
