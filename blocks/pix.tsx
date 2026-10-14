import { gerarBrCode } from "@/lib/pix";
import { qrSvg } from "@/lib/qr";
import { BotaoCopiar } from "./copiar";

/**
 * Pix: o copia-e-cola e o QR nascem no servidor. O código tem user-select: all,
 * então um toque seleciona tudo sem JavaScript. Com copy: true, aparece o botão "Copiar".
 */
export function PixBlock({
  id,
  chave,
  nome,
  cidade,
  valor_cents,
  txid,
  copy = false,
}: {
  id: string;
  chave: string;
  nome: string;
  cidade: string;
  valor_cents?: number;
  txid?: string;
  copy?: boolean;
}) {
  const codigo = gerarBrCode({ chave, nome, cidade, valor_cents, txid });
  const codigoId = `${id}-pix`;
  const valor =
    valor_cents !== undefined
      ? (valor_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : undefined;
  return (
    <section className="bloco-pix" aria-label={`Pix de ${nome}`}>
      <h2 className="pix-titulo">Pix</h2>
      <p className="pix-nome">{nome}</p>
      <p className="pix-cidade">{cidade}</p>
      {valor && <p className="pix-valor">{valor}</p>}
      {txid && txid !== "***" && <p className="pix-txid">Código: {txid}</p>}
      <div className="pix-qr" role="img" aria-label="QR Code do Pix" dangerouslySetInnerHTML={{ __html: qrSvg(codigo) }} />
      <span className="pix-linha">
        <code className="pix-codigo" id={codigoId} translate="no">
          {codigo}
        </code>
        {copy && <BotaoCopiar code={codigo} alvo={codigoId} />}
      </span>
      <p className="pix-dica">{copy ? "Toque em Copiar ou no código." : "Toque no código para selecionar e copiar."}</p>
    </section>
  );
}
