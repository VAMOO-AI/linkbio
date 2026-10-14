import { createServer } from "node:http";
import { PORTA_ANTHROPIC } from "./painel-ambiente";

/**
 * Messages API de mentira. O app aponta aqui com ANTHROPIC_BASE_URL.
 * A resposta recomenda a oferta "mentoria" do exemplo, em três frases.
 */
const texto = JSON.stringify({
  texto: "A mentoria encaixa no que você descreveu. Ela organiza a rotina em encontros curtos. Comece por ela.",
  offer: "mentoria",
});

createServer((req, res) => {
  if (req.url?.startsWith("/__saude")) {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  req.resume();
  req.on("end", () => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "msg_teste",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: texto }],
        stop_reason: "end_turn",
      }),
    );
  });
}).listen(PORTA_ANTHROPIC, "127.0.0.1");
