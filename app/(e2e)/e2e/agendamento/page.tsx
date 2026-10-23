import { AgendamentoBlock } from "@/blocks/agendamento";
import { resolverTema } from "@/lib/resolver";
import { themeParaCss } from "@/lib/theme";

/** Bloco agendamento com dois serviços, para o teste simular a API e percorrer o fluxo. */
export default function PaginaAgendamento() {
  const tema = resolverTema({ preset: "noite" });
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeParaCss(tema) }} />
      <main className="pagina" data-botoes={tema.buttons}>
        <AgendamentoBlock
          id="agenda"
          title="Marque um horário"
          intro="Escolha o atendimento, o dia e o horário."
          servicos={[
            { id: "consulta", title: "Consulta", duracao: 30 },
            { id: "caso", title: "Análise de caso", duracao: 60, subtitle: "60 min, com parecer" },
          ]}
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
