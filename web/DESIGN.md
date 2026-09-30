---
name: Episodic
description: Um diário pessoal de séries e filmes que parece ter vindo com o iPhone — e só a mira de cor diz que é nosso.
direcao: Mira (Ronda 14, 29-09-2026). Fonte do desenho: design_handoff_mira/.
modes: [noite, claro]
colors:
  noite:
    bg: "#000000"
    group: "#1c1c1e"
    elevated: "#2c2c2e"
    segment: "#636366"
    chip: "#48484a"
    fill: "rgba(120, 120, 128, 0.24)"
    fill-strong: "rgba(120, 120, 128, 0.30)"
    separator: "rgba(84, 84, 88, 0.55)"
    label: "#ffffff"
    label-2: "rgba(235, 235, 245, 0.60)"
    label-faint: "#8e8e93"
    label-3: "rgba(235, 235, 245, 0.34)"
    danger: "#ff453a"
    acao: "#e5e5ea" # a cápsula de ação à noite: o cinza da mira
  claro:
    bg: "#f2f2f7"
    group: "#ffffff"
    elevated: "#e5e5ea"
    segment: "#ffffff"
    chip: "#d1d1d6"
    fill: "rgba(118, 118, 128, 0.12)"
    fill-strong: "rgba(118, 118, 128, 0.16)"
    separator: "rgba(60, 60, 67, 0.18)"
    label: "#000000"
    label-2: "rgba(60, 60, 67, 0.76)" # não os 60% do iOS: 3,1:1 (Fase 3)
    label-faint: "#6c6c70"
    label-3: "rgba(60, 60, 67, 0.30)"
    danger: "#ff3b30"
    acao: "#000000"
  mira: ["#e5e5ea", "#ffd60a", "#64d2ff", "#30d158", "#da5ce8", "#ff453a", "#0a84ff"]
  estado:
    em-curso: { noite: "#ffffff", claro: "#000000" }
    por-marcar: { noite: "#64d2ff", claro: "#32ade6", claro-texto: "#0077a8" }
    em-dia: { noite: "#30d158", claro: "#34c759" }
    terminada: { noite: "#da5ce8", claro: "#af52de" }
typography:
  familia: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif'
  mono: 'ui-monospace, "SF Mono", Menlo, monospace (tabular-nums)'
  rounded: 'ui-rounded, "SF Pro Rounded", system-ui (números grandes)'
  base: "-apple-system-body no iOS (Dynamic Type); 17px fora dele"
rounded:
  capa: "12px"
  capa-grande: "14px"
  capa-pequena: "8px"
  temporada: "16px"
  widget: "22px"
  aviso: "24px"
  grupo: "26px"
  cartao-casa: "28px"
  barra: "32px"
  toque-sozinho: "cápsula (altura / 2)"
spacing: "px fixos — 4 · 8 · 10 · 12 · 14 · 16 (margem) · 18 (cartão) · 20 · 28"
---

# DESIGN — a Mira

**Tese:** *uma app que parece ter vindo com o iPhone, e só a mira de cor diz que
é a nossa.* Padrões e letra do iOS; a identidade fica concentrada em poucos
sítios que só esta app tem — **a mira** (as sete cores do sinal de televisão), os
**códigos em mono** (`S02·E07`), as **cores de estado** e a **voz** («Ainda sem
sinal.»).

A v2 («o sinal de televisão», Archivo/Schibsted/Spline, fundo `#101014`, só
escuro) está no histórico do git; esta é a fonte de verdade desde a Ronda 14. O
desenho completo, com os seis estados difíceis e o ritual de marcar, está em
`design_handoff_mira/` (abrir `Episodic Direcoes.dc.html`, secções 1b e 2a).

## Dois modos

**Noite** e **claro**, e a app segue o do iPhone por omissão. Em Perfil ›
Aparência: **Automático** · **Noite** · **Claro**, guardado neste aparelho
(`localStorage["aparencia"]`, `lib/aparencia.ts`).

