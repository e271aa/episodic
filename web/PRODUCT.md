# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**O Ruben, primeiro.** Regista tudo o que vê — séries (muita animação
japonesa, sitcoms, dramas, documentários de desporto) e filmes — desde que o
TV Time fechou a 15-07-2026 e apagou os dados. Usa a app instalada no iPhone,
como PWA, sobretudo à noite, quando decide o que vai ver.

**Depois, alguns amigos, por convite** (confirmado a 27-09-2026). Cada um com
a sua biblioteca. Registo aberto a qualquer pessoa **não** é o objetivo. O
fluxo de convite ainda não existe — ver Capabilities.

## Product Purpose

Três trabalhos, pela ordem em que o Ruben os pôs (27-09-2026):

1. **Decidir o que ver esta noite** — abrir e saber logo o que vem a seguir.
2. **Não perder o sítio** — o próximo episódio de cada série, sem buracos nem
   confusão entre o que falta ver e o que ficou por marcar.
3. **Guardar o histórico todo** — um diário de tudo o que foi visto desde
   sempre, com as datas originais e as estatísticas.

Descobrir coisas novas (Explorar, "onde ver") existe e é útil, mas **não** é
um trabalho principal.

Sucesso: abrir a app e saber em segundos o que ver; e os números estarem
certos — a app nunca diz que falta ver o que já foi visto, nem o contrário.

## Positioning

Não é uma rede social de séries nem um catálogo: é um **diário pessoal que
decide contigo**, em português de Portugal. O que o separa dos vizinhos
diretos (Bingers, Stay Tuned, Seenr, Serializd — todos com a comunidade no
centro) é a honestidade dos dados: importou o histórico inteiro do TV Time
com as datas originais, sabe distinguir "ainda não vi" de "vi e não marquei",
e **propõe, nunca decide** por quem a usa.

## Operating Context

- iPhone, app instalada no ecrã principal (PWA), uma mão, à noite, muitas
  vezes com a televisão já ligada
- Os dados vivem no telemóvel (IndexedDB, funciona sem rede) e são copiados
  para a cloud (Supabase); reinstalar recupera tudo (provado a 27-09-2026:
  138 séries, 3.375 episódios, 266 filmes)
- Metadados da TMDB (em pt-PT) e da TVmaze; cada série declara qual das duas
  manda na numeração das temporadas
- "Onde ver" é para Portugal (JustWatch, via TMDB)
- A biblioteca original veio do export GDPR do TV Time

## Capabilities and Constraints

**O que existe:** A seguir / Esta noite, Pôr em dia, Explorar (com triagem por
swipe), Biblioteca (séries e filmes, com filtros e ordenações), detalhe de
série e de filme, listas, A estrear, Estatísticas, Perfil, Rever a
biblioteca, Verificar biblioteca, Importar do TV Time, Entrar.

**Restrições:**
- **Português de Portugal em todo o lado** — nunca pt-BR ("ecrã", não "tela";
  "ver", não "assistir")
- Só modo escuro
- Tem de funcionar sem rede; o que se escreve no telemóvel sobe sozinho
- Tudo em planos gratuitos (Vercel, Supabase, TMDB não comercial)
- Nada de dados reais do Ruben no repositório (o export do TV Time fica
  fora do git)

**Vocabulário da app:** "Marcar visto", "A seguir", "Por começar", "Para
ver", "Arquivadas", "Em dia"; códigos de episódio no formato `S04·E01`.

**Por decidir:**
- **O nome.** "Episodic" é provisório; a procura de um nome novo está em
  curso (preferência: palavra inventada, curta, em inglês — ver PLANO.md,
  Ronda 12, Fase 2b, com a lista do que já foi rejeitado)
- Como funcionam os convites, e o que (se alguma coisa) se partilha entre
  amigos

## Brand Commitments

- Nome atual: **Episodic** (provisório, ver acima)
- **Voz:** diário pessoal, direta, em pt-PT; admite o que não sabe ("não deu
  para verificar — sem ligação") em vez de afirmar o que não é verdade
- A identidade visual em uso foi aprovada pelo Ruben no brief "ESTA NOITE"
  (18-07-2026, PLANO.md) — está documentada em DESIGN.md, não aqui

## Evidence on Hand

- A biblioteca real do Ruben (na app e na cloud) — nunca copiar para o repo
- Export GDPR do TV Time em `gdpr-data/` (privado, fora do git)
- Pacote de desenho anterior em `design_handoff_episodic/`
- Histórico de decisões e medições em `PLANO.md` e `AUDITORIA.md`
- **Não existem** outros utilizadores, testemunhos, números de uso ou
  imprensa — não inventar

## Product Principles

1. **A app propõe, nunca decide.** Nunca afirma que viste o que não disseste
   ter visto. Episódios esquecidos, "vi tudo", repetidos — tudo passa por uma
   proposta com um toque, e tudo se anula.
2. **Não perder o sítio.** Recuar é recuar; filtros, separadores e scroll
   sobrevivem; o próximo episódio está sempre certo.
3. **Os dados são de quem os marcou.** Nada se apaga sem se mostrar o que
   sai; reinstalar recupera tudo; a cloud nunca apaga o que só o telemóvel
   sabe.
4. **Medir antes de opinar.** Uma correção só está feita com um número antes
   e um depois, e com um teste que foi visto a falhar.
5. **Uma decisão por ecrã.** Cada ecrã responde a uma pergunta; o resto fica
   em segundo plano.

## Accessibility & Inclusion

- **O Ruben tem o tamanho do texto do iPhone MENOR do que o normal**
  (27-09-2026). Texto pequeno é o gosto dele, não um defeito por si — os
  "136 sítios a 14px" da Ronda 12 medem-se contra isto. Os amigos podem ter o
  contrário: onde for barato, respeitar o tamanho que cada um escolheu no
  sistema em vez de fixar um só
- Alvos de toque com pelo menos 44px; `prefers-reduced-motion` respeitado
- Nomes acessíveis em português em todos os controlos
