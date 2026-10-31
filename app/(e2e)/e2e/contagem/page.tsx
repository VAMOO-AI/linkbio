import { ContagemBlock } from "@/blocks/contagem";
import { FUSO_PADRAO, partesNoFuso } from "@/lib/janela";

export const dynamic = "force-dynamic";

const dois = (n: number) => String(n).padStart(2, "0");

/** Relógio de São Paulo daqui a `ms`, no formato da config (AAAA-MM-DDTHH:MM). */
function daquiA(ms: number): string {
  const p = partesNoFuso(new Date(Date.now() + ms), FUSO_PADRAO);
  return `${p.y}-${dois(p.m)}-${dois(p.d)}T${dois(p.hh)}:${dois(p.mm)}`;
}

/** Uma contagem que ainda vai zerar (com botão) e uma que já zerou. */
export default function PaginaContagem() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <div data-teste="futura">
        <ContagemBlock
          quando={daquiA((2 * 24 + 3) * 3600 * 1000)}
          tz={FUSO_PADRAO}
          title="A turma abre em"
          text="Entre no grupo para ser avisado."
          cta="Entrar no grupo"
          action={{ url: "https://exemplo.com/grupo" }}
          whatsapp="5511987654321"
        />
      </div>
      <div data-teste="passada">
        <ContagemBlock quando="2020-01-01T00:00" tz={FUSO_PADRAO} title="Já começou" aoZerar="Está no ar." whatsapp="5511987654321" />
      </div>
    </main>
  );
}