- O `data-theme` no `<html>` é posto **antes do primeiro paint**, por um script
  no `<head>` (`beforeInteractive`), para não piscar.
- As `<meta theme-color>` são **só desse script**: o `viewport` do Next voltava
  a inseri-las ao hidratar, por cima da cor escolhida (medido: três metas, a
  última de volta a `#000000` no modo claro).
- Os valores vivem em `--m-*` (globals.css) e os tokens do Tailwind apontam
  para eles — por isso trocam com o tema sem código por ecrã. Os nomes da v2
  (`tube`, `panel`, `raised`, `ink`, `dim`, `faint`, `line`) apontam para os
  papéis novos, para os ecrãs ainda não refeitos mudarem de cor já.
- **Os testes correm em noite** (`colorScheme: "dark"` no Playwright, que abre
  em claro por omissão); o claro tem testes próprios, que o pedem.

## Cor

- **Só tom no fluxo:** `bg → group → elevated`. Sem sombra nem contorno nos
  grupos e cartões.
- **Texto:** `label` (principal), `label-2` (secundário), `label-faint`
  (terciário, **sólido e AA**: 6,0:1 no fundo, 5,0:1 no grupo). O `label-3` do
  iOS (30–40%) é só para contornos e chevrons, **nunca texto**.
- **Vidro** — só para o que flutua: a barra, os botões sobre a arte, o aviso,
  o menu. `.vidro` = `glass` + `blur(20px) saturate(1.6)` + um fio interior de
  0,5px + a sombra de flutuar. Medido no iPhone do Ruben: 60 fps a rolar com 4
  camadas — não é um custo.

### Regra da mira
A mira (sete cores, pela ordem da mira — `--mira-1` a `--mira-7`, **fixas**: uma
carta de teste não muda com o modo) aparece **só** (1) na varredura ao
marcar um episódio e (2) na casa vazia, onde quer dizer «sem sinal». As cores
de estado aparecem **só** em barras de progresso, pontos e no texto «N por
marcar». **Nunca decoração, nunca cor de botão.**

### Regra da ação
**Uma só cápsula preenchida por ecrã** — à noite o **cinza da mira**
(`#e5e5ea`, a primeira barra; brilha menos do que o branco numa sala às escuras
e liga a ação à mira sem lhe dar cor), preta de dia. Token `acao`, texto
`on-label` (16,7:1). As escolhas (segmento, filtro, «Na lista») usam `fill` ou
contorno, nunca a cor da ação. O separador ativo da barra é uma cápsula de
vidro, não a branca.

## Tipografia — a letra do sistema, com Dynamic Type

SF Pro, SF Mono e SF Rounded — **nenhuma fonte carregada**.

- **No iOS** (Safari e PWA instalada), a raiz é `-apple-system-body`: o tamanho
  de texto do iPhone. Medido no do Ruben: **15px** (categoria «Pequeno»). Tudo o
  que está em `rem` cresce e encolhe com ele.
- **Só no iOS**, pela guarda `@supports (-webkit-touch-callout: none)`: o WebKit
  do Mac (e o dos testes) dá 13px a `-apple-system-body` e encolhia a app toda.
  Fora do iOS a base é **17px** (o iPhone por omissão).
- **Os espaços e os alvos ficam em px** (`--spacing: 4px`). Se seguissem o
  texto, os 44px de toque do Ruben passavam a 41. O iOS faz o mesmo: a letra
  cresce, as margens não.

| Papel | a 17px | rem | Peso | Uso |
|---|---|---|---|---|
| Título grande | 34px / 1.15 | 2 | 700 | «A seguir», «Biblioteca»; a série no detalhe |
| Título 1 | 28px / 1.1 | 1.65 | 700 | a série no cartão da casa |
| Título 2 | 22px | 1.3 | 700 | «Em tendência», «Listas» |
| Título 3 | 20px / 1.25 | 1.18 | 600 | a pergunta do cartão de buracos |
| Cabeçalho | 17px | 1 | 600 | botões, «Ou então» |
| Corpo | 17px | 1 | 400 | linhas, nomes de episódio |
| Subtítulo | 15px / 1.4 | 0.88 | 400 | metadados, secundário |
| Nota | 13px | 0.76 | 400/600 | o rótulo de data em maiúsculas |
| Legenda | 10–11px | 0.59–0.65 | 500/600 | nomes da barra (piso de 10px: `max(10px, 0.59rem)`), meses do mapa |
| Mono | 12–15px | 0.7–0.88 | 500/600 | `S02·E07`, `6/10`, anos |
| Rounded | 24–46px | 1.4–2.7 | 700 | `2 781 h`, `138` |

