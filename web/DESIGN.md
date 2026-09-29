---
name: Episodic
description: Um diário pessoal de séries e filmes, com a cara de um sinal de televisão.
colors:
  tube: "#101014"
  panel: "#17171d"
  raised: "#1f1f27"
  ink: "#f5f3ee"
  dim: "#a5a29a"
  faint: "#8a8880"
  line: "rgba(245, 243, 238, 0.08)"
  danger: "#e5484d"
  smpte-grey: "#c8c8c8"
  smpte-yellow: "#e6c832"
  smpte-cyan: "#3fd2c8"
  smpte-green: "#37c837"
  smpte-magenta: "#d24bd2"
  smpte-red: "#e6483c"
  smpte-blue: "#3c46e6"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1
    fontVariation: "'wdth' 110"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    fontVariation: "'wdth' 110"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.15em"
    fontVariation: "'wdth' 80"
  code:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.04em"
    fontFeature: "'tnum' 1"
rounded:
  poster: "8px"
  chip: "12px"
  tile: "16px"
  card: "20px"
  panel: "24px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  gutter: "16px"
  row-x: "20px"
  section: "24px"
  section-lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.tube}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 20px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 16px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.dim}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: "44px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.dim}"
    rounded: "{rounded.pill}"
    size: "44px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
  panel-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    height: "60px"
    padding: "14px 20px"
  card:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.card}"
  season-chip:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.code}"
    rounded: "{rounded.chip}"
    height: "72px"
  season-chip-selected:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    height: "72px"
  dock:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.pill}"
    padding: "6px"
  dock-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.tube}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "8px 16px"
  search-input:
    backgroundColor: "{colors.tube}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "10px 16px 10px 40px"
  section-label:
    textColor: "{colors.dim}"
    typography: "{typography.label}"
  episode-code:
    textColor: "{colors.faint}"
    typography: "{typography.code}"
---

# Design System: Episodic

## Overview

**Creative North Star: "O sinal de televisão"**

A app é uma televisão ligada numa sala às escuras. O fundo é o tubo desligado,
um preto com um fio de frio; o texto é a luz do projetor, um branco quente; e
a cor só aparece quando há sinal: as barras de teste SMPTE, em miniatura, a
marcar o progresso, o estado de cada série e o sítio onde se vai. O código do
episódio (`S04·E01`), em letra mono, é o timecode da emissão.

O Ruben pediu-a **cinematográfica, retro-técnica e pessoal**, e não "calma e
discreta": quando a interface tem de escolher, não recua. As capas e os
backdrops vêm à frente e ocupam o ecrã, os rótulos falam a língua de uma régie
de emissão (maiúsculas condensadas, mono tabular), e tudo é dito numa voz de
diário, em português de Portugal. Cada ecrã responde a uma pergunta; o
principal responde a "o que vejo esta noite?".

É uma interface de uso (Operate), densa mas legível num telemóvel, com uma mão
e à noite. A identidade vive nos pormenores exatos: a barra de 3px com a cor
do estado, o fio SMPTE, o timecode. Não em decoração.

**Key Characteristics:**
- Escuro sempre; não há modo claro
- Fundos frios (matiz 285°), texto quente (matiz 90°)
- Cor apenas onde há progresso, estado ou atividade — as barras SMPTE
- Ações principais invertidas: pílula branca, texto preto
- Tipografia de emissão: Archivo com largura variável, Schibsted no corpo,
  Spline Sans Mono nos códigos e números
- Uma só ação preenchida por ecrã

## Colors

Uma sala escura com três degraus de escuro e sete cores de sinal que só se
acendem quando significam alguma coisa.

### Primary
- **Branco-projetor** (ink): o texto principal e a ação principal. Uma pílula
  preenchida a branco com texto a preto é o único "botão de marca" da app:
  contraste de 17:1.

### Neutral
- **Tubo desligado** (tube): o fundo de toda a app, e o texto dentro das
  ações invertidas.
