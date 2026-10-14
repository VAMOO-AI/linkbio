# Concierge

Perguntas curtas que indicam a oferta certa e abrem o WhatsApp com o contexto.

- Quem decide o final é o `decide` do bloco. Padrão `"primeira"`: a **1ª pergunta decide**. Com
  `decide: "ultima"`: vale a **última resposta com `offer` ou `reason`**; sem nenhuma, vale a 1ª.
- Toda resposta da 1ª pergunta precisa de `reason` (a explicação mostrada no final) e, em geral, de
  `offer` (id da oferta recomendada).
- Resposta da 1ª pergunta sem `offer` ("Ainda não sei"): o final vira convite para conversar no
  WhatsApp; `title`, `cta` e `wa` da resposta personalizam esse final.
- No modo `"primeira"`, as **outras perguntas são contexto:** só `id` e `label` nas respostas. No modo
  `"ultima"`, resposta delas com `offer` precisa de `reason`; com só `reason`, leva à conversa; sem
  os dois, é contexto. Todas as respostas vão junto, na 1ª linha da mensagem do WhatsApp.
- Cada pergunta tem de 2 a 4 respostas. Texto da resposta: até 40 caracteres. `id` em minúsculas e
  hífens. `mode` é `"roteiro"` ou `"ia"`.
- `"roteiro"`: só as perguntas. Não gasta nada. É também o que aparece se a dúvida livre não puder
  responder (sem chave, limite do dia, falha).
- `"ia"`: além das perguntas, aparece "Escreva sua dúvida". A resposta usa só o que está na bio
  (ofertas com título, motivo e preço; FAQ; textos; perfil), em até 3 frases, e termina numa oferta
  que existe ou no WhatsApp. Para ligar, a chave da Anthropic precisa estar no ambiente do site.
  Cada dúvida gasta um pedido pequeno. No painel: "Roteiro" ou "Roteiro + dúvida livre (IA)".
- Todo `offer` citado precisa existir em `offers` (o check confere).
- No painel: Blocos > Concierge > "Quem decide o final" troca o modo; "Leva para" aparece nas
  perguntas que podem decidir.
- Pessoa com uma oferta só: o concierge não ajuda, sugira desligar (`enabled: false`).
