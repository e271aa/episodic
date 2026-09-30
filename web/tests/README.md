# Rede de segurança

Um teste por bug que já apareceu a usar a app a sério. Não estão aqui para
cobrir a app toda — estão para as coisas que já partiram uma vez não voltarem
a partir sem se dar por isso.

```bash
npm test                      # tudo
npm test tests/recuar.spec.ts # um ficheiro
npm test -- --ui              # a ver correr, passo a passo
npx playwright show-report    # o relatório da última corrida
```

O `npm test` compila a app e serve-a sozinho na porta 3210 (ver
`playwright.config.ts`) — não é preciso ter nada a correr antes. Se já tiveres
um servidor nessa porta, ele reaproveita-o, o que poupa a compilação enquanto
andas a escrever testes.

## O que é falso, e porquê

- **A TMDB** (`apoio/tmdb.ts`). Um teste que fosse à TMDB a sério falharia no
  dia em que o "Hacksaw Ridge" mudasse de posição na pesquisa — por uma razão
  que não tem nada a ver com a app. O que escapar às rotas falsas bate no
  `/api/tmdb` sem chave e responde 503: uma fuga dá erro em vez de passar
  despercebida, e o CI não precisa de segredo nenhum.
- **O Supabase**, desligado. Sem chaves, o `proxy.ts` deixa passar tudo e a
  app corre em modo local — que é o que estes testes querem exercitar.
- **A base local** (`apoio/semear.ts`), escrita à mão antes de a app abrir.
  Importar um ficheiro do TV Time a cada teste demoraria segundos e testaria o
  importador em vez do ecrã em causa.

## Onde correm

Em **WebKit**, com o ecrã de um iPhone 13. A app corre num sítio só: o iPhone
do Ruben, em Safari ou na PWA (o mesmo motor). Testar noutro motor seria
testar uma app que ninguém usa.

## O que fica de fora, e assumidamente

- **O gesto de recuar do bordo** (`BackGesture`): precisa de eventos de
  ponteiro com toque a sério. O que ele faz ao chegar ao fim — `useVoltar` —
  está coberto pelo `recuar.spec.ts`; o arrastar em si, não.
- **As áreas seguras do iPhone** (`env(safe-area-inset-*)`): valem 0 no
  browser emulado, por isso um teste ao respiro do topo do Explorar mediria
  sempre zero e passaria por acidente.
- **O importador do TV Time**: os testes semeiam a base direto. Um teste ao
  importador é outra coisa, e não é destas.

## A rede de mutações (`tests/mutacoes.mjs`)

«Um teste por correção, visto a falhar» só vale se alguém o viu falhar. O guião
repõe **um bug de cada vez** no código (uma troca de texto, `de` → `para`) e
corre os testes: se ficarem verdes, a correção não está protegida.

**Corre-se sempre numa cópia à parte** — a build de cada mutação escreve em
`.next/` e o `next dev` que serve a pré-visualização recarregaria o código
partido. O guião recusa-se fora de um `git worktree`:

```bash
git worktree add --detach ../episodic-mutacoes HEAD
cp -cR node_modules ../episodic-mutacoes/web/node_modules   # clone APFS, ~4 s
cd ../episodic-mutacoes/web
node tests/mutacoes.mjs --verificar     # os trechos ainda existem?
node tests/mutacoes.mjs r14-f3          # só as que batem com o nome
node tests/mutacoes.mjs                 # a rede toda
```

- **Âncoras de comportamento.** Uma mutação boa parte o que o utilizador vê ou
  faz (a data em ISO, o ✕ que só aparece com hover, o episódio que não muda
  de cor), não uma classe. Quando um ecrã é redesenhado a mutação fica sem
  trecho e o guião **recusa-se a correr** — reaponta-se, ou passa a `RETIRADAS`
  com o motivo e onde o mesmo risco ficou guardado.
- **O mapa** (`mutacoes-mapa.json`) diz que ficheiros de teste cada mutação
  ameaça. Só esses correm, e à primeira falha o guião pára: ~25 s por
  mutação, contra ~75 s com a suite inteira (medido a 30-09: a build custa
  10 s, a suite 65 s). Uma mutação que **sobrevive** ao seu conjunto corre a
  suite inteira antes de ser dada como sobrevivente — assim um mapa
  desatualizado não a esconde. O mapa escreve-se sozinho (a primeira vez que
  uma mutação é apanhada, ou quando o conjunto deixa de a apanhar).
- **`--retries=1`**: uma falha isolada (carga da máquina) não conta como
  alarme; uma mutação a sério falha à segunda também.
- O registo de cada corrida fica em `.mutacoes-registo.jsonl` (fora do git; não
  pode ficar em `test-results/`, que o Playwright apaga ao arrancar).
- Uma mutação que **não compila** é `INVÁLIDA`, não «apanhada»: só partiu o build.