- **Painel** (panel): cartões, painéis de definições, a dock, as folhas que
  sobem do fundo.
- **Painel levantado** (raised): hover, a pastilha selecionada, superfícies
  dentro de painéis.
- **Luz secundária** (dim): texto secundário, ações discretas. 6,4:1 no pior
  fundo.
- **Luz de fundo** (faint): texto terciário, códigos de episódio, datas.
  4,6:1 no pior fundo (raised), por isso ainda AA.
- **Fio** (line): contornos e divisórias, o branco-projetor a 8%.

### Tertiary — o sinal (barras SMPTE)
As sete barras do cartão de teste, na ordem da mira, com os papéis que têm:
- **Verde de sinal** (smpte-green): em dia, e a série continua a ter episódios.
- **Magenta de sinal** (smpte-magenta): em dia, e a série terminou.
- **Ciano de sinal** (smpte-cyan): episódios por marcar para trás (os
  "buracos").
- **Cinza, amarelo, vermelho e azul de sinal**: completam a mira no fio SMPTE
  e são as únicas que marcam um cabeçalho de secção — nunca o verde, o ciano
  ou o magenta, que já significam estados.
- **Cabeçalhos de secção:** a cor sai do título, sempre a mesma para a mesma
  secção, sorteada só entre as 4 neutras. Até à Fase 5b da Ronda 12 sorteava
  entre as sete, o que contradizia a Bars Rule — corrigido, e a Biblioteca
  segue a mesma regra: "Em curso" é o branco-projetor (é o estado "a meio",
  sem sinal), "Completas" é o magenta (o mesmo da barra de progresso de uma
  série terminada), o resto é cinza neutro.
- A meio de uma série, o estado é o próprio branco-projetor; com buracos
  para trás, o traço do estado é o ciano.
- **O espetro de géneros** do Perfil usa as mesmas 4 neutras (amarelo,
  vermelho, azul, cinza) para os 4 géneros mais vistos; o resto é "Outros",
  em luz de fundo (escolhido pelo Ruben, Ronda 12, 5d).

### Danger
- **Vermelho de perigo** (danger): o único acento de perigo. Só acende quando
  a destruição está a um toque; em repouso, uma ação destrutiva é uma linha
  como as outras.

### Named Rules
**The Bars Rule.** A cor da app existe só onde há progresso, estado ou
atividade — nunca como decoração ambiente, nunca como "cor de marca" num
botão. Uma cor SMPTE sem significado é ruído.

**The Inverted Action Rule.** A ação principal é branca com texto preto. Não
há azul de marca, nem âmbar, nem gradiente: o sinal é da emissão, não do botão.
Uma **escolha** não é uma ação: um separador ativo, um filtro escolhido, um
estado ("Na lista para ver") ficam em painel levantado com contorno claro,
nunca brancos. A única exceção é a dock, a navegação que está sempre à vista
(Ronda 12, Fase 5b.3 — havia três pílulas brancas no mesmo ecrã).

**The Blue Is Never Text Rule.** O azul de sinal dá 2,9:1 sobre o tubo: serve
para marcas finas (a barra de secção), nunca para letras.

## Typography

**Display Font:** Archivo, variável na largura (com system-ui)
**Body Font:** Schibsted Grotesk (com system-ui)
**Label/Mono Font:** Spline Sans Mono (com monospace)

**Character:** o Archivo alarga-se para os títulos, como um genérico, e
estreita-se nos rótulos, como uma régie; o Schibsted é um corpo de jornal,
direto; o mono é o timecode.

### Hierarchy
- **Display** (700, 36px, altura de linha 1, largura 110%): o título da série
  no herói, sobre o backdrop.
- **Headline** (700, 24px, largura 110%): o título de cada ecrã, e os números
  grandes das estatísticas.