## Primitivas (`src/components/mira/`)

Tudo o que os ecrãs usam sai daqui — é aqui que a assinatura se define (Fase 3)
e se herda (Fases 4–8). Vitrine em `/mira` (só dados de exemplo; sai na Fase 12).

- **`Grupo` + `Linha`** — a lista agrupada: raio 26, linhas de 50px (64 com
  capa), fio de 0,5px que começa depois do conteúdo à esquerda, chevron quando
  leva a algum lado.
- **`Acao`** — `principal` (a cápsula; 52px, cresce com o texto), `secundaria`
  (`fill-strong`), `contorno` («✓ Na lista»).
- **`Segmentado`** — escolha entre poucas opções; `role="radio"`; o escolhido é
  `segment`, nunca a cápsula da ação; 44px de alvo.
- **`MenuFiltro`** — o filtro como menu do iOS: cápsula «Em curso · 12 ▾», lista
  de vidro com contagens e ✓; foco na escolha, Esc fecha. `simples` para a
  ordenação.
- **`TituloGrande`** — o `<h1>` a 34px com rótulo por cima e ação ao lado; ao
  sair do ecrã, uma barra compacta de vidro com o nome a 17px.
- **`EscolhaAparencia`** — Automático · Noite · Claro.
- **`Codigo`** — a letra da TV (ver «A assinatura»).
- **`Segmentos`** — o progresso de uma temporada e o palco do ritual (ver «A
  assinatura»). `fino` para a barra de 3px por baixo de uma capa.
- **`LinhaFila`** — uma série da fila numa lista agrupada: capa com a barra de
  3px, nome, próximo episódio em `Codigo`, e o círculo de marcar com contorno
  (a cápsula preenchida é só a do cartão).
- **`DicaInstalar`** — «Instala no iPhone», **no fluxo**, por baixo do que se
  faz; nunca a flutuar (tapava as portas da casa vazia).
- **A barra de separadores** (`BottomNav`) — cápsula de vidro de 64px, quatro
  colunas iguais, **os quatro nomes à vista enquanto couberem na coluna**
  (`@container`, `@[3.4rem]`): com o texto a 150% num ecrã de 320 deixam de
  caber, saem, e o ícone cresce para 28px — o nome fica no `aria-label`. Acende
  o separador **de onde se veio**. Fica a `max(12px, área segura − 6px)` do
  fundo: os «28px» do desenho são o iPhone com barra de gestos (34 − 6); com 28
  fixos subia sem razão onde não há área segura.

## O detalhe da série (Fase 4)

Uma coluna só (B·2a): a arte de ponta a ponta (290px, nunca mais de 40% do
ecrã) com o degradê para o fundo, dois círculos de vidro por cima (recuar e
**«···»**), o título grande onde o degradê já é fundo e uma linha de
metadados em texto corrido. Os três separadores saíram.

- **A linha de metadados:** a meio, a contagem (`15/19 vistos`), que já é o
  estado; com buracos, o estado **no lugar** da contagem (● `3 por marcar`,
  B·2b); em dia, os dois. Mais de cinco temporadas: diz-se quantas.
- **Uma cápsula por ecrã:** sem buracos, «Marcar `S02·E07`»; com buracos, o
  cartão que pergunta por eles é a ação («Viste o `E04`, o `E05` e o `E06`
  da `T2`?» — pelo nome até três numa temporada, contados acima disso) com
  «Um a um» ao lado (o Pôr em dia desta série, `/em-dia?serie=`), e o
  próximo desce para uma linha com «Marcar» em contorno.
