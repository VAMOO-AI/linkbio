import { AgendamentoBlock } from "@/blocks/agendamento";
import { resolverTema } from "@/lib/resolver";
import { themeParaCss } from "@/lib/theme";

/** Bloco agendamento com serviço pago (Pix no modo email) e um grátis, para o teste simular a API. */
export default function PaginaAgendamentoPago() {
  const tema = resolverTema({ preset: "noite" });
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeParaCss(tema) }} />
      <main className="pagina" data-botoes={tema.buttons}>
        <AgendamentoBlock
          id="agenda"
          title="Marque uma consulta"
          servicos={[
            { id: "consulta", title: "Consulta", duracao: 30, price_cents: 30000 },
            { id: "papo", title: "Papo rápido", duracao: 15 },
          ]}
          modoPagamento="email"
          ativo
          whatsapp="5511987654321"
          tz="America/Sao_Paulo"
          dono="Pessoa de Teste"
          abertoEm={0}
        />
      </main>
    </>
  );
}