- **Title** (600, 15px): títulos de cartões, linhas de painel, botões.
- **Body** (400, 15px, altura de linha 1,5): o texto corrido. É o tamanho mais
  usado da app, com 159 usos medidos.
- **Body small** (400, 12px): informação secundária e notas.
- **Label** (600, 12px, maiúsculas, espaçamento 0,15em, largura 80%): os
  cabeçalhos de secção, as eyebrows.
- **Code** (400, 11–13px, mono tabular, espaçamento 0,04em): `S04·E01`,
  contagens, datas, `29/51`.

### Named Rules
**The Timecode Rule.** Códigos de episódio, contagens, datas e números que
mudam vão sempre em mono tabular: alinham-se e não saltam quando mudam.

**The Width Carries Meaning Rule.** Archivo largo (110%) é título; Archivo
estreito (80%) é rótulo. Nunca o contrário, e nunca larguras intermédias
inventadas para um só sítio.

**The Small Is Chosen Rule.** O utilizador principal usa o texto do iPhone
mais pequeno do que o normal: 15px de corpo e 12px de secundário são uma
escolha, não um defeito. Os campos de texto nunca descem dos 16px — abaixo
disso o Safari amplia a página.

## Layout

Uma coluna, centrada, com 16px de margem lateral: até 672px na maior parte dos ecrãs; o Pôr em dia, o Explorar e alguns blocos de cartão único ficam mais estreitos (448–576px). Em cima,
o conteúdo; em baixo, a dock flutuante, cuja altura real (`--dock-h`, com a
barra de gestos incluída) todas as páginas reservam — o último cartaz nunca
fica por baixo dela.

Ritmo: 8–12px dentro de um grupo, 24–32px entre secções. Linhas de painel com
60px de altura e 20px de margem interna. Tudo respeita as áreas seguras do
iPhone (entalhe e barra de gestos).

Uma página não reserva o espaço da dock outra vez: a moldura (`layout.tsx`)
já o faz para todas. Reservá-lo na página dava 82px de scroll fantasma nos
ecrãs de altura própria e 188px de nada no fim do detalhe (Ronda 12, Fase
5b). Os ecrãs de altura própria usam `.tela-cheia`.

O que é longo e da mesma espécie vai em **faixas horizontais** com encaixe
(temporadas com mais de cinco, as filas do "Esta noite"); o resto em lista.
Os cabeçalhos de temporada ficam fixos ao rolar. O herói de uma série ocupa
`min(52vh, 420px)`: arte generosa, mas com a ação principal sempre visível ao
chegar.

## Elevation & Depth

A profundidade vem do tom, não da sombra: tubo → painel → painel levantado,
com um fio a 8% a separar. As sombras são só para o que flutua por cima do
conteúdo — a dock, as folhas que sobem, o aviso de anular, e uma sombra
curta e suave debaixo dos cartões e das capas.

### Shadow Vocabulary
- **Cartão** (`0 1px 2px rgba(0,0,0,.2), 0 8px 24px -12px rgba(0,0,0,.45)`):
  cartões de conteúdo.
- **Dock** (`0 8px 28px -8px rgba(0,0,0,.6)`, com desfoque de fundo): a
  navegação flutuante.
- **Capa** (sombra pequena a preto 30%): cartazes pequenos em listas.

### Named Rules
**The Float Is The Exception Rule.** Só o que está mesmo por cima do conteúdo
(dock, folhas, avisos) desfoca e faz sombra forte. Um cartão no fluxo da
página nunca finge flutuar.

## Shapes

Tudo o que se toca sozinho é uma **pílula**: botões, a dock, os filtros, os
botões redondos de 44px. Os contentores são retângulos de cantos suaves, com
o raio a crescer com o tamanho: 8px nas capas pequenas, 12px nas pastilhas de
temporada, 16px nos cartões de aviso, 20px nos cartões de conteúdo, 24px nos
painéis e no topo das folhas.