- **Onde ver** é a resposta numa linha de 44px (logótipo, nome, «incluído na
  subscrição», leva à JustWatch) — sem botão para a abrir.
- **Temporadas:** até cinco, segmentado (`T2 6/10`); mais, pastilhas de 68px
  numa faixa com as pontas a desvanecer. A em curso **abre sozinha** e a
  faixa centra-se nela **rolando só a faixa** (um `scrollIntoView` descia a
  página num ecrã baixo). Tocar na aberta não a fecha. As barras das
  pastilhas são sempre `label`: a cor de estado é da série, não da temporada.
- **Episódios** num grupo: o próximo a negrito com anel de 2px; por marcar
  com anel tracejado na cor dele; vistos com o círculo cheio e a linha a
  55%; corridas de 4+ vistos numa linha (`E01–E06 · 6 vistos`).
- **O «···»** é uma folha agrupada: Sobre, Estatísticas (a decisão da
  Fase 0), Juntar a uma lista, Deixar de seguir, Arquivar (os dois com
  anular). `SheetPanel agrupada` troca o degrau da folha e dos grupos
  (`--m-folha`, `--m-folha-grupo`) — as outras folhas passam a ela na Fase 8.

## O Explorar (Fase 6)

«Há alguma coisa nova para mim?» Ordem: título grande, pesquisa (sempre à
vista, 17px, «Séries e filmes»), Séries · Filmes, a linha da **Triagem**, as
faixas, **Listas**.

- **Uma só ação por cartaz** (`DiscoverCard` sobre o `Cartaz` `grande`: capa
  150px, raio 14, nome 15/600): «+ Para ver» em `fill`; depois «✓ Na lista»,
  só contorno `label-3`, sem preenchimento. Dispensar saiu do cartaz — é na
  Triagem. **Exceção:** os resultados de uma pesquisa de séries têm «Seguir» +
  «Para ver» (quem procura pelo nome já costuma estar a ver).
- **Tocar na capa** abre a ficha (folha agrupada): números (séries: temporadas, episódios, minutos; filmes: duração), estado e
  géneros, sinopse, «Onde ver» e a mesma ação. Espreitar não guarda nada — a série só entra na biblioteca com
  «Para ver» / «Seguir».
- **Ver o primeiro episódio** de uma série que estava só em «Para ver» passa-a
  a seguida (`comecarASeguir`, em `db.ts`): sai de «Para ver» e vai para «Em
  curso». Não mexe em «Já não sigo» nem na reposição de marcações antigas.
- **Ver tudo** dobra a faixa num mosaico de 3 colunas; a pesquisa é sempre
  mosaico (numa faixa, «matrix» eram 2400px).
- **Triagem** = o baralho, a ecrã cheio com «‹ Explorar» para fechar. A
  preferência `explorar-modo` guarda-a aberta ao espreitar outro separador.
- **Sem ligação (B·E3)**: sem cache das tendências (decisão da Fase 0) — o
  ecrã diz «Sem ligação», desliga a pesquisa («A pesquisa precisa de rede») e
  as Listas, que são locais, continuam. `useOnline` reage a `online`/`offline`.
- Cores das secções, o «lupa» do topo e o `ViewModeToggle` saíram.

## A Biblioteca (Fase 5)

«Onde está aquela série?» — a resposta acaba quase sempre em abrir uma e
recuar, por isso **filtro, separador, ordem, pesquisa e o sítio onde se ia
vivem no URL** (`tipo`, `filtro`, `ordem`, `decada`, `q`) e sobrevivem ao
recuar. Trocar de separador empilha uma entrada; o resto substitui-a com
`history.replaceState` (não `router.replace`: descarta a navegação pendente).

De cima para baixo: `TituloGrande` («Biblioteca», com «Todas · 138» na barra
compacta), a pesquisa (44px, raio 22, `fill`, 16px para o iOS não ampliar), o
`Segmentado` (Séries `138` · Filmes `266` · Listas), o `MenuFiltro` («Em curso ·
9 ▾») à esquerda e, encostados à direita, a década (filmes) e a ordenação em
texto («Última vista ▾»).

- **`Cartaz`** (`components/mira/`): capa 2:3 raio 12 **sem nada por cima**
  (a barra de 3px vai por baixo, no trilho `label` a 14%, cor = estado); nome a
  13/600 em duas linhas no máximo; por baixo uma linha em mono — `completa`, o
  próximo código ou `vistos/total`, e nos filmes o ano. Sem capa: `group` com fio
  `separator`, o ícone de TV a 22px em `label-3` e o nome a 12/600 (o cartaz lê-se).
- **Retomar:** seguida, por acabar e **sem marcar há mais de 30 dias**
  (`estaParada`, a mesma regra da casa). Não se guarda: ao marcar um episódio a
  série volta a «Em curso» sozinha. «Em curso» é só o que se está a ver.
- **Secções** («Em curso 12»): 17/600 e a contagem em mono, **sem cor**, coladas
  por baixo da barra compacta (`--topo-barra`). «Completas» dobra-se a partir de 12.
- **Uma cápsula preenchida**: só no vazio («Procurar uma série») e em «Procurar “x”
  em todas as séries» quando não há nada local; nos outros casos, `secundaria`.
- Três colunas (quatro/cinco só acima de 640px). Já não há «Cartazes grandes /
  pequenos / Lista».
- **Armadilha:** um `fixed` dentro de `.page-enter` só funciona se a animação
  **não deixar transform no fim** (`backwards`, nunca `both`): foi o que impediu a
  barra compacta de prender ao topo até à Fase 5.

## O Perfil (Fase 7)

«Quanto já vi?» — widgets de **tamanhos diferentes**, não cartões iguais (B·5).
De cima para baixo: `TituloGrande` («Perfil»), o **`CartaoPerfil`**, o **Tempo de
antena**, os três `Contador`es, **Por mês**, dois `Destaque`s, «Mais vistas»,
«Dia da semana», «O teu espetro» e a linha «Mais estatísticas». Sem um episódio
marcado só ficam o cartão, o Tempo de antena («Começa a contar…») e os contadores:
um mapa vazio lê-se como avaria. Entre blocos, 12px (`mt-3`); entre secções, 24.

- **`CartaoPerfil`**: a arte (`backdrop`) da série favorita — sem favorita, da mais
  vista — a 128px, com o avatar de 64px a sobrepor-se, o nome, «Desde 2014 ·
  importado do TV Time», a personagem favorita («Personagem · Ator») e a foto do
  ator à direita. **É a cor do ecrã: a da série de cada um.** O texto fica sempre
  por baixo da arte. Sem arte, encolhe para a linha de 72px do desenho (avatar de
  48px). Leva às Definições.
- **Tempo de antena** (`TempoDeAntena`): as horas em SF Rounded 43px (`2 781 h`,
  `milhares()` — o pt-PT do browser só agrupa a partir de cinco algarismos),
  «115 dias e 21 horas» por baixo, e à direita as barras por ano (8px, ano
  corrente em `label`, o resto a 35%) com a legenda **«por ano · estimado»**.
  Com um só ano não há barras.
- **`Contador` / `Destaque` / `Recorde`** (`components/mira/Widget.tsx`): raio 22.
  Séries e Filmes levam à Biblioteca; «Mais vista» leva à série. `Recorde` tem o
  número em SF Rounded, a unidade ao lado e um detalhe que pode quebrar.
- **Por mês** (`MapaDeCalor`): a leitura fixa à direita do título; quartis, «Ver
  em tabela» e o alvo de 24px como antes (a etiqueta do ano leva 32px: com mais, as
  células ficam abaixo dos 24). **Um mês que ainda não chegou é só contorno e não
  é botão.** A célula escolhida leva o anel `bg` + `label/.9`. A leitura dos
  gráficos (`Colunas`, mapa) já não é mono: leva nomes («Sexta-feira»).