A forma-assinatura é a **barra fina**: 3px de altura, cantos redondos. É a
barra de progresso de cada cartaz e de cada temporada, a barra de estado na
fronteira do herói, o marcador de cada cabeçalho de secção e o fio SMPTE.

## Components

### Buttons
Diretos e táteis: respondem ao toque encolhendo 3% em 120ms.
- **Shape:** pílula (9999px), sempre com pelo menos 44px de altura.
- **Primary:** branco-projetor com texto a tubo, 48px, texto 15px 600. Um só
  por ecrã — com buracos por marcar, o "Marcar próximo episódio" passa a
  secundário.
- **Secondary:** contorno de fio, texto branco-projetor, 44px; no hover o
  contorno clareia e o fundo sobe para painel levantado. É também o "Para
  ver" de cada cartaz do Explorar — ações repetidas em cada item de uma
  grelha nunca são brancas.
- **Sobre a arte:** vidro escuro — tubo a 60%, desfoque, fio claro a 25% —
  com o ícone em branco-projetor. O recuar sobre o herói e o ✓ de cada
  cartaz "para ver" da Biblioteca (escolhido pelo Ruben, Ronda 12, 5d).
- **Quiet:** só texto em luz secundária, que clareia no hover. Para ações
  terciárias ("Decidir depois", "Fechar E01–E19").
- **Icon:** círculo de 44px, ícone de traço (Lucide, 2px) a 18–20px. Nos
  botões pequenos por cima de capas, o que se vê pode ser menor, mas a área
  de toque estica-se sempre até 44px.
- **Focus:** contorno de 2px em branco-projetor, afastado 2px, só por teclado.

### Chips
- **Pastilha de temporada:** 72px de altura, número em mono, `vistos/total`
  por baixo em luz de fundo, e a barra de 3px no fundo com a largura do
  progresso e a cor do estado. Selecionada sobe para painel levantado com um
  contorno mais claro. Um ponto ciano de 7px diz "buracos para trás", e diz
  o mesmo em palavras no nome acessível.
- **Filtros:** pílulas de contorno; a escolhida sobe para painel levantado,
  com o contorno a 60% — nunca branca (é uma escolha, não uma ação).

### Cards / Containers
- **Painel de definições:** painel com 24px de canto, linhas de 60px
  separadas por fio, título em Archivo 15px 600 e detalhe em 12px.
- **Cartão de conteúdo:** 20px de canto, contorno de fio, sombra de cartão.
- **Cartão de aviso** (ex.: episódios por marcar): 16px de canto, painel
  levantado a 60%, com a sua própria ação principal dentro.
- **Padding interno:** 12–16px nos cartões, 20px nos painéis.

### Inputs / Fields
- **Pesquisa:** pílula de 48px no fundo tubo, contorno de fio, ícone à
  esquerda; no foco o contorno passa a branco-projetor. Texto a 16px, sempre.

### Navigation
- **Dock:** pílula flutuante ao fundo, painel a 90% com desfoque, sombra de
  dock, e um degradê de 110px por baixo para o conteúdo não se ler através
  dela. O item ativo é uma pílula branca com ícone e nome; os outros só
  mostram o ícone no telemóvel — o nome fica para o leitor de ecrã
  (`sr-only`, nunca `hidden`: sem ele, 3 dos 4 destinos não tinham nome).
  Acende o separador **de onde se veio** — uma
  série aberta a partir da Biblioteca acende a Biblioteca; só sem origem (a
  app aberta direto num ecrã interior) vale uma regra fixa por rota.
- **Separadores:** texto com uma linha de 2px por baixo do ativo; as setas
  do teclado andam entre eles.
- **Recuar:** um círculo de 44px com seta — sobre o herói nos ecrãs com
  herói, e à esquerda do título nos outros (`CabecalhoEcra`). Nunca um texto
  no canto superior direito. Recuar desfaz a navegação — nunca empurra uma
  página nova.