- **Mais vistas**: linhas com a capa (40×60, raio 8), o nome, a barra neutra e a
  contagem.
- **Definições** (`/profile/definicoes`): Editar perfil (só com nuvem),
  Aparência, Conta, Dados — **os quatro cabeçalhos iguais** (17/600 `label`; a
  «Conta» tinha o antigo, mono maiúsculo com barra amarela). O `Panel`/`PanelRow`
  são o grupo da Mira: raio 26, fio de 0,5px, título 17 regular, detalhe 14
  `label-2`, chevron em vez de «→».
- **Estatísticas** (`/estatisticas`) ficam com o que o Perfil não mostra: o ritmo
  (dias ativos, episódios por dia ativo, anos a ver), Episódios por ano, Horas por
  ano e os **Recordes** em widgets de duas colunas.
- **Ecrãs sem `pb` próprio:** o layout raiz já reserva `--dock-h + 0.5rem` por
  baixo de tudo; um `pb-[calc(var(--dock-h)+2rem)]` no `<main>` deixava ~100px de
  vazio no fim do scroll. Usar `pb-6`.
- **Desvio do desenho, por decisão:** o «O teu espetro» (géneros) mantém-se, por
  baixo.

## Movimento
- **Curvas:** `--ease-out` = `cubic-bezier(0.23, 1, 0.32, 1)` para o que entra e
  responde; `--ease-drawer` = `cubic-bezier(0.32, 0.72, 0, 1)`, a do iOS, para o
  que sobe do fundo. A mola `cubic-bezier(.34,1.56,.64,1)` **só** no ✓.
- **Durações:** toque 100–120ms; trocas 160–240ms; folhas 320ms a subir e 200ms
  a descer. Sai-se sempre mais depressa do que se entra.
- **Toque:** qualquer item escala a 0,97–0,98, 100–120ms.
- **Folhas:** sobem do fundo e fecham a arrastar (piparote > 0,11 px/ms ou 30% da
  altura). **Baralho:** decide aos 100px ou num piparote de 24px.
- **`prefers-reduced-motion`:** tiram-se deslocação, escala e desfoque; ficam a
  opacidade e a cor. A contagem do anular corre sempre.

### O ritual «Marcar visto»
Ver «A assinatura», abaixo: é o primeiro dos seus momentos.

## A assinatura (Fase 3)

A crítica da base e da casa (26/40, 29-09) mediu
~75% de iOS de fábrica — por tese — e a identidade escondida onde quase não se
vê. O Ruben escolheu quatro momentos que só esta app tem. **Vivem nas
primitivas**, para as Fases 4–8 os herdarem sem os reinventar.

### 1. O ritual, no toque
Marcar é o que se faz todas as noites, por isso **nada espera pela gravação**:
no toque, o segmento do episódio acende (otimista), a cápsula comprime a 0,97,
o ✓ salta com mola e um anel, e **a mira pinta fatia a fatia** —

- cada segmento visto mostra **a sua fatia** da mira: a mira estende-se pela
  largura da fila (`background-size` = largura da fila, `background-position`
  = −deslocamento do segmento), por isso os intervalos de 3px continuam a ser
  intervalos;
- a varredura vai **só até ao episódio marcado**, da esquerda (cada fatia
  começa até 280ms depois da primeira; 720ms a revelar e apagar). Os por ver
  **nunca** acendem. A fatia do marcado fica mais um pouco (`mira-fica`, 1100ms);
- a contagem rola 6px (`contagem-rola`, 160ms), em mono tabular;
- o episódio sai com desfoque e entra o seguinte; o aviso de anular diz
  «`S01·E04` visto» e o nome da série por baixo.

**Propõe, nunca finge:** se a gravação falhar, o segmento apaga, a contagem
volta e diz-se, no cartão, «Não deu para marcar. Tenta outra vez.»
(`role="alert"`). Anular volta atrás **sem festa**: o ritual só vive enquanto
a marcação vive — anular (ou falhar) tira as fatias. Se ficassem, a leitura
nova da temporada mudava o fim da varredura de segmento, a fatia trocava de
classe e a mira reacendia no episódio anterior (apanhado a 29-09 por um teste
que só falhava às vezes).