- **Biblioteca:** três separadores na barra flutuante — Séries · Filmes ·
  Listas; as contagens só a partir de 360px de largura. A barra esconde-se
  ao rolar para baixo e volta ao rolar para cima, como a do Safari
  (escolhido pelo Ruben, Ronda 12, 5d); escondida não se toca, e o teclado
  trá-la de volta. Abre em 3 colunas de cartazes (a vista "compacta"), com
  o título à vista. Nos filmes, os "para ver" vêm primeiro, numa secção
  própria.

### Signature: a casa ("Esta noite")
O próximo episódio de ecrã inteiro — eyebrow, título em Archivo 36px largo,
o chip `S01·E04`, a barra de progresso e a pílula "Marcar visto" debaixo do
polegar. Por baixo, ainda na primeira dobra e acima da dock, **"Ou então"**:
duas alternativas pequenas — a próxima série da fila (continuar, retomar ou
começar) e o filme que entrou mais recentemente na lista "para ver". Tocar
abre a página; não marca nada (escolhido pelo Ruben, Ronda 12, Fase 5b.3).

O "próximo episódio" é sempre o que vem **depois do último visto** — um
buraco para trás é "por marcar", tem o cartão dele no detalhe, e nunca é
proposto como o episódio desta noite.

Sem séries nenhumas, a casa é o primeiro uso: o título, logo a seguir as
duas portas ("Procurar uma série" e "Vens do TV Time?"), acima do degradê
da dock, e os quatro passos por baixo a explicar.

### O baralho do Pôr em dia
A mesma ordem do herói: a **série é o título** (Archivo 24px, branco-
projetor), o chip `S01·E04` e o nome do episódio (15px) por baixo. O
episódio sozinho — "Episódio 5" — não diz a ninguém o que está a decidir.