**O fim de uma temporada** é raro e tem o seu momento: os segmentos ficam
todos acesos 1400ms com «`T1 ✓`» no lugar da contagem, o aviso diz «`T1`
completa · 9 episódios», e depois os da temporada seguinte **constroem-se da
esquerda** (`segmento-constroi`, 220ms, 15ms entre cada).

### 2. A gramática de TV
- **`Codigo`** (`ep-code`): SF Mono, tabular — **só** para códigos (`S02·E07`,
  `T1`), contagens (`6/10`, `12`) e datas. **Nunca nomes**: em mono, um nome
  lê-se como máquina de escrever (estava assim no aviso de anular). No texto
  corrido, os códigos são destacados sozinhos (`comCodigos` no aviso).
- **`Segmentos`**: um segmento por episódio da temporada, `label` os vistos,
  `track` os por ver; acima de 24, barra contínua; `fino` (3px) por baixo das
  capas. Lê-se a temporada de relance — é informação, não decoração.

### 3. O diário no cabeçalho
Por baixo do título grande, a data **e o que se viu hoje**: «TERÇA, 29 DE
SETEMBRO · `1` EPISÓDIO». A noite acaba em «viste», não só em «falta». Só
aparece com pelo menos um; marcar soma, anular tira. A data e o diário têm
linha própria, por cima do título (com o diário, empurravam o «Pôr em dia»).

### 4. «Sem sinal», a carta de teste
A casa vazia é uma carta SMPTE composta a sério: as sete barras em cima (3/4)
e a fila de acerto por baixo (azul, preto, magenta, preto, ciano, preto,
cinza), raio 24 com fio de 0,5px. Cores fixas. O mesmo desenho é candidato ao
ícone da app (Fase 2b, na Fase 12).

### O que acompanha a assinatura
- A **linha de contexto** do cartão («Viste o anterior ontem», «Parada há 42
  dias», «Ainda não viste nenhum episódio») existe **sempre** e tem uma linha:
  era um sobretítulo que só aparecia em «Retomar» e o botão saltava ~23px
  debaixo do polegar ao marcar.
- O fundo da casa («Continuar», «Retomar», «Por começar», «Esta semana») em
  listas agrupadas com `LinhaFila`/`Linha`; os cabeçalhos **sem cor** (a v2
  punha-lhes uma barrinha da mira).

## Títulos
Mostra-se o **título original** (o que o TV Time exportou: `Severance`, não
`Separação`) no Explorar e na pesquisa, tal como na biblioteca — só se for em
alfabeto latino (o de «Attack on Titan» é `進撃の巨人`, e aí fica o português).
O outro nome fica como alias (`lib/titulos.ts`).

## Gráficos (Estatísticas e Perfil)
- **Uma cor só, a neutra** (`label` com opacidade); nada da mira (é estado, não
  quantidade). O destaque vai a `label` cheio; o resto a 35%.
- **Mapa de calor em quatro degraus** (20 · 35 · 55 · 85%) mais o vazio (6%),
  por **quartis** dos meses com alguma coisa; o mês mais forte sempre no topo.
- **Tocar, não pairar;** leitura fixa em `aria-live`; **sempre** «Ver em tabela».
- **O que é estimado diz que é.** Um gráfico de uma coluna não aparece.

## Não
- **Não** usar cor para destacar uma ação — é a cápsula que destaca.
- **Não** pôr texto pequeno diretamente sobre a arte (a casa tem o backdrop
  **sem texto por cima**).
- **Não** escrever texto em `label-3`.
- **Não** usar sombra no fluxo — só no que flutua.
- **Não** carregar fontes.
- **Não** fixar tamanhos de texto em px (quebra o Dynamic Type) — exceto
  tetos deliberados (`min(…rem, Npx)`) em barras que não podem crescer.
- **Não** inventar funcionalidades que a app não tem (comunidade, feed,
  estrelas).