### Signature: o herói da série
O backdrop de ponta a ponta, com um degradê a subir do tubo; a eyebrow em
mono com uma barra de 3px da cor do estado ("22 por marcar", "Em dia ·
terminada"); o título em Archivo 36px largo; os metadados em mono; e a barra
de progresso na fronteira entre a arte e o conteúdo, com a cor do estado e a
largura do progresso.

### Signature: o ritual de marcar
Marcar um episódio: o círculo salta (320ms, com mola) e um anel de luz
expande-se e desaparece. **Na casa**, a barra de progresso acende uma vez com
as cores SMPTE, da esquerda para a direita, e apaga (620ms) — cor só onde há
progresso —, o ✓ do botão salta, e o episódio troca com um desfoque curto
(escolhido pelo Ruben, Ronda 12, Fase 6). Só marcar acende a barra: anular
troca o episódio, mas não festeja. Fechar uma temporada continua a ser a
festa maior: o fio SMPTE atravessa a pastilha inteira (520ms). Tudo se anula
por um aviso que sobe logo acima da dock (pela mesma medida, `--dock-h`),
sem ressalto, e desce pelo mesmo caminho, com uma barra que se esvazia
enquanto a anulação ainda é possível. A casa deixa-lhe espaço por baixo do
"Marcar visto": o aviso nunca tapa a ação que o fez aparecer.

### Movimento
- **Curvas:** `--ease-out` = `cubic-bezier(0.23, 1, 0.32, 1)` (o `ease-out`
  do Tailwind passa a esta) para o que entra e responde; `--ease-drawer` =
  `cubic-bezier(0.32, 0.72, 0, 1)`, a do iOS, para o que sobe do fundo. As
  do browser demoram a arrancar.
- **Durações:** toque 120ms; trocas 160–220ms; folhas 320ms a subir e 200ms
  a descer. Sai-se sempre mais depressa do que se entra.
- **Folhas:** sobem do fundo e descem pelo mesmo caminho; fecham-se a
  arrastar a cabeça para baixo — um piparote chega (> 0,11 px/ms), ou 30% da
  altura devagar. Para cima cedem com atrito, não batem numa parede.
- **Baralho:** decide aos 100px de arrasto, ou num piparote de mais de 24px.
- **Nada com mola a passar do alvo**, exceto o ✓ que salta.
- **`prefers-reduced-motion`:** tiram-se as deslocações (subir, descer,
  varrer, saltar); ficam a opacidade e a cor, que dizem que alguma coisa
  mudou. A contagem do anular corre sempre — é a funcionalidade, não
  decoração.

### Gráficos (Estatísticas e Perfil)
- **Uma cor só, a neutra.** Tudo em `ink` com opacidade; nada de SMPTE (é
  estado, não quantidade). O destaque — o maior, ou o ano corrente — vai a
  `ink` cheio; o resto a `ink/35`.
- **Mapa de calor em quatro degraus** (`ink/25 · 45 · 70 · 100`) mais o
  vazio (`ink/6`): 38 e 40 episódios não se distinguem a olho, fingir que
  sim é ruído. Um mês com alguma coisa nunca cai no vazio.
- **Tocar, não pairar.** Cada coluna ou célula é um botão de 44px; a
  leitura ("março de 2021 · 8 episódios") fica numa linha fixa por cima,
  em `aria-live`. Ao abrir, já mostra o destaque.
- **Um número à vista, não um em cada coluna**; os rótulos são os dias, os
  meses (uma letra) ou os anos.
- **Barras finas** (≤24px), ponta de dados arredondada a 4px, assente na
  base. **Sempre uma tabela** em "Ver em tabela" (`<details>`).
- **O que é estimado diz que é** (as horas por ano: o TV Time só deu o
  total). Um gráfico de uma coluna não aparece.

### Signature: a lista de episódios
Corridas de quatro ou mais episódios vistos colapsam numa linha ("E01–E19 ·
19 episódios vistos"); os por ver ficam abertos, um a um, a negrito; os
vistos ficam a 60% de opacidade. Os anunciados mostram a data de estreia,
com um círculo tracejado, e não se podem marcar.

## Do's and Don'ts

### Do:
- **Do** usar a pílula branca (branco-projetor, texto tubo) para a única ação
  principal do ecrã, e contorno de fio para as secundárias.
- **Do** guardar as cores SMPTE para progresso, estado e atividade: verde em
  dia e a continuar, magenta em dia e terminada, ciano para buracos.
- **Do** escrever códigos, contagens e datas em Spline Sans Mono tabular.
- **Do** dar a qualquer coisa que se toca pelo menos 44px de área, esticando
  a área invisível quando o desenho tem de ser mais pequeno.
- **Do** reservar `--dock-h` no fundo de cada página e respeitar as áreas
  seguras do iPhone.
- **Do** pôr elementos `position: fixed` num portal fora da página: a
  animação de entrada aplica um `transform` que os prende à página.

### Don't:
- **Don't** usar o âmbar (`#ffaa33`) nem o fundo azul-noite (`#0b0e14`) da
  v1. O `manifest` e o brilho do `ep-card-hover` já foram limpos (Fase 5b da
  Ronda 12); resta um sítio: o ícone da app (`icon.svg` e `apple-icon.png`,
  ainda o triângulo âmbar) — liga à Fase 2b, o nome novo.
- **Don't** criar um quarto vermelho. Hoje há três quase iguais — perigo
  (`#e5484d`), o vermelho SMPTE (`#e6483c`) e o "não" do baralho
  (`#e8564a`) —, e o último devia ser um dos dois primeiros.
- **Don't** pôr cor numa ação só para a destacar: é a pílula branca que
  destaca.
- **Don't** escrever texto no azul de sinal.
- **Don't** baixar um campo de texto dos 16px.
- **Don't** fazer um modo claro.
- **Don't** fazer festa a cada toque: a animação grande é só para fechar
  uma temporada; a barra da casa é uma linha de 3px, não o ecrã.
- **Don't** fazer desaparecer de golpe o que entrou a mexer-se: sai pelo
  caminho por onde entrou.
