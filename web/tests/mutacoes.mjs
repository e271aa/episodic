#!/usr/bin/env node
/**
 * Rede de segurança (Rondas 11 e 12) — põe cada bug de volta, um de cada vez,
 * e vê quem dá o alarme.
 *
 * "Um teste por correção, cada um visto a falhar com o bug de volta" é fácil
 * de dizer e fácil de acreditar sem verificar: nesta ronda houve três testes
 * que passavam com o bug lá dentro (o negativo dos buracos, o do transbordo,
 * o do scroll da faixa — esse media o Playwright, que arrasta o elemento
 * para o ecrã antes de tocar). Um teste que nunca foi visto a falhar não é
 * uma rede, é um enfeite.
 *
 * Cada mutação repõe UM bug. Se a suite continuar verde, a correção não está
 * protegida por teste nenhum — e isso é um buraco na rede, não um detalhe.
 *
 * Correr (NUNCA na pasta que serve o `next dev` — a build de cada mutação
 * escreve em `.next/` e o servidor de pré-visualização recarrega os ficheiros
 * mutados; por isso o guião recusa-se fora de um `git worktree`):
 *
 *   git worktree add --detach ../episodic-mutacoes HEAD
 *   cp -cR node_modules ../episodic-mutacoes/web/node_modules   # clone APFS, 4 s
 *   cd ../episodic-mutacoes/web
 *   node tests/mutacoes.mjs                  todas
 *   node tests/mutacoes.mjs buracos r14-f3   só as que batem com algum destes nomes
 *   node tests/mutacoes.mjs --verificar      só confirma que os trechos existem
 *   node tests/mutacoes.mjs --tudo           ignora o mapa: suite inteira em cada uma
 *
 * Quanto demora (medido a 30-09, M-series de 8 núcleos): a build custa ~10 s e
 * a suite inteira ~65 s. Com o mapa (`mutacoes-mapa.json`: os ficheiros de
 * teste que cada mutação ameaça) só correm esses, parando à primeira falha:
 * ~25 s por mutação. Só quando uma mutação **sobrevive** ao seu conjunto é que
 * se corre a suite inteira (para a distinguir de um mapa desatualizado) — por
 * isso um sobrevivente custa ~75 s e um apanhado ~25 s. O guião diz a
 * estimativa antes de começar.
 */

import { execFileSync, execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const BIBLIOTECA = "src/app/library/LibraryPageClient.tsx";
const RUNS = "src/lib/episodeRuns.ts";
const BURACOS = "src/lib/buracos.ts";
const EXISTENTE = "src/lib/existente.ts";
const REPAIR = "src/lib/repair.ts";
const METADATA = "src/lib/metadata.ts";
const DB = "src/lib/db.ts";
const STATS = "src/lib/advancedStats.ts";
const REVER = "src/lib/rever.ts";
const REVER_PAGINA = "src/app/rever/ReverPageClient.tsx";
const LINHAS = "src/lib/linhas.ts";
const NUMERACAO = "src/lib/numeracao.ts";
const HEROI = "src/components/TonightHero.tsx";
const EM_DIA = "src/app/em-dia/EmDiaPageClient.tsx";
const RESULTADO_SERIE = "src/components/ShowResultCard.tsx";
const CASA = "src/app/series/SeriesPageClient.tsx";
const EXPLORAR = "src/app/explorar/ExplorarPageClient.tsx";
const LISTA = "src/app/listas/[id]/ListaPageClient.tsx";
const AVISO = "src/components/UndoToast.tsx";
const CSS = "src/app/globals.css";
const POSTER_CARD = "src/components/PosterCard.tsx";
const LIBRARY = "src/app/library/LibraryPageClient.tsx";
const IMPORT_PAGINA = "src/app/import/ImportPageClient.tsx";
const ESTATISTICAS = "src/app/estatisticas/EstatisticasPageClient.tsx";
const PROFILE_PAGINA = "src/app/profile/ProfilePageClient.tsx";
const LIBRARY_PAGINA = "src/app/library/LibraryPageClient.tsx";
const EXPLORAR_PAGINA = "src/app/explorar/ExplorarPageClient.tsx";
const EM_DIA_PAGINA = "src/app/em-dia/EmDiaPageClient.tsx";
const LOGIN = "src/app/login/LoginPageClient.tsx";
const POSTER_CARD_2 = "src/components/PosterCard.tsx";
const DISCOVER_CARD = "src/components/DiscoverCard.tsx";
const MANIFEST = "src/app/manifest.ts";
const SHEET_PANEL = "src/components/SheetPanel.tsx";
const LISTAS_PAGINA = "src/app/listas/page.tsx";
const ADD_TO_LIST = "src/components/AddToListButton.tsx";
const BOTTOM_NAV = "src/components/BottomNav.tsx";
const LISTAS_CONTEUDO = "src/components/ListasConteudo.tsx";
const WATCHNEXT = "src/lib/watchnext.ts";
const STATS_PERFIL = "src/lib/stats.ts";
const BACKFILL = "src/lib/backfill.ts";
const SWIPE_CARD = "src/components/SwipeCard.tsx";
const VIEW_TOGGLE = "src/components/ViewModeToggle.tsx";
const TEXTO_IMPORTAR = "src/lib/textoImportar.ts";
const ADVANCED_STATS = "src/lib/advancedStats.ts";
const VAZIO_BIBLIOTECA = "src/components/LibraryEmptyState.tsx";
const LAYOUT = "src/app/layout.tsx";
const POSTER = "src/components/Poster.tsx";
const CASA_CASCA = "src/app/series/page.tsx";
const ESTREAR = "src/app/estrear/EstrearPageClient.tsx";
const FILME_PAGINA = "src/app/movies/[key]/MoviePageClient.tsx";
const CABECALHO = "src/components/CabecalhoEcra.tsx";
const CONTROLOS_BIBLIOTECA = "src/components/LibraryControls.tsx";
const LISTAS_ROTA = "src/app/listas/page.tsx";

/**
 * Mutações retiradas na Fase 10 (Ronda 14): o desenho que elas ameaçavam já não
 * existe. Cada uma diz onde o mesmo risco passou a ser guardado.
 */
const RETIRADAS = {
  "fase4/separadores-acessiveis": "os três separadores do detalhe saíram na Fase 4 (Mira) — já não há `aria-controls` nem tablist",
  "fase4/separadores-com-setas": "idem: as setas entre separadores morreram com os separadores; o segmentado das temporadas tem `role=radio` e é coberto pelas mutações do Segmentado",
  "r12-fase5b/biblioteca-sem-h1": "o `<h1>` é agora da `TituloGrande`, comum a todos os ecrãs — coberto por `r14-f10/titulo-grande-sem-h1`",
  "r12-fase5b/perfil-sem-h1": "idem (`TituloGrande`)",
  "r12-fase5b/explorar-sem-h1": "idem (`TituloGrande`)",
  "r12-fase5b3/biblioteca-sem-titulo": "o título já não é `sr-only`, é o título grande — coberto por `r14-f10/titulo-grande-so-para-leitores`",
  "r12-fase5b/em-curso-verde": "as secções da Biblioteca já não têm cor (regra da Mira) — coberto por `r14-f10/seccao-com-cor`",
  "r12-fase5d/por-comecar-amarelo": "idem — coberto por `r14-f10/seccao-com-cor`",
  "r12-fase5d/modo-ativo-branco": "o `ViewModeToggle` saiu na Fase 6; o mesmo risco (escolha a parecer ação) é `r12-fase5b3/separador-volta-a-branco`, no `Segmentado`",
  "r12-fase5b3/contagens-a-320": "as folhas/barra `LibraryControls` saíram na Fase 5; o risco (a barra alargar a página a 320px) é `r14-f10/segmentado-alarga`",
  "r12-f5/contagens-em-px": "idem",
  "r12-f5/separador-sem-teto": "idem",
  "r12-f4/barra-volta-a-baixo": "a barra da Biblioteca já não cola: cola-se a barra compacta e os cabeçalhos das secções — `r14-f10/seccao-nao-cola`",
  "r12-fase5b3/secundaria-debaixo-da-dock": "o cartão da ação secundária do detalhe (`mt-20`) já não existe; a reserva da dock é medida por `r12-fase5e/filme-reserva-a-dock` e pelos testes da Fase 4",
  "r12-fecho/estrear-data-come-a-linha": "a data do A estrear passou para a linha de baixo (Fase 8); já não compete com o nome — o nome a quebrar é `r12-fase5d/estrear-corta-o-nome`",
  "r12-f5/perfil-sem-min-w": "as três colunas de números do Perfil saíram (Fase 7): o `Contador` é uma grelha, sem `flex-1`",
  "r12-fase5b/cabecalhos-6-cores": "a `SectionHeader` e o `sectionColor` saíram na Fase 12 (a barrinha da Triagem era decoração: `explorar-mira.spec`, «a pastilha de onde veio»); os cabeçalhos das secções da Biblioteca são `r14-f10/seccao-com-cor`",
  "r12-fase5b/hover-ambar-volta": "o `.ep-card-hover` e o `WatchNextCard` saíram na Fase 12 (código morto); num ecrã tátil não há hover",
  "r12-fase5e/sizes-fila": "o `WatchNextCard` saiu na Fase 12 (código morto); a fila da casa é `LinhaFila`, coberta por `p3.spec`",
  "r12-fase5b/maratona-1-episodios": "equivalente: «Melhor maratona» com um só episódio já não aparece (`decisao.spec`, «superada pela 5e»), por isso o singular é inalcançável",
  "r12-fase6/ritual-festeja-o-anular": "equivalente com a Fase 3: o ritual só corre enquanto o otimista está aceso (`ritual={otimista || fim ? marcacoes : 0}`), por isso contar uma marcação a mais ao anular não se vê; o risco a sério é `r14-f3/anular-reacende`",
  "r12-fase6/ritual-reduzido-varre": "a classe `.barra-acende` saiu na Fase 12 (o ritual é `data-ritual` em `Segmentos`); com movimento reduzido, o que se guarda é `r12-fase6/ritual-sem-barra`"
};

/**
 * `de` tem de existir tal e qual no ficheiro — se deixar de existir, a
 * mutação deixa de repor o bug que diz repor e passaria a dar um falso
 * "apanhado". O guião estoira nesse caso, de propósito.
 */
const MUTACOES = [
  {
    nome: "fase1/inferencia-de-buracos",
    descricao: "encontrarBuracos deixa de encontrar nada",
    ficheiro: BURACOS,
    de: "  if (ultimoVisto < 0) return VAZIO;",
    para: "  if (ultimoVisto < 0) return VAZIO;\n  return VAZIO;",
  },
  {
    nome: "fase2/corridas-colapsam",
    descricao: "nenhuma corrida de vistos colapsa (volta a 51 linhas)",
    ficheiro: RUNS,
    de: "const CORRIDA_MINIMA = 4;",
    para: "const CORRIDA_MINIMA = 99999;",
  },
  {
    nome: "fase2/cabecalho-fixo",
    descricao: "o cabeçalho da temporada deixa de ser sticky",
    ficheiro: "src/app/series/[uuid]/PainelEpisodios.tsx",
    de: "<div className=\"sticky top-0 z-10 -mx-4 flex min-h-11",
    para: "<div className=\"-mx-4 flex min-h-11",
  },
  {
    nome: "fase2/visto-vs-por-ver",
    descricao: "visto e por ver voltam a desenhar-se iguais",
    ficheiro: "src/app/series/[uuid]/LinhaEpisodio.tsx",
    de: "isSeen ? \"opacity-55\" : \"\"",
    para: "isSeen ? \"\" : \"\"",
  },
  {
    nome: "fase3/balde-por-comecar",
    descricao: "'Por começar' volta para dentro do 'A ver'",
    ficheiro: "src/app/library/LibraryPageClient.tsx",
    de: "    if (s.watchedCount === 0) return \"Por começar\";\n    return parada",
    para: "    return parada",
  },
  {
    nome: "fase3/ordem-das-seccoes",
    descricao: "as completas voltam para o segundo lugar",
    ficheiro: "src/app/library/LibraryPageClient.tsx",
    de: "const ESTADOS = [\n  \"Em curso\",\n  \"Retomar\",\n  \"Por começar\",\n  \"Completas\",",
    para: "const ESTADOS = [\n  \"Em curso\",\n  \"Completas\",\n  \"Retomar\",\n  \"Por começar\",",
  },
  {
    nome: "fase3/dobrar-completas",
    descricao: "as 57 completas voltam a ficar todas abertas",
    ficheiro: BIBLIOTECA,
    de: "const DOBRAR_A_PARTIR_DE = 12;",
    para: "const DOBRAR_A_PARTIR_DE = 99999;",
  },
  {
    nome: "fase4/altura-do-heroi",
    descricao: "o herói volta a 290px fixos e empurra o próximo episódio para fora de um ecrã baixo",
    ficheiro: "src/app/series/[uuid]/CabecalhoSerie.tsx",
    de: "h-[min(290px,40vh)]",
    para: "h-[290px]",
  },
  {
    nome: "fase4/uma-acao-preenchida",
    descricao: "as duas ações voltam a ser blocos brancos iguais",
    ficheiro: "src/app/series/[uuid]/AcoesSerie.tsx",
    de: ") : nextUp && buracos.total > 0 ? (",
    para: ") : nextUp && buracos.total < 0 ? (",
  },
  {
    nome: "fase4/progresso-no-heroi",
    descricao: "a contagem do herói deixa de seguir o progresso",
    ficheiro: "src/app/series/[uuid]/CabecalhoSerie.tsx",
    de: "{watchedCount}/{show.totalEpisodes}",
    para: "{0}/{show.totalEpisodes}",
  },
  {
    nome: "fase4/pastilha-para-o-ecra",
    descricao: "abrir a última temporada deixa a pastilha fora do ecrã (a faixa não se centra nela)",
    ficheiro: "src/app/series/[uuid]/useSerie.ts",
    de: "left: chip.offsetLeft - (faixa.clientWidth - chip.offsetWidth) / 2,",
    para: "left: 0,",
  },
  // ── Ronda 12 ──────────────────────────────────────────────
  {
    nome: "r12/filme-reconhecido",
    descricao: "a pesquisa deixa de reconhecer o filme que já tens (volta a duplicá-lo)",
    ficheiro: EXISTENTE,
    de: "}): Promise<StoredMovie | null> {\n  const direto",
    // uma condição que o TypeScript não consegue dar como sempre verdadeira:
    // `if (procura)` tornava o resto da função inalcançável, o build falhava,
    // e o guião contava isso como bug apanhado
    para: "}): Promise<StoredMovie | null> {\n  if (procura.tmdbId !== -1) return null;\n  const direto",
  },
  {
    nome: "r12/serie-reconhecida",
    descricao: "a pesquisa deixa de reconhecer a série que já tens (volta a duplicá-la)",
    ficheiro: EXISTENTE,
    de: "}): Promise<StoredShow | null> {\n  for (const chave of [",
    para: "}): Promise<StoredShow | null> {\n  if (procura.nomes.length >= 0) return null;\n  for (const chave of [",
  },
  {
    nome: "r12/nome-portugues-na-pesquisa-local",
    descricao: "a pesquisa local volta a conhecer só o nome do TV Time",
    ficheiro: BIBLIOTECA,
    de: "list.filter((m) => [m.name, ...(m.aliases ?? [])].some((n) => norm(n).includes(q)));",
    para: "list.filter((m) => norm(m.name).includes(q));",
  },
  {
    nome: "r12/repetidos-por-id",
    descricao: "a limpeza de repetidos volta a juntar só pelo nome",
    ficheiro: REPAIR,
    de: "    if (ia.tmdb != null && ia.tmdb === ib.tmdb) return true;",
    para: "    if (false) return true;",
  },
  {
    nome: "r12/filmes-repetidos",
    descricao: "os filmes repetidos deixam de ser encontrados",
    ficheiro: REPAIR,
    de: "  for (const grupo of agrupar(filmes, mesmoFilme)) {",
    para: "  for (const grupo of [] as StoredMovie[][]) {",
  },
  {
    nome: "r12/remake-nunca-junta",
    descricao: "um remake ligado por um terceiro registo é juntado ao original",
    ficheiro: REPAIR,
    de: "const saem = grupo.filter((m) => m.key !== fica.key && mesmoFilme(fica, m));",
    para: "const saem = grupo.filter((m) => m.key !== fica.key);",
  },
  {
    nome: "r12/so-o-estreado-conta",
    descricao: "as temporadas voltam a contar os episódios anunciados",
    ficheiro: METADATA,
    de: "          estreados: c.estreados,",
    para: "          estreados: c.listados,",
  },
  {
    nome: "r12/total-atualiza",
    descricao: "o total guardado volta a ficar preso ao valor do import",
    ficheiro: "src/app/series/[uuid]/useSerie.ts",
    de: "        if (total !== atual.totalEpisodes) {",
    para: "        if (false) {",
  },
  {
    nome: "r12/datas-inexatas",
    descricao: "o \"vi tudo\" volta a marcar com a data de hoje como certa",
    ficheiro: DB,
    de: "      watchedAt: agora,\n      dateIsExact: exata,\n    });",
    para: "      watchedAt: agora,\n      dateIsExact: true,\n    });",
  },
  {
    nome: "r12/estatisticas-sem-inexatas",
    descricao: "as marcações em massa voltam a parecer maratonas",
    ficheiro: STATS,
    de: "  watched = watched.filter((ep) => ep.dateIsExact !== false);",
    para: "",
  },
  {
    nome: "r12/rever-so-os-de-tras",
    descricao: "\"só os de trás\" passa a marcar também os que estão à frente",
    ficheiro: REVER_PAGINA,
    de: 'void marcar(prova, `${contarEpisodios(prova.length)} marcados`)',
    para: 'void marcar(atual.porMarcar, `${contarEpisodios(prova.length)} marcados`)',
  },
  {
    nome: "r12/rever-sem-arquivadas",
    descricao: "a revisão volta a perguntar pelas séries arquivadas",
    ficheiro: REVER,
    de: "    (s) => !s.archived && !jaRespondidas.has(s.uuid),",
    para: "    (s) => !jaRespondidas.has(s.uuid),",
  },
  {
    nome: "r12/rever-ainda-a-ver-nao-volta",
    descricao: "\"ainda estou a ver\" deixa de ser lembrado",
    ficheiro: REVER,
    de: "  atuais.add(uuid);\n  await kvSet(CHAVE_A_VER, [...atuais]);",
    para: "  await kvSet(CHAVE_A_VER, [...atuais]);",
  },
  // ── Ronda 12, Fase 2: o portão ─────────────────────────────
  {
    nome: "r12-portao/sync-substitui",
    descricao: "sincronizar volta a substituir a série local pela da cloud",
    ficheiro: LINHAS,
    de: "  if (!local) return nuvem;\n  const saber",
    para: "  if (!local || nuvem.uuid.length >= 0) return nuvem;\n  const saber",
  },
  {
    nome: "r12-portao/numeracao-nao-sobe",
    descricao: "a numeração deixa de ir para a cloud",
    ficheiro: LINHAS,
    de: "    numeracao: s.numeracao ?? null,",
    para: "    numeracao: null,",
  },
  {
    nome: "r12-portao/filme-meio-na-cloud",
    descricao: "o id da TMDB dos filmes deixa de ir para a cloud",
    ficheiro: LINHAS,
    de: "    tmdb_id: m.tmdbId ?? null,",
    para: "    tmdb_id: null,",
  },
  {
    nome: "r12-portao/serie-fora-da-fila",
    descricao: "mudar uma série volta a não entrar na fila da cloud",
    ficheiro: DB,
    de: "  await database.put(\"shows\", next);\n  await enfileirarSerie(uuid);",
    para: "  await database.put(\"shows\", next);",
  },
  {
    nome: "r12-portao/listas-fora-da-fila",
    descricao: "mexer numa lista volta a não entrar na fila da cloud",
    ficheiro: DB,
    de: "  list.items = list.items.filter((i) => !(i.kind === kind && i.refId === refId));\n  await database.put(\"lists\", list);\n  await enfileirarKv(\"listas\");",
    para: "  list.items = list.items.filter((i) => !(i.kind === kind && i.refId === refId));\n  await database.put(\"lists\", list);",
  },
  {
    nome: "r12-portao/cura-desligada",
    descricao: "a numeração perdida deixa de ser recuperada",
    ficheiro: NUMERACAO,
    de: "  if (aCorrer || !(await hasTmdb())) return 0;",
    para: "  if (aCorrer || (await hasTmdb())) return 0;",
  },
  {
    nome: "r12-portao/enriquecimento-congela-a-errada",
    descricao: "o enriquecimento volta a congelar a numeração pela regra antiga",
    ficheiro: METADATA,
    de: "    const ambigua = !show.numeracao && show.tmdbId && show.tvmazeId != null;",
    para: "    const ambigua = false;",
  },
  {
    nome: "r12-portao/reparacao-apaga-ambiguas",
    descricao: "a verificação volta a oferecer apagar marcações de séries em dúvida",
    ficheiro: REPAIR,
    de: "    if (!show.numeracao && show.tmdbId && show.tvmazeId != null) continue;",
    para: "",
  },
  // ── Ronda 12, Fase 5: decisão e palavras ───────────────────
  {
    nome: "r12-fase5/pilula-em-dia",
    descricao: "a pílula volta a dizer \"10 em dia\" quando há 10 séries por ver",
    ficheiro: "src/app/series/SeriesPageClient.tsx",
    de: "        Pôr em dia\n        <span className=\"ep-code font-medium text-label-2\">{queue.length}</span>",
    para: "        {queue.length} em dia",
  },
  {
    nome: "r12-fase5/em-dia-abre-vazio",
    descricao: "o Pôr em dia volta a abrir sempre em \"Continuar\", mesmo vazio",
    ficheiro: EM_DIA,
    de: "  if (porOmissao === null && buckets) setPorOmissao(primeiroComConteudo(buckets));",
    para: '  if (porOmissao === null && buckets) setPorOmissao("continuar");',
  },
  {
    nome: "r12-fase5/filtro-vazio-sem-saida",
    descricao: "o filtro vazio deixa de apontar para o filtro com conteúdo",
    ficheiro: EM_DIA,
    de: "  const saida = primeiroComConteudo(buckets);",
    para: "  const saida: Filter = filter;",
  },
  {
    nome: "r12-fase5/continuar-fora-do-url",
    descricao: "escolher \"Continuar\" volta a não ficar no URL",
    ficheiro: EM_DIA,
    de: '    next.set("filtro", f);',
    para: '    if (f === "continuar") next.delete("filtro");\n    else next.set("filtro", f);',
  },
  {
    nome: "r12-fase5/rever-vi-tudo-recomendado",
    descricao: "a ação preenchida do Rever volta a marcar tudo, não só o que a prova cobre",
    ficheiro: REVER_PAGINA,
    de: '  const prova = atual?.padrao === "buracos" ? atual.paraTras : null;',
    para: '  const prova = atual?.padrao === "buracos" ? atual.porMarcar : null;',
  },
  {
    nome: "r12-fase5/rever-pergunta-com-resposta",
    descricao: "sem prova nenhuma, o Rever volta a recomendar marcar tudo",
    ficheiro: REVER_PAGINA,
    de: '  const prova = atual?.padrao === "buracos" ? atual.paraTras : null;',
    para: '  const prova = atual ? (atual.padrao === "buracos" ? atual.paraTras : atual.porMarcar) : null;',
  },
  {
    nome: "r12-fase5/seguir-diz-a-seguir",
    descricao: "seguir uma série volta a dizer \"A seguir\", a palavra da fila",
    ficheiro: RESULTADO_SERIE,
    de: "            Em «Por começar»",
    para: "            A seguir",
  },
  {
    nome: "r12-fase5/biblioteca-a-ver",
    descricao: "a secção das séries começadas volta a chamar-se \\\"A ver\\\", ao lado de \\\"Para ver\\\"",
    ficheiro: "src/app/library/LibraryPageClient.tsx",
    de: "? \"Retomar\" : \"Em curso\";",
    para: "? \"Retomar\" : \"A ver\";",
  },
  {
    nome: "r12-fase5/casa-vazia-pede-zip",
    descricao: "a casa vazia volta a ter \"importar do TV Time\" como primeira ação",
    ficheiro: "src/app/series/SeriesPageClient.tsx",
    de: "            href=\"/explorar?procurar=1\"\n            className=\"flex min-h-[52px]",
    para: "            href=\"/import\"\n            className=\"flex min-h-[52px]",
  },
  {
    nome: "r12-fase5/explorar-sem-seguir",
    descricao: "guardar uma série no Explorar deixa de a pôr na fila (não faz nada)",
    ficheiro: "src/lib/useExploreAcoes.ts",
    de: "(item.kind === \"movie\" ? guardarFilme(item) : seguir(item))",
    para: "(item.kind === \"movie\" ? guardarFilme(item) : Promise.resolve())",
  },
  {
    nome: "r12-fase5/sem-seguidas-em-dia",
    descricao: "sem nenhuma série seguida, a casa volta a dizer \"Estás em dia\"",
    ficheiro: "src/app/series/SeriesPageClient.tsx",
    de: "          {watching.length === 0 ? (\n            <Linha",
    para: "          {watching.length < 0 ? (\n            <Linha",
  },
  {
    nome: "r12-fase5/remover-invisivel",
    descricao: "o ✕ da capa volta a só aparecer com hover (num ecrã tátil nunca aparece)",
    ficheiro: "src/components/mira/Cartaz.tsx",
    de: "className=\"group/marcar absolute bottom-0 right-0 flex h-11 w-11",
    para: "className=\"group/marcar opacity-0 absolute bottom-0 right-0 flex h-11 w-11",
  },
  {
    nome: "r12-fase5/aviso-mudo",
    descricao: "o aviso de anular volta a não ser anunciado",
    ficheiro: AVISO,
    de: '      role="status"\n      aria-live="polite"\n',
    para: "",
  },
  {
    nome: "r12-fase5/campo-sem-nome",
    descricao: "o campo de renomear a lista volta a não ter nome",
    ficheiro: LISTA,
    de: '              aria-label="Nome da lista"\n',
    para: "",
  },
  {
    nome: "r12-fase5b/brilho-volta",
    descricao: "a barra de progresso da grelha volta a ter o brilho decorativo",
    ficheiro: "src/components/mira/Cartaz.tsx",
    de: "style={{ width: `${barra.largura}%`, background: barra.cor }}",
    para: "style={{ width: `${barra.largura}%`, background: barra.cor, boxShadow: `0 0 6px ${barra.cor}` }}",
  },
  {
    nome: "r12-fase5b/data-importacao-crua",
    descricao: "a data da última importação volta a aparecer em ISO cru",
    ficheiro: "src/app/profile/definicoes/DefinicoesPageClient.tsx",
    de: "`Última importação a ${porExtenso(importadoEm)}`",
    para: "`Última importação a ${importadoEm.slice(0, 10)}`",
  },
  {
    nome: "r12-fase5b/genero-por-traduzir",
    descricao: "os géneros do detalhe voltam a aparecer em inglês",
    ficheiro: "src/app/series/[uuid]/CabecalhoSerie.tsx",
    de: "translateGenre(show.genres[0])",
    para: "show.genres[0]",
  },
  {
    nome: "r12-fase5b/import-vocabulario-de-computador",
    descricao: "o import volta a dizer 'clica' em vez de 'toca'",
    ficheiro: IMPORT_PAGINA,
    de: "Toca para escolher o ZIP",
    para: "Clica para escolher o ZIP",
  },
  {
    nome: "r12-fase5b/scroll-fantasma-margem-cancelada",
    descricao: "a .tela-cheia volta a não cancelar o respiro da dock — os 82px voltam nos três ecrãs",
    ficheiro: CSS,
    de: "  height: 100dvh;\n  margin-bottom: calc(-1 * (var(--dock-h) + 0.5rem));\n}",
    para: "  height: 100dvh;\n}",
  },
  {
    nome: "r12-fase5b/biblioteca-lcp-lazy",
    descricao: "as primeiras capas da Biblioteca voltam a carregar em lazy",
    ficheiro: "src/components/ShowPoster.tsx",
    de: "indice={index}",
    para: "indice={undefined}",
  },
  {
    nome: "r12-fase5b/explorar-lcp-lazy",
    descricao: "as primeiras capas do Explorar voltam a carregar em lazy",
    ficheiro: "src/components/DiscoverCard.tsx",
    de: "indice={index}",
    para: "indice={undefined}",
  },
  {
    nome: "r12-fase5b/manifest-cor-v1",
    descricao: "o manifest volta à cor de tema da v1",
    ficheiro: MANIFEST,
    de: "theme_color: \"#000000\"",
    para: "theme_color: \"#0b0e14\"",
  },
  {
    nome: "r12-fase5b/apagar-lista-vermelho-sempre",
    descricao: "'Apagar lista' volta a ficar vermelho em repouso",
    ficheiro: "src/app/listas/[id]/ListaPageClient.tsx",
    de: "className={`mt-10 ${confirmDelete ? \"text-danger!\" : \"text-label-2!\"}`}",
    para: "className=\"mt-10 text-danger!\"",
  },
  {
    nome: "r12-fase5b/apagar-dados-vermelho-sempre",
    descricao: "'Apagar dados locais' volta a ficar vermelho em repouso",
    ficheiro: "src/app/profile/definicoes/DefinicoesPageClient.tsx",
    de: "onClick={() => setConfirmClear(true)}\n            />",
    para: "onClick={() => setConfirmClear(true)}\n              perigo\n            />",
  },
  {
    nome: "r12-fase5b/anular-desaparece-com-movimento-reduzido",
    descricao: "com movimento reduzido, a contagem do anular volta a desaparecer de imediato",
    ficheiro: CSS,
    // o bloco do movimento reduzido foi reescrito na Fase 6 (já não zera
    // tudo); o mesmo bug é alguém voltar a zerar a contagem lá dentro
    de: "  .undo-out {\n    animation-name: apagar;\n  }",
    para: "  .undo-out {\n    animation-name: apagar;\n  }\n  .undo-drain {\n    animation-duration: 0.01ms !important;\n  }",
  },
  {
    nome: "r12-fase5b/listas-transborda-320",
    descricao: "/listas volta a transbordar a 320px",
    ficheiro: LISTAS_CONTEUDO,
    de: '"min-h-11 min-w-0 flex-1',
    para: '"min-h-11 flex-1',
  },
  {
    nome: "r12-fase5b/folha-sem-gestao-de-foco",
    descricao: "abrir uma folha volta a não mover o foco para dentro",
    ficheiro: SHEET_PANEL,
    de: "    antesDeAbrir.current = document.activeElement as HTMLElement | null;\n    painelRef.current?.focus();",
    para: "    antesDeAbrir.current = document.activeElement as HTMLElement | null;",
  },
  {
    nome: "r12-fase5b/listas-campo-sem-rotulo",
    descricao: "o campo de nova lista volta a não ter aria-label",
    ficheiro: LISTAS_CONTEUDO,
    de: '          aria-label="Nome da nova lista"\n',
    para: "",
  },
  {
    nome: "r12-fase5b/biblioteca-pesquisa-sem-rotulo",
    descricao: "a pesquisa da Biblioteca volta a não ter aria-label",
    ficheiro: LIBRARY_PAGINA,
    de: '            aria-label="Procurar na biblioteca"\n',
    para: "",
  },
  {
    nome: "r12-fase5b/explorar-pesquisa-sem-rotulo",
    descricao: "a pesquisa do Explorar volta a não ter aria-label",
    ficheiro: "src/app/explorar/ExplorarPageClient.tsx",
    de: "aria-label=\"Procurar séries e filmes\"",
    para: "",
  },
  {
    nome: "r12-fase5b/add-to-list-campo-sem-rotulo",
    descricao: "o campo de nova lista no detalhe volta a não ter aria-label",
    ficheiro: ADD_TO_LIST,
    de: '              aria-label="Nome da nova lista"\n',
    para: "",
  },
  // Retirada na Ronda 14 (Mira, Fase 1): «r12-fase5b/dock-parte-a-seguir-320» — na barra da Mira o nome só aparece quando a coluna o comporta (`@[3.4rem]`), por isso partir em duas linhas deixou de ser possível por construção; o `whitespace-nowrap` é defensivo e sem mutação útil
  {
    nome: "r12-fase5b2/heroi-volta-a-40px",
    descricao: "o nome da série na casa volta a fugir da rampa (40px em vez do Título 1)",
    ficheiro: "src/components/TonightHero.tsx",
    de: "line-clamp-3 wrap-anywhere text-[1.65rem]",
    para: "line-clamp-3 wrap-anywhere text-[2.5rem]",
  },
  {
    nome: "r12-fase5b2/texto-volta-a-px",
    descricao: "o nome do cartaz volta a um valor absoluto (não responde à raiz)",
    ficheiro: "src/components/mira/Cartaz.tsx",
    de: "grande ? \"text-[0.9375rem]\" : \"text-[0.76rem]\"",
    para: "grande ? \"text-[15px]\" : \"text-[13px]\"",
  },
  // ── Ronda 12, Fase 5b.3: decisões de desenho ───────────────
  {
    nome: "r12-fase5b3/dock-acende-pelo-tipo",
    descricao: "a dock volta a acender pelo tipo do ecrã, não pela origem",
    ficheiro: BOTTOM_NAV,
    de: "  const ativo = raiz ?? origem ?? separadorDaRota(pathname);",
    para: "  const ativo = raiz ?? separadorDaRota(pathname) ?? origem;",
  },
  {
    nome: "r12-fase5b3/recuar-volta-a-texto",
    descricao: "recuar volta a ser um texto em vez do círculo com seta",
    ficheiro: CABECALHO,
    de: "        <IconeRecuar />",
    para: "        {voltar}",
  },
  {
    nome: "r12-fase5b3/para-ver-volta-a-branco",
    descricao: "o 'Para ver' do Explorar volta a ser uma pílula branca",
    ficheiro: "src/components/DiscoverCard.tsx",
    de: "void guardar()} className={`${botao} bg-fill text-label`}",
    para: "void guardar()} className={`${botao} bg-label text-bg`}",
  },
  {
    nome: "r12-fase5b3/separador-volta-a-branco",
    descricao: "o segmento escolhido volta a ser a pílula branca",
    ficheiro: "src/components/mira/Segmentado.tsx",
    de: "? \"bg-segment text-label shadow-[var(--m-seg-sombra)]\"",
    para: "? \"bg-label text-bg\"",
  },
  {
    nome: "r12-fase5b3/escolha-volta-a-branco",
    descricao: "uma escolha no Pôr em dia volta a ser uma pílula branca",
    ficheiro: "src/app/em-dia/EmDiaPageClient.tsx",
    de: "? \"bg-fill-strong text-label\"",
    para: "? \"bg-label text-bg\"",
  },
  {
    nome: "r12-fase5b3/biblioteca-volta-a-2-colunas",
    descricao: "a Biblioteca volta a abrir em 2 colunas de cartazes",
    ficheiro: "src/app/library/LibraryPageClient.tsx",
    de: "grid grid-cols-3 gap-x-2.5",
    para: "grid grid-cols-2 gap-x-2.5",
  },
  {
    nome: "r12-fase5b3/filmes-para-ver-escondidos",
    descricao: "os filmes 'para ver' voltam a ficar de fora por omissão",
    ficheiro: LIBRARY_PAGINA,
    de: '        "todos";',
    para: '        "vistos";',
  },
  {
    nome: "r12-fase5b3/listas-sem-separador",
    descricao: "as Listas deixam de ser um separador da Biblioteca",
    ficheiro: LIBRARY_PAGINA,
    de: '  const segment: Segment = tipo === "filmes" || tipo === "listas" ? tipo : "series";',
    // o `as Segment` impede o TypeScript de estreitar o tipo — sem ele a
    // mutação não compilava (comparar com "listas" deixava de fazer sentido)
    para: '  const segment = (tipo === "filmes" ? "filmes" : "series") as Segment;',
  },
  {
    nome: "r12-fase5b3/listas-rota-sem-desvio",
    descricao: "/listas deixa de levar ao separador das Listas",
    ficheiro: LISTAS_ROTA,
    de: '    router.replace("/library?tipo=listas");',
    para: "    void router;",
  },
  {
    nome: "r12-fase5b3/apagar-lista-leva-o-aviso",
    descricao: "apagar uma lista volta a navegar por /listas — dois ecrãs, e o aviso de anular perde-se",
    ficheiro: LISTA,
    de: '    router.push("/library?tipo=listas");',
    para: '    router.push("/listas");',
  },
  {
    nome: "r12-fase5b3/casa-sem-ou-entao",
    descricao: "a casa volta a dar uma resposta só, sem alternativas por baixo do herói",
    ficheiro: "src/app/series/SeriesPageClient.tsx",
    de: "          <OuEntao alternativas={alternativas} />\n",
    para: "",
  },
  {
    nome: "r12-fase5b3/ou-entao-filme-mais-antigo",
    descricao: "o 'Ou então' volta a propor o filme mais antigo da lista em vez do mais recente",
    ficheiro: CASA,
    de: '.sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""))[0];',
    para: '.sort((a, b) => (a.addedAt ?? "").localeCompare(b.addedAt ?? ""))[0];',
  },
  {
    nome: "r12-fase5b3/detalhe-vazio-no-fim",
    descricao: "o detalhe volta a reservar o espaço da dock outra vez — 188px de nada no fim",
    ficheiro: "src/app/series/[uuid]/ShowPageClient.tsx",
    // com a linha do comentário: sem ela, a âncora batia primeiro no <main>
    // do ecrã de carregamento, que tem a mesma classe
    de: '    <main className="mx-auto w-full max-w-2xl pb-6">',
    para: '    <main className="mx-auto w-full max-w-2xl pb-[calc(var(--dock-h)+2rem)]">',
  },
  // ── Ronda 12, Fase 5c: os 6 P1 da crítica 5b.4 ─────────────
  {
    // sem o último visto, a procura parte do início da série: é o bug original
    nome: "r12-fase5c/proximo-e-o-primeiro-buraco",
    descricao: 'o próximo episódio volta a ser o primeiro por marcar desde o S01·E01 — um buraco',
    ficheiro: WATCHNEXT,
    de: '    if (w.season < 1) continue;\n',
    para: '    if (w.season < 1 || true) continue;\n',
  },
  {
    nome: "r12-fase5c/dock-sem-nome",
    descricao: "os separadores voltam a ficar sem nome para o VoiceOver quando o texto grande esconde os nomes",
    ficheiro: BOTTOM_NAV,
    de: "              aria-label={label}\n",
    para: "",
  },
  {
    nome: "r12-fase5c/antena-congelada",
    descricao: 'o Tempo de antena volta a ser só o total do import',
    ficheiro: STATS_PERFIL,
    de: '    hours: horasDeAntena(meta, shows, watched),',
    para: '    hours: meta?.totalSeriesRuntimeSec ? Math.round(meta.totalSeriesRuntimeSec / 3600) : null,',
  },
  {
    nome: "r12-fase5c/duracao-nunca-se-pergunta",
    descricao: 'o backfill deixa de pedir a duração às séries que já têm capa e total',
    ficheiro: BACKFILL,
    de: '        lista.filter(\n          (s) => s.posterPath && s.totalEpisodes && s.tmdbId && s.runtime === undefined,\n        ),\n',
    para: "",
  },
  {
    // a primeira das duas chamadas (a do id da TMDB): o trecho leva o fim do bloco para ser único
    nome: "r12-fase5c/duracao-nao-se-guarda",
    descricao: 'o enriquecimento pela TMDB deixa de guardar a duração de um episódio',
    ficheiro: METADATA,
    de: '          runtime: duracaoTmdb(details),\n        };\n      }\n    }\n\n    // TMDB completa',
    para: '          runtime: null,\n        };\n      }\n    }\n\n    // TMDB completa',
  },
  {
    nome: "r12-fase5c/rever-por-marcar-junta-tudo",
    descricao: "o Rever volta a chamar 'por marcar' ao que está à frente do último visto",
    ficheiro: REVER_PAGINA,
    de: '<span className="ep-code">{atual.paraTras.length}</span> por marcar ·{" "}\n                    <span className="ep-code">{temporadasDe(atual.paraTras)}</span>',
    para: '<span className="ep-code">{atual.porMarcar.length}</span> por marcar ·{" "}\n                    <span className="ep-code">{temporadasDe(atual.porMarcar)}</span>',
  },
  {
    nome: "r12-fase5c/baralho-serie-pequena",
    descricao: "no Pôr em dia, a série volta a 12px, cinza, em maiúsculas",
    ficheiro: "src/components/SwipeCard.tsx",
    de: "<h2 className=\"line-clamp-2 text-[1.65rem] font-bold leading-[1.1] text-label\">",
    para: "<h2 className=\"truncate text-xs font-semibold uppercase tracking-[0.18em] text-label-2\">",
  },
  {
    nome: "r12-fase5c/baralho-nome-duas-vezes",
    descricao: 'sem capa, o nome da série volta a aparecer no lugar da arte e no título',
    ficheiro: SWIPE_CARD,
    de: '<TvIcon className="h-12 w-12" />',
    para: '{showName}',
  },
  {
    nome: "r12-fase5c/onboarding-portas-no-fundo",
    descricao: "as duas portas do primeiro uso voltam a ficar debaixo do degradê da barra",
    ficheiro: "src/app/series/SeriesPageClient.tsx",
    de: "<div className=\"mt-auto flex flex-col gap-2.5 pb-4 pt-5\">",
    para: "<div className=\"mt-auto flex flex-col gap-2.5 pb-4 pt-40\">",
  },
  // Retirada na Ronda 14 (Mira, Fase 2): «r12-fase5c/onboarding-seguir-sem-onde» — a casa vazia da Mira já não tem os quatro passos; o mesmo bug (não dizer onde está o Seguir) é a `r14-f2/dicas-perdidas`
  // ── Ronda 12, Fase 6: movimento e o ritual de marcar ───────
  {
    nome: "r12-fase6/reduzido-apaga-o-que-se-desloca",
    descricao: 'com movimento reduzido, as páginas e os cartazes voltam a aparecer de golpe',
    ficheiro: CSS,
    de: "  .page-enter,\n  .poster-in,\n  .undo-in,\n  .menu-abre,\n  .contagem-rola,\n  .segmento-constroi {\n    animation-name: esvanecer;\n  }",
    para: "  .page-enter,\n  .poster-in,\n  .undo-in,\n  .menu-abre,\n  .contagem-rola,\n  .segmento-constroi {\n    animation: none;\n  }",
  },
  {
    nome: "r12-fase6/reduzido-transicoes-a-zero",
    descricao: 'com movimento reduzido, as transições de cor voltam a 0,01ms',
    ficheiro: CSS,
    de: '    transition-property: opacity, color, background-color, border-color, box-shadow,\n      outline-color !important;',
    para: '    transition-duration: 0.01ms !important;',
  },
  {
    nome: "r12-fase6/curva-fraca",
    descricao: 'o ease-out volta a ser o do browser, que demora a arrancar',
    ficheiro: CSS,
    de: '  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);',
    para: '  --ease-out: ease-out;',
  },
  {
    nome: "r12-fase6/folha-sem-subida",
    descricao: 'a folha volta a aparecer no sítio, sem subir do fundo',
    ficheiro: CSS,
    de: '  .folha {\n    transform: translateY(100%);\n  }\n',
    para: "",
  },
  {
    nome: "r12-fase6/folha-desaparece-de-golpe",
    descricao: 'fechar a folha volta a desmontá-la logo, sem descer',
    ficheiro: SHEET_PANEL,
    de: '  if (!aberto && montada && !aFechar) setAFechar(true);',
    para: '  if (!aberto && montada) setMontada(false);',
  },
  {
    nome: "r12-fase6/folha-sem-piparote",
    descricao: 'a folha volta a só fechar depois de um arrasto longo',
    ficheiro: SHEET_PANEL,
    de: '    if (d > 0 && (velocidade > VELOCIDADE_FECHA || d > altura * DISTANCIA_FECHA)) onFechar();',
    para: '    if (d > 0 && (velocidade > 99 || d > altura * DISTANCIA_FECHA)) onFechar();',
  },
  {
    nome: "r12-fase6/aviso-com-mola",
    descricao: 'o aviso de anular volta a entrar a passar do alvo',
    ficheiro: CSS,
    de: '  animation: undo-in 200ms var(--ease-out) both;',
    para: '  animation: undo-in 200ms cubic-bezier(0.34, 1.36, 0.64, 1) both;',
  },
  {
    nome: "r12-fase6/aviso-desaparece-de-golpe",
    descricao: 'o aviso de anular volta a desaparecer de golpe',
    ficheiro: AVISO,
    de: '  const mostrado = top ?? aSair;',
    para: '  const mostrado = top ?? (aSair && null);',
  },
  {
    nome: "r12-fase6/baralho-sem-piparote",
    descricao: 'no baralho, um piparote curto volta a não decidir',
    ficheiro: SWIPE_CARD,
    de: '    const flick = velocity > FLICK_VELOCITY && Math.abs(drag.x) > FLICK_MIN;',
    para: '    const flick = velocity > 99 * FLICK_VELOCITY && Math.abs(drag.x) > FLICK_MIN;',
  },
  {
    nome: "r12-fase6/ritual-sem-barra",
    descricao: 'marcar na casa volta a não acender a barra',
    // reapontada na Fase 3 da Ronda 14: a barra passou a fatias da mira, uma por segmento
    ficheiro: "src/components/mira/Segmentos.tsx",
    de: "className={`absolute inset-0 ${n === ate ? \"mira-fica\" : \"mira-fatia\"}`}",
    para: "className=\"absolute inset-0 opacity-0\"",
  },
  // ── Ronda 12, Fase 5d: os P2 da crítica 5b.4 ───────────────
  {
    nome: "r12-fase5d/esta-semana-ciano",
    descricao: "'Esta semana' volta a ter o ciano dos buracos",
    ficheiro: CASA,
    // reapontada na Fase 3 da Ronda 14: o cabeçalho deixou de ser o SectionHeader
    de: '<h2 className="text-[1.3rem] font-bold leading-tight text-label">Esta semana</h2>',
    para: '<span className="h-4 w-1 bg-[#3fd2c8]" /><h2 className="text-[1.3rem] font-bold leading-tight text-label">Esta semana</h2>',
  },
  {
    nome: "r12-fase5d/traco-sem-ciano",
    descricao: "com buracos, o ponto do herói volta a não ter a cor «por marcar»",
    ficheiro: "src/app/series/[uuid]/CabecalhoSerie.tsx",
    de: "rounded-full bg-por-marcar align-[0.05em]",
    para: "rounded-full bg-label align-[0.05em]",
  },
  {
    nome: "r12-fase5d/semana-sem-janela",
    descricao: "'Esta semana' volta a mostrar o que estreia daqui a 17 dias",
    ficheiro: CASA,
    de: '  const estaSemana = (upcoming ?? []).filter((e) => (e.episode.airDate ?? "") <= limiteSemana);',
    para: '  const estaSemana = (upcoming ?? []).filter((e) => (e.episode.airDate ?? "") !== limiteSemana);',
  },
  {
    nome: "r12-fase5d/semana-vazia-sem-frase",
    descricao: 'sem nada esta semana, a secção volta a ficar calada',
    ficheiro: CASA,
    de: '          {estaSemana.length === 0 ? (',
    para: '          {estaSemana.length === -1 ? (',
  },
  {
    nome: "r12-fase5d/estrear-corta-o-nome",
    descricao: "o A estrear volta a cortar o nome da série",
    ficheiro: "src/app/estrear/EstrearPageClient.tsx",
    de: "<span className=\"block whitespace-normal break-words leading-snug\">{show.name}</span>",
    para: "<span className=\"block truncate\">{show.name}</span>",
  },
  {
    nome: "r12-fase5d/filme-nao-se-desmarca",
    descricao: "um filme visto volta a não se poder desmarcar",
    ficheiro: "src/app/movies/[key]/MoviePageClient.tsx",
    de: "{movie.watchedAt ? (\n          <Acao tipo=\"secundaria\"",
    para: "{!movie ? (\n          <Acao tipo=\"secundaria\"",
  },
  {
    nome: "r12-fase5d/separadores-alargam-a-pagina",
    descricao: "a 150%, a faixa das temporadas volta a alargar a página em vez de rolar",
    ficheiro: "src/app/series/[uuid]/PainelEpisodios.tsx",
    de: "<div className=\"-mx-4 flex snap-x gap-2 overflow-x-auto px-4 ",
    para: "<div className=\"-mx-4 flex snap-x gap-2 px-4 ",
  },
  {
    nome: "r12-fase5d/rever-saida-debaixo-da-dock",
    descricao: 'a introdução do Rever volta às três linhas, e a saída do cartão desce para debaixo da dock',
    ficheiro: REVER_PAGINA,
    de: '        Séries com menos marcado do que o que já estreou. Só tu sabes se as viste.',
    para: '        Séries com menos marcado do que o que já estreou. A app não sabe se as\n        viste — tu sabes. Uma de cada vez, e tudo se anula.',
  },
  {
    nome: "r12-fase5d/aviso-tapa-marcar",
    descricao: "o aviso de anular sobe de mais e tapa o «Marcar visto» da casa",
    ficheiro: "src/components/UndoToast.tsx",
    de: "style={{ bottom: \"calc(var(--dock-h) + 0.5rem)\" }}",
    para: "style={{ bottom: \"calc(var(--dock-h) + 14rem)\" }}",
  },
  {
    nome: "r12-fase5d/aviso-entra-na-dock",
    descricao: 'o aviso de anular volta a 64px do fundo, a entrar na dock',
    ficheiro: AVISO,
    de: 'style={{ bottom: "calc(var(--dock-h) + 0.5rem)" }}',
    para: 'style={{ bottom: "4rem" }}',
  },
  {
    nome: "r12-fase5d/visto-em-branco",
    descricao: "o ✓ de cada cartaz volta a ser a pílula branca",
    ficheiro: "src/components/mira/Cartaz.tsx",
    de: "<span className=\"vidro flex h-8 w-8 items-center justify-center rounded-full text-label transition-transform",
    para: "<span className=\"flex h-8 w-8 items-center justify-center rounded-full bg-label text-bg shadow-md transition-transform",
  },
  {
    nome: "r12-fase5d/espetro-com-estados",
    descricao: 'o espetro de géneros volta a usar verde, ciano e magenta',
    ficheiro: STATS_PERFIL,
    de: "const SPECTRUM = [degrau(85), degrau(62), degrau(45), degrau(32)];",
    para: 'const SPECTRUM = ["var(--color-smpte-red)", "var(--color-smpte-yellow)", "var(--color-smpte-green)", "var(--color-smpte-cyan)", "var(--color-smpte-blue)", "var(--color-smpte-magenta)"];',
  },
  // ── Ronda 12, Fase 8: o que o Safari do iOS mostrou ────────
  {
    nome: "r12-fase8/icone-em-cima-do-titulo",
    descricao: 'sem capa, o ícone volta a ficar centrado no cartão, em cima do título',
    ficheiro: SWIPE_CARD,
    de: '<div className="absolute inset-x-0 top-0 flex h-1/3 items-center justify-center">',
    para: '<div className="absolute inset-0 flex items-center justify-center">',
  },
  {
    nome: "r12-fase8/aviso-tapa-os-botoes-do-baralho",
    descricao: 'o aviso de anular volta a tapar o ✕ e o ✓ do cartão seguinte',
    ficheiro: EM_DIA_PAGINA,
    de: 'bottom-[calc(var(--dock-h)+5.5rem)] z-20',
    para: 'bottom-[calc(var(--dock-h)+2.25rem)] z-20',
  },
  // ── Ronda 12, Fase 5e: os P3 ───────────────────────────────
  {
    nome: "r12-fase5e/data-iso-no-detalhe",
    descricao: 'o detalhe volta a mostrar a atividade em ISO cru',
    ficheiro: "src/app/series/[uuid]/useSerie.ts",
    de: '      first: curta(dates[0]),',
    para: '      first: dates[0].slice(0, 10),',
  },
  {
    nome: "r12-fase5e/o-que-gostas",
    descricao: "o Explorar volta a dizer 'o que gostas', sem preposição",
    ficheiro: EXPLORAR,
    de: 'Ainda não sei do que gostas',
    para: 'Ainda não sei o que gostas',
  },
  {
    nome: "r12-fase5e/privacidade-falsa",
    descricao: "o Importar volta a prometer 'nada é enviado' com a cloud ligada",
    ficheiro: TEXTO_IMPORTAR,
    de: 'Tudo é processado aqui no teu aparelho — sobe para a tua conta se tiveres sessão iniciada.',
    para: 'Tudo é processado aqui no teu aparelho; nada é enviado para servidores.',
  },
  {
    nome: "r12-fase5e/entrar-sem-saida",
    // só o ramo sem cloud é exercitado: a suite corre sem chaves do Supabase,
    // e o formulário (com cloud) nunca chega a renderizar-se aqui
    descricao: 'o Entrar (sem cloud) volta a não ter recuar',
    ficheiro: LOGIN,
    de: 'justify-center px-6 text-center">\n        <BotaoDeSair />',
    para: 'justify-center px-6 text-center">',
  },
  {
    nome: "r12-fase5e/maratona-de-um-episodio",
    descricao: "'Melhor maratona' volta a aceitar um episódio só",
    ficheiro: ADVANCED_STATS,
    de: 'const LIMIAR_MARATONA = 2;',
    para: 'const LIMIAR_MARATONA = 1;',
  },
  {
    nome: "r12-fase5e/adicionar-uma-serie",
    descricao: "a Biblioteca vazia volta a mandar 'adicionar' uma série",
    ficheiro: VAZIO_BIBLIOTECA,
    de: '"Procura pelo nome para seguires a primeira."',
    para: '"Procura pelo nome para adicionares o primeiro."',
  },
  {
    nome: "r12-fase5e/renomear-32px",
    descricao: 'o botão de renomear a lista volta a ter só o alvo do texto',
    ficheiro: LISTA,
    de: 'className="tap-44 relative cursor-pointer text-left"',
    para: 'className="cursor-pointer text-left"',
  },
  {
    nome: "r12-fase5e/sizes-estrear",
    descricao: "o A estrear volta a pedir a imagem do ecrã inteiro",
    ficheiro: "src/app/estrear/EstrearPageClient.tsx",
    de: "fill sizes=\"36px\"",
    para: "fill",
  },
  {
    nome: "r12-fase5e/sizes-rever",
    descricao: 'o Rever volta a pedir a imagem do ecrã inteiro',
    ficheiro: REVER_PAGINA,
    de: 'fill sizes="56px"',
    para: 'fill',
  },
  {
    nome: "r12-fase5e/sizes-perfil",
    descricao: "o Perfil volta a pedir a imagem do ecrã inteiro",
    ficheiro: "src/app/profile/ProfilePageClient.tsx",
    de: "fill sizes=\"40px\"",
    para: "fill",
  },
  {
    nome: "r12-fase5e/titulo-sempre-episodic",
    descricao: "o <title> volta a ser o nome da app, igual em todos os ecrãs",
    ficheiro: LAYOUT,
    de: 'title: { default: "Flicki", template: "%s · Flicki" },',
    para: 'title: "Flicki",',
  },
  {
    nome: "r12-fase5e/titulo-da-casa",
    descricao: 'a casa volta a não ter <title> próprio',
    ficheiro: CASA_CASCA,
    de: 'title: "A seguir"',
    para: 'title: "Episodic"',
  },
  {
    nome: "r12-fase5e/filme-reserva-a-dock",
    descricao: "o detalhe de filme volta a reservar a dock outra vez",
    ficheiro: "src/app/movies/[key]/MoviePageClient.tsx",
    de: "<main className=\"mx-auto w-full max-w-2xl pb-6\">",
    para: "<main className=\"mx-auto w-full max-w-2xl pb-[calc(var(--dock-h)+2rem)]\">",
  },
  {
    nome: "r12-fase5e/rever-reserva-a-dock",
    descricao: "o Rever volta a reservar a dock outra vez",
    ficheiro: REVER_PAGINA,
    de: "flex-1 flex-col px-4 pt-4 pb-8\">",
    para: "flex-1 flex-col px-4 pt-4 pb-[calc(var(--dock-h)+2rem)]\">",
  },
  {
    nome: "r12-fase5e/capa-partida-brilha-para-sempre",
    descricao: "uma capa que falha volta a ficar a brilhar, partida, para sempre",
    ficheiro: POSTER,
    de: "        onError={() => setFalhou(true)}\n",
    para: "",
  },
  {
    nome: "r12-fase8/titulo-do-heroi-43px",
    descricao: "o nome da série na casa volta a ter menos de 44px de alvo",
    ficheiro: "src/components/TonightHero.tsx",
    de: "className=\"flex min-h-11 items-center\">\n            <h2 className=\"line-clamp-3",
    para: "className=\"block\">\n            <h2 className=\"line-clamp-3",
  },
  {
    nome: "r12-fase7/degrau-do-mes-fraco-some",
    descricao: "um mês com poucos episódios cai no degrau 0 e some do mapa",
    ficheiro: "src/lib/graficos.ts",
    de: "  return 1;\n}",
    para: "  return 0;\n}",
  },
  {
    nome: "r12-fase7/mais-vistas-sem-ordem",
    descricao: "as séries mais vistas deixam de vir por ordem de episódios",
    ficheiro: "src/lib/graficos.ts",
    de: ".sort((a, b) => b[1] - a[1] || ",
    para: ".sort((a, b) => 0 || ",
  },
  {
    nome: "r12-fase7/horas-ignoram-a-duracao",
    descricao: "o que se marcou depois do import vale a média, não a duração da série",
    ficheiro: "src/lib/graficos.ts",
    de: "return minutos ? minutos * 60 : media;",
    para: "return media;",
  },
  {
    nome: "r12-fase7/horas-por-ano-com-um-ano",
    descricao: "as horas por ano aparecem mesmo com um só ano (um gráfico de uma coluna)",
    ficheiro: ESTATISTICAS,
    de: "stats.horasAno.length > 1",
    para: "stats.horasAno.length > 0",
  },
  {
    nome: "r12-fase7/plural-de-um",
    descricao: "\"1 episódio\" volta a ser \"1 episódios\"",
    ficheiro: "src/lib/graficos.ts",
    de: "return n === 1 ? singular : pluralForma;",
    para: "return pluralForma;",
  },
  {
    nome: "r12-fecho/degrau-volta-a-linear",
    descricao: "a escala do mapa volta a ser fração do máximo: meses parecidos ficam todos no degrau de cima",
    ficheiro: "src/lib/graficos.ts",
    de: "  if (valor > q3) return 4;",
    para: "  if (valor > maximo * 0.25) return 4;",
  },
  {
    nome: "r12-fecho/celulas-com-intervalo",
    descricao: "as células do mapa voltam a ter 3px de intervalo morto (21px de alvo)",
    ficheiro: "src/components/MapaDeCalor.tsx",
    de: 'className="flex aspect-square min-w-0 flex-1 cursor-pointer p-[1.5px]"',
    para: 'className="mx-[1.5px] flex aspect-square min-w-0 flex-1 cursor-pointer p-[1.5px]"',
  },
  {
    nome: "r12-fecho/horas-destaque-no-ultimo",
    descricao: "o destaque das horas por ano volta a ser o último ano, não o maior",
    ficheiro: "src/app/estatisticas/EstatisticasPageClient.tsx",
    de: "destaque=\"maior\"",
    para: "destaque=\"ultima\"",
  },
  {
    nome: "r12-f2/dock-sai-do-ecra-a-150",
    descricao: "a barra volta a medir-se em rem e sai do ecrã com o texto a 150%",
    ficheiro: "src/components/BottomNav.tsx",
    de: "grid h-[var(--barra-h)] max-w-md grid-cols-4",
    para: "grid h-[var(--barra-h)] min-w-[26rem] grid-cols-4",
  },
  {
    nome: "r12-f2/titulo-do-filme-alarga",
    descricao: "o título do filme deixa de quebrar e alarga o ecrã a 150%",
    ficheiro: "src/app/movies/[key]/MoviePageClient.tsx",
    de: "font-bold break-words text-label\">{movie.name}",
    para: "font-bold text-label\">{movie.name}",
  },
  {
    nome: "r12-f2/data-iso-no-episodio",
    descricao: "a data de cada episódio volta a sair em ISO",
    ficheiro: "src/app/series/[uuid]/LinhaEpisodio.tsx",
    de: "{porExtenso(metaEp.airDate)}</span>",
    para: "{metaEp.airDate}</span>",
  },
  {
    nome: "r12-f2/data-iso-na-estreia",
    descricao: "a Estreia no Sobre volta a sair em ISO",
    ficheiro: "src/app/series/[uuid]/PainelSobre.tsx",
    de: "{porExtenso(show.firstAired)}",
    para: "{show.firstAired}",
  },
  {
    nome: "r12-f2/importar-sem-recuar",
    descricao: "o Importar perde o círculo de recuar",
    ficheiro: "src/app/import/ImportPageClient.tsx",
    de: "<CabecalhoEcra titulo=\"Importar do TV Time\" voltar=\"Voltar ao perfil\" fallback=\"/profile\" />",
    para: "<h1 className=\"font-display text-2xl font-bold\">Importar do TV Time</h1>",
  },
  {
    nome: "r12-f2/importar-arrasta",
    descricao: "o Importar volta a dizer \"Arrasta o ZIP\" num iPhone",
    ficheiro: "src/app/import/ImportPageClient.tsx",
    de: "Toca para escolher o ZIP",
    para: "Arrasta o ZIP para aqui, ou toca para escolher",
  },
  {
    nome: "r12-f2/eyebrow-apagada",
    descricao: "o texto pequeno volta para cima da arte (perdia-se nas capas claras)",
    ficheiro: "src/components/TonightHero.tsx",
    de: "        className=\"relative block h-44 overflow-hidden bg-elevated @max-[16rem]:hidden [@media(max-height:700px)]:h-28\"\n      >",
    para: "        className=\"relative block h-44 overflow-hidden bg-elevated @max-[16rem]:hidden [@media(max-height:700px)]:h-28\"\n      >\n        <span className=\"absolute bottom-3 left-4 z-10 text-xs text-label-2\">Esta noite</span>",
  },
  {
    nome: "r12-f2/foco-sem-summary",
    descricao: "o summary (Ver em tabela) perde o contorno de foco",
    ficheiro: "src/app/globals.css",
    de: "summary:focus-visible,\n",
    para: "",
  },
  {
    nome: "r12-f2/capa-lcp-em-lazy",
    descricao: "a capa que devia carregar já volta a carregar em lazy",
    ficheiro: "src/components/Poster.tsx",
    de: "loading={priority ? \"eager\" : \"lazy\"}",
    para: "loading=\"lazy\"",
  },
  {
    nome: "r12-f2/lista-sem-prioridade",
    descricao: "a primeira fila da lista deixa de pedir prioridade",
    ficheiro: "src/app/listas/[id]/ListaPageClient.tsx",
    de: "indice={i}\n",
    para: "indice={undefined}\n",
  },
  {
    nome: "r12-f3/login-sem-h1",
    descricao: "o Entrar sem cloud volta a não ter <h1>",
    ficheiro: "src/app/login/LoginPageClient.tsx",
    de: "<h1 className=\"text-[1.18rem] font-semibold text-label\">Cloud não configurada</h1>",
    para: "<p className=\"text-[1.18rem] font-semibold text-label\">Cloud não configurada</p>",
  },
  {
    nome: "r12-f3/biblioteca-vazia-sem-acao",
    descricao: "a Biblioteca vazia volta a não ter botão de procurar",
    ficheiro: "src/components/LibraryEmptyState.tsx",
    de: "{!filtrado && !query && (",
    para: "{false && (",
  },
  {
    nome: "r12-f3/filtro-vazio-sem-apagar",
    descricao: "o filtro vazio do Pôr em dia deixa de aparecer apagado",
    ficheiro: "src/app/em-dia/EmDiaPageClient.tsx",
    de: "count === 0 && !isActive ? \"opacity-60\" : \"\"",
    para: "\"\"",
  },
  {
    nome: "r12-f3/texto-11px",
    descricao: "a dica do Explorar volta aos 11px fora do código",
    ficheiro: "src/app/explorar/ExplorarPageClient.tsx",
    de: "<span className=\"text-[0.76rem] text-label-2\">arrasta",
    para: "<span className=\"text-[0.6875rem] text-label-2\">arrasta",
  },
  {
    nome: "r12-f3/preto-solto-na-lista",
    descricao: "o ✕ da lista volta a ter texto branco solto (`text-white`) em vez do token",
    ficheiro: "src/components/mira/Cartaz.tsx",
    de: "rounded-full text-label transition-transform group-active/marcar:scale-90",
    para: "rounded-full text-white transition-transform group-active/marcar:scale-90",
  },
  {
    nome: "r12-f4/disco-volta-ao-pora-em-dia",
    descricao: "o Pôr em dia da casa volta a levar o disco colorido",
    ficheiro: "src/app/series/SeriesPageClient.tsx",
    de: "        Pôr em dia\n        <span className=\"ep-code font-medium text-label-2\">{queue.length}</span>",
    para: "        <span className=\"bars h-4 w-4 shrink-0 rounded-full\" aria-hidden />\n        Pôr em dia\n        <span className=\"ep-code font-medium text-label-2\">{queue.length}</span>",
  },
  {
    nome: "r12-f4/titulo-pt-no-explorar",
    descricao: "o Explorar volta a mostrar o título pt-PT da TMDB",
    ficheiro: "src/lib/tmdb.ts",
    de: "    name: nome,\n    originalName: outro,",
    para: "    name: (kind === \"tv\" ? row.name : row.title) ?? \"\",\n    originalName: original || null,",
  },
  {
    nome: "r12-f4/original-nao-latino",
    descricao: "um original em japonês volta a substituir o título pt",
    ficheiro: "src/lib/titulos.ts",
    de: "if (original && LATINO.test(original)) {",
    para: "if (original) {",
  },
  // Retirada na Ronda 14 (Mira, Fase 1): «r12-f5/dock-sem-teto-de-espaco» — a barra da Mira não tem espaço lateral em rem (é uma grelha de 4 colunas em px); o bug que ela repunha já não tem onde existir — a variante útil é a `r12-f2/dock-sai-do-ecra-a-150`, reapontada
  {
    nome: "r14-f1/dynamic-type-sem-guarda",
    descricao: "o -apple-system-body aplica-se fora do iOS e encolhe a app para os 13px do macOS",
    ficheiro: "src/app/globals.css",
    de: "@supports (-webkit-touch-callout: none) {\n  html {\n    font: -apple-system-body;\n  }\n}",
    para: "html {\n  font: -apple-system-body;\n}",
  },
  {
    nome: "r14-f1/espaco-em-rem",
    descricao: "o espaço volta a crescer e encolher com o texto: o alvo de 44px do Ruben passa a 41",
    ficheiro: "src/app/globals.css",
    de: "@theme {\n  --spacing: 4px;\n}",
    para: "@theme {\n  --spacing: 0.25rem;\n}",
  },
  {
    nome: "r14-f1/aparencia-nao-sobrevive",
    descricao: "o script do <head> deixa de pôr o tema escolhido antes da app",
    ficheiro: "src/lib/aparencia.ts",
    de: "if(a!==\"auto\")document.documentElement.setAttribute(\"data-theme\",a);",
    para: "",
  },
  {
    nome: "r14-f1/meta-do-next",
    descricao: "mudar a aparência deixa de pintar a barra de estado até se recarregar a app",
    ficheiro: "src/lib/aparencia.ts",
    de: "  pintarBarraDeEstado(a);\n}",
    para: "}",
  },
  {
    nome: "r14-f1/barra-sem-nomes",
    descricao: "a barra volta a esconder os nomes dos separadores",
    ficheiro: "src/components/BottomNav.tsx",
    de: "leading-none @[3.4rem]:block",
    para: "leading-none",
  },
  {
    nome: "r14-f1/barra-nomes-sempre",
    descricao: "os nomes da barra ficam mesmo quando já não cabem (320px, texto a 150%)",
    ficheiro: "src/components/BottomNav.tsx",
    de: "className={`hidden whitespace-nowrap text-[max(10px,0.59rem)]",
    para: "className={`block whitespace-nowrap text-[max(10px,0.59rem)]",
  },
  {
    nome: "r14-f1/segmento-branco",
    descricao: "o segmento escolhido passa a ser a cápsula branca da ação",
    ficheiro: "src/components/mira/Segmentado.tsx",
    de: "? \"bg-segment text-label shadow-[var(--m-seg-sombra)]\"",
    para: "? \"bg-label text-on-label\"",
  },
  {
    nome: "r14-f1/menu-nao-fecha",
    descricao: "o menu do filtro deixa de fechar com Esc",
    ficheiro: "src/components/mira/MenuFiltro.tsx",
    de: "if (e.key === \"Escape\") setAberto(false);",
    para: "",
  },
  {
    nome: "r14-f1/claro-nao-segue-o-sistema",
    descricao: "o modo claro do sistema deixa de mudar a app",
    ficheiro: "src/app/globals.css",
    de: "@media (prefers-color-scheme: light) {\n  :root:not([data-theme=\"noite\"]) {",
    para: "@media (prefers-color-scheme: no-preference) {\n  :root:not([data-theme=\"noite\"]) {",
  },
  {
    nome: "r14-f2/progresso-da-serie",
    descricao: "o progresso da casa volta a ser da série inteira, não da temporada",
    ficheiro: "src/components/TonightHero.tsx",
    de: "  const { valor: temporada, fresca } = useTemporada(show, episode);",
    para: "  const { valor: temporada, fresca } = { valor: null as Temporada | null, fresca: false };",
  },
  {
    nome: "r14-f2/segmentos-sem-limite",
    descricao: "uma temporada de 25 episódios passa a 25 riscos finos",
    ficheiro: "src/components/mira/Segmentos.tsx",
    de: "const continua = fino || total > MAX_SEGMENTOS;",
    para: "const continua = fino;",
  },
  {
    nome: "r14-f2/temporada-pelo-numero",
    descricao: "a temporada passa a ser lida pelo número do fornecedor, não pela posição",
    ficheiro: "src/components/TonightHero.tsx",
    de: "const alvo = temporadas?.[episode.season - 1];",
    para: "const alvo = temporadas?.find((s) => s.number === episode.season + 1);",
  },
  {
    nome: "r14-f2/arte-fica-com-texto-grande",
    descricao: "com texto grande a arte fica no cartão e empurra a ação",
    ficheiro: "src/components/TonightHero.tsx",
    de: "bg-elevated @max-[16rem]:hidden",
    para: "bg-elevated",
  },
  {
    nome: "r14-f2/anular-branco",
    descricao: "o «Anular» volta a ser a cápsula branca da ação",
    ficheiro: "src/components/UndoToast.tsx",
    de: "rounded-full bg-fill-strong px-4 text-[0.88rem] font-semibold text-label",
    para: "rounded-full bg-acao px-4 text-[0.88rem] font-semibold text-on-label",
  },
  {
    nome: "r14-f2/degrade-desbota-portas",
    descricao: "o degradê da barra volta a 110px fixos e desbota o que já está fora da reserva",
    ficheiro: "src/components/BottomNav.tsx",
    de: "h-[calc(var(--dock-h)+8px)]",
    para: "h-[110px]",
  },
  {
    nome: "r14-f2/mira-alta-em-ecra-baixo",
    descricao: "a mira da casa vazia fica com 132px num ecrã baixo e empurra as portas para o degradê",
    ficheiro: "src/app/series/SeriesPageClient.tsx",
    de: "shadow-[inset_0_0_0_0.5px_var(--m-separator)] [@media(max-height:700px)]:h-24",
    para: "shadow-[inset_0_0_0_0.5px_var(--m-separator)]",
  },
  {
    nome: "r14-f2/dicas-perdidas",
    descricao: "a casa vazia deixa de dizer onde está o Seguir",
    ficheiro: "src/app/series/SeriesPageClient.tsx",
    de: "O Seguir está na pesquisa. Já vais a meio de uma série?",
    para: "Já vais a meio de uma série?",
  },
  {
    nome: "r14-f2/titulo-espremido",
    descricao: "com texto grande o título «A seguir» parte em duas linhas ao lado do «Pôr em dia»",
    ficheiro: "src/components/mira/TituloGrande.tsx",
    de: "<div className=\"flex flex-wrap items-end justify-between gap-x-3 gap-y-2\">",
    para: "<div className=\"flex items-end justify-between gap-x-3 gap-y-2\">",
  },
  // ── Ronda 14, Fase 3: a assinatura ─────────────────────────
  {
    nome: "r14-f3/ritual-sem-o-marcado",
    descricao: "no toque, a mira varre só os já vistos e pára antes do episódio marcado",
    ficheiro: HEROI,
    de: "(noToque || !fresca)",
    para: "!fresca",
  },
  {
    nome: "r14-f3/ritual-espera-pela-gravacao",
    descricao: "o ritual volta a esperar que a gravação acabe, em vez de começar no toque",
    ficheiro: HEROI,
    de: "    try {\n      await onCheck(alvo.temporada, alvo.episodio);\n    } catch {",
    para: "    setMarcacoes((n) => n - 1);\n    try {\n      await onCheck(alvo.temporada, alvo.episodio);\n      setMarcacoes((n) => n + 1);\n    } catch {",
  },
  {
    nome: "r14-f3/por-ver-acendem",
    descricao: "a mira pinta a fila inteira, os por ver incluídos",
    ficheiro: "src/components/mira/Segmentos.tsx",
    de: "{ritual > 0 && visto && n <= ate && largura > 0 && (",
    para: "{ritual > 0 && n <= total && largura > 0 && (",
  },
  {
    nome: "r14-f3/fatia-com-a-mira-inteira",
    descricao: "cada segmento mostra a mira inteira em vez da sua fatia",
    ficheiro: "src/components/mira/Segmentos.tsx",
    de: "                  backgroundSize: `${largura}px 100%`,\n                  backgroundPosition: `${-i * (w + INTERVALO)}px 0`,",
    para: "                  backgroundSize: \"100% 100%\",",
  },
  {
    nome: "r14-f3/anular-reacende",
    descricao: "anular deixa as fatias montadas e, com a leitura nova, a mira reacende no segmento anterior",
    ficheiro: HEROI,
    de: "ritual={otimista || fim ? marcacoes : 0}",
    para: "ritual={marcacoes}",
  },
  {
    nome: "r14-f3/fim-sem-momento",
    descricao: "fechar uma temporada passa de largo: sem «T1 ✓», salta logo para a seguinte",
    ficheiro: HEROI,
    de: "      setFim({ ...temporada, vistos: vistosDepois });",
    para: "",
  },
  {
    nome: "r14-f3/fim-nao-da-lugar",
    descricao: "a temporada acabada fica à vista para sempre, e a seguinte nunca aparece",
    ficheiro: HEROI,
    de: "      setFim(null);\n      setConstruir(true);",
    para: "      setConstruir(true);",
  },
  {
    nome: "r14-f3/erro-calado",
    descricao: "se não der para gravar, a app cala-se",
    ficheiro: HEROI,
    de: "      setErro(\"Não deu para marcar. Tenta outra vez.\");",
    para: "",
  },
  {
    nome: "r14-f3/erro-fica-aceso",
    descricao: "se não der para gravar, o episódio fica aceso como se tivesse ficado visto",
    ficheiro: HEROI,
    de: "      setOtimista(null);\n      setFim(null);\n      setErro(",
    para: "      setFim(null);\n      setErro(",
  },
  {
    nome: "r14-f3/diario-nao-soma",
    descricao: "marcar deixa de somar ao diário do cabeçalho",
    ficheiro: CASA,
    de: "      setVistosHoje((n) => n + 1);\n",
    para: "",
  },
  {
    nome: "r14-f3/diario-nao-tira",
    descricao: "anular deixa o episódio contado no diário",
    ficheiro: CASA,
    de: "          setVistosHoje((n) => Math.max(0, n - 1));\n",
    para: "",
  },
  {
    nome: "r14-f3/contexto-so-no-retomar",
    descricao: "a linha de contexto volta a existir só em «Retomar», e o botão salta ao marcar",
    ficheiro: CASA,
    de: "contexto={contextoDe(heroShow, heroKind)}",
    para: "contexto={heroKind === \"retomar\" ? contextoDe(heroShow, heroKind) : \"\"}",
  },
  {
    nome: "r14-f3/nome-em-mono",
    descricao: "no aviso de anular, o nome da série volta a mono (máquina de escrever)",
    ficheiro: AVISO,
    de: "<p className=\"mt-0.5 truncate text-[0.88rem] text-label-2\">{comCodigos(mostrado.detail)}</p>",
    para: "<p className=\"ep-code mt-0.5 truncate text-[0.88rem] text-label-2\">{comCodigos(mostrado.detail)}</p>",
  },
  {
    nome: "r14-f3/claro-a-60",
    descricao: "o texto secundário do claro escolhido (`data-theme`) volta aos 60% do iOS (3,1:1, abaixo de AA)",
    ficheiro: "src/app/globals.css",
    de: "\n  --m-label-2: rgba(60, 60, 67, 0.8);",
    para: "\n  --m-label-2: rgba(60, 60, 67, 0.6);",
  },
  {
    nome: "r14-f3/claro-a-60-automatico",
    descricao: "o texto secundário do claro que vem do sistema (`prefers-color-scheme`, «Automático») volta aos 60% do iOS",
    ficheiro: "src/app/globals.css",
    de: "\n    --m-label-2: rgba(60, 60, 67, 0.8);",
    para: "\n    --m-label-2: rgba(60, 60, 67, 0.6);",
  },
  {
    nome: "r14-f3/barra-abaixo-de-10px",
    descricao: "com o texto do Ruben (15px), os nomes da barra descem aos 8,85px",
    ficheiro: BOTTOM_NAV,
    de: "text-[max(10px,0.59rem)] leading-none @[3.4rem]:block",
    para: "text-[0.59rem] leading-none @[3.4rem]:block",
  },
  {
    nome: "r14-f3/acao-branca",
    descricao: "a cápsula de ação volta ao branco puro à noite",
    ficheiro: CSS,
    de: "  --m-acao: #e5e5ea;",
    para: "  --m-acao: #ffffff;",
  },
  {
    nome: "r14-f3/carta-sem-fila-de-acerto",
    descricao: "a carta de teste da casa vazia perde a fila de acerto e volta a sete riscas",
    ficheiro: CASA,
    de: "{[\"--mira-7\", \"--mira-preto\", \"--mira-5\", \"--mira-preto\", \"--mira-3\", \"--mira-preto\", \"--mira-1\"].map(",
    para: "{([] as string[]).map(",
  },
  {
    nome: "r14-f3/dica-volta-a-flutuar",
    descricao: "a dica de instalar volta a flutuar por cima das portas da casa vazia",
    ficheiro: "src/components/mira/DicaInstalar.tsx",
    de: "<div className=\"mt-6 flex items-center gap-3 rounded-[26px]",
    para: "<div className=\"fixed inset-x-4 bottom-24 z-40 flex items-center gap-3 rounded-[26px]",
  },
  // ── Ronda 14, Fase 10: âncoras novas, para o que a Mira redesenhou ──
  {
    nome: "r14-f10/titulo-grande-sem-h1",
    descricao: "nenhum ecrã com título grande tem <h1> (o título passa a decorar-se, sem semântica)",
    ficheiro: "src/components/mira/TituloGrande.tsx",
    de: "<h1\n            ref={ancora}",
    para: "<h1\n            aria-hidden\n            ref={ancora}",
  },
  {
    nome: "r14-f10/titulo-grande-so-para-leitores",
    descricao: "o título grande deixa de se ver (só os leitores de ecrã o encontram)",
    ficheiro: "src/components/mira/TituloGrande.tsx",
    de: "className=\"min-w-0 max-w-full text-[2rem]",
    para: "className=\"sr-only min-w-0 max-w-full text-[2rem]",
  },
  {
    nome: "r14-f10/seccao-com-cor",
    descricao: "o cabeçalho de uma secção da Biblioteca volta a ter cor de estado",
    ficheiro: "src/components/StickySectionHeader.tsx",
    de: "truncate text-base font-semibold text-label\">{label}",
    para: "truncate text-base font-semibold text-em-dia\">{label}",
  },
  {
    nome: "r14-f10/seccao-nao-cola",
    descricao: "o cabeçalho da secção deixa de colar por baixo da barra compacta",
    ficheiro: "src/components/StickySectionHeader.tsx",
    de: "<div className=\"sticky top-[var(--topo-barra)] z-10",
    para: "<div className=\"relative top-[var(--topo-barra)] z-10",
  },
  {
    nome: "r14-f10/segmentado-alarga",
    descricao: "cada segmento passa a ter a largura do texto e, a 150% em 320px, alarga a página",
    ficheiro: "src/components/mira/Segmentado.tsx",
    de: "flex min-w-0 flex-1 cursor-pointer items-center before:",
    para: "flex shrink-0 whitespace-nowrap cursor-pointer items-center before:",
  },
];

// ── O guião ───────────────────────────────────────────────────────────────

/** o que o guião mede antes de correr: a estimativa parte destes números */
const SEGUNDOS_BUILD = 10;
const SEGUNDOS_SUITE = 65;
const SEGUNDOS_CONJUNTO = 15;

const MAPA = "tests/mutacoes-mapa.json";
const REGISTO = ".mutacoes-registo.jsonl"; // fora de `test-results/`: o Playwright apaga-o ao arrancar

const args = process.argv.slice(2);
const bandeiras = new Set(args.filter((a) => a.startsWith("--")));
const filtros = args.filter((a) => !a.startsWith("--"));
const alvo = filtros.length
  ? MUTACOES.filter((m) => filtros.some((f) => m.nome.includes(f)))
  : MUTACOES;
if (alvo.length === 0) {
  console.error(`Nenhuma mutação com ${filtros.map((f) => `"${f}"`).join(" ou ")}.`);
  process.exit(1);
}

// Todos os trechos, antes de correr seja o que for — incluindo os que o
// filtro deixa de fora. Oito mutações ficaram sem trecho entre a Fase 5 e a
// 5c da Ronda 12 (o código mudou por baixo delas) e ninguém deu por isso:
// as corridas eram filtradas pela fase, e só a corrida completa as via. Um
// ficheiro que já não existe conta como trecho partido (na Fase 10 havia 57).
const partidas = MUTACOES.filter((m) => {
  if (!existsSync(m.ficheiro)) return true;
  return readFileSync(m.ficheiro, "utf8").split(m.de).length - 1 !== 1;
});
if (partidas.length > 0) {
  console.error("Mutações cujo trecho já não existe (ou existe mais de uma vez):");
  for (const m of partidas) console.error(`  · ${m.nome} (${m.ficheiro})`);
  console.error("Uma mutação assim não repõe o bug que diz repor — corrige-a.");
  process.exit(1);
}
if (bandeiras.has("--verificar")) {
  console.log(`${MUTACOES.length} mutações, todos os trechos existem (${Object.keys(RETIRADAS).length} retiradas).`);
  process.exit(0);
}

// Só numa cópia à parte: na pasta que serve a pré-visualização, a build de
// cada mutação apagava-lhe o `.next` e o `next dev` recarregava o código partido.
const comum = execSync("git rev-parse --path-format=absolute --git-common-dir", { encoding: "utf8" }).trim();
const propria = execSync("git rev-parse --path-format=absolute --git-dir", { encoding: "utf8" }).trim();
if (comum === propria && !bandeiras.has("--aqui")) {
  console.error("Isto é a pasta principal, não uma cópia (`git worktree`).");
  console.error("Cria uma (instruções no topo deste ficheiro) ou repete com --aqui, se tiveres a certeza");
  console.error("de que nenhum `next dev` serve esta pasta.");
  process.exit(1);
}

if (execSync("git status --porcelain", { encoding: "utf8" }).trim()) {
  console.error("Há alterações por commitar — o guião mexe nos ficheiros e repõe-nos no fim.");
  process.exit(1);
}

// Porta própria: com `reuseExistingServer`, um servidor esquecido noutra cópia
// seria reaproveitado e as mutações testadas contra o código dele.
const PORTA = process.env.PORTA_TESTES ?? "3230";
try {
  execSync(`lsof -nP -iTCP:${PORTA} -sTCP:LISTEN`, { stdio: "pipe" });
  console.error(`A porta ${PORTA} já está ocupada — outra corrida, ou um servidor esquecido. Muda PORTA_TESTES.`);
  process.exit(1);
} catch {
  // sem saída = livre
}
process.env.PORTA_TESTES = PORTA;

const mapa = existsSync(MAPA) && !bandeiras.has("--tudo") ? JSON.parse(readFileSync(MAPA, "utf8")) : {};
const mapaTodo = existsSync(MAPA) ? JSON.parse(readFileSync(MAPA, "utf8")) : {};

const comMapa = alvo.filter((m) => mapa[m.nome]?.length).length;
const estimativa =
  (comMapa * (SEGUNDOS_BUILD + SEGUNDOS_CONJUNTO) + (alvo.length - comMapa) * (SEGUNDOS_BUILD + SEGUNDOS_SUITE / 2)) / 60;
console.log(
  `${alvo.length} mutações (${comMapa} com mapa, ${alvo.length - comMapa} sem): estimativa ~${Math.round(estimativa)} min,` +
    ` mais ~${Math.round((SEGUNDOS_BUILD + SEGUNDOS_SUITE) / 60 * 10) / 10} min por cada uma que sobreviva.\n`,
);

const RELATORIO = join(tmpdir(), `mutacoes-${process.pid}.json`);

/**
 * Os testes que falharam **a sério**, lidos do relatório JSON. Com
 * `--max-failures=1` o Playwright interrompe os que estavam a meio noutros
 * trabalhadores, e a linha «N) …» do relatório de texto lista-os ao lado do
 * que falhou: a primeira corrida da Fase 10 «apanhou» mutações do ritual com
 * testes do baralho. Só conta `unexpected` cujo último resultado falhou ou
 * ultrapassou o tempo — nunca `interrupted`.
 */
function falhasDoRelatorio() {
  const falhas = [];
  const percorrer = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const ultimo = t.results?.[t.results.length - 1]?.status;
        if (t.status === "unexpected" && (ultimo === "failed" || ultimo === "timedOut")) {
          falhas.push(`${spec.file.replace("tests/", "")} › ${spec.title}`);
        }
      }
    }
    for (const filha of suite.suites ?? []) percorrer(filha);
  };
  const relatorio = JSON.parse(readFileSync(RELATORIO, "utf8"));
  for (const suite of relatorio.suites ?? []) percorrer(suite);
  return { falhas: [...new Set(falhas)], correu: (relatorio.stats?.expected ?? 0) + (relatorio.stats?.unexpected ?? 0) };
}

function correrSuite(ficheiros) {
  rmSync(RELATORIO, { force: true });
  let saida = "";
  let saiuBem = true;
  try {
    execFileSync(
      "npx",
      [
        "playwright",
        "test",
        ...ficheiros.map((f) => `tests/${f}`),
        "--reporter=json",
        // uma falha isolada (relógio, carga da máquina) não conta: uma mutação
        // a sério falha à segunda também
        "--retries=1",
        // basta um alarme para a mutação estar apanhada
        "--max-failures=1",
      ],
      {
        encoding: "utf8",
        stdio: "pipe",
        timeout: 15 * 60_000,
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: RELATORIO },
        maxBuffer: 64 * 1024 * 1024,
      },
    );
  } catch (erro) {
    saiuBem = false;
    saida = `${erro.stdout ?? ""}${erro.stderr ?? ""}`.slice(-4000);
  }
  // Uma mutação que não compila não repôs bug nenhum — só partiu o build.
  // Contá-la como "apanhada" foi exatamente o erro da primeira corrida da
  // Ronda 12: dois ✓ sem um único teste a falhar.
  if (!existsSync(RELATORIO) || /Failed to type check|webServer was not able to start|Failed to compile|Build error/.test(saida)) {
    return { verde: false, falhas: [], invalida: true };
  }
  const { falhas, correu } = falhasDoRelatorio();
  if (saiuBem && falhas.length === 0) return { verde: correu > 0, falhas: [], invalida: correu === 0 };
  return { verde: false, falhas, invalida: falhas.length === 0 };
}

const ficheirosDe = (falhas) => [...new Set(falhas.map((f) => f.split(" › ")[0]))];

/** o conjunto que a mutação ameaça; se sobreviver a ele, a suite inteira decide */
function testar(m) {
  const conjunto = mapa[m.nome];
  if (conjunto?.length) {
    const r = correrSuite(conjunto);
    if (r.invalida || !r.verde) return { ...r, via: "mapa", conjunto: ficheirosDe(r.falhas) };
  }
  const r = correrSuite([]);
  const via = conjunto?.length ? (r.verde || r.invalida ? "suite" : "mapa-desatualizado") : "suite";
  return { ...r, via, conjunto: ficheirosDe(r.falhas) };
}

function escreverMapa() {
  writeFileSync(MAPA, JSON.stringify(Object.fromEntries(Object.entries(mapaTodo).sort()), null, 2) + "\n");
}

function repor() {
  execSync("git checkout -- src", { stdio: "pipe" });
}
for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => {
    repor();
    process.exit(130);
  });
}

const resultados = [];
const inicio = Date.now();
for (const [n, m] of alvo.entries()) {
  const original = readFileSync(m.ficheiro, "utf8");
  writeFileSync(m.ficheiro, original.replace(m.de, m.para));
  process.stdout.write(`[${n + 1}/${alvo.length}] ${m.nome} … `);
  const t0 = Date.now();
  let r;
  try {
    r = testar(m);
  } finally {
    writeFileSync(m.ficheiro, original);
  }
  const segundos = Math.round((Date.now() - t0) / 1000);
  const { verde, falhas, invalida, via, conjunto } = r;
  if (!verde && !invalida && conjunto.length) {
    mapaTodo[m.nome] = conjunto;
    // a cada mutação, não só no fim: uma corrida de horas que morra a meio
    // não perde o que já aprendeu
    if (!bandeiras.has("--tudo")) escreverMapa();
  }
  resultados.push({ ...m, sobreviveu: verde, falhas, invalida, via });
  appendFileSync(
    REGISTO,
    JSON.stringify({ nome: m.nome, sobreviveu: verde, invalida, via, segundos, falhas: falhas.slice(0, 3) }) + "\n",
  );
  console.log(
    `${invalida
      ? "INVÁLIDA (não compilou, ou falhou sem teste nenhum — não prova nada)"
      : verde
        ? "SOBREVIVEU (ninguém deu o alarme)"
        : via === "mapa-desatualizado"
          ? `apanhada — mas fora do conjunto do mapa: ${conjunto.join(", ")}`
          : `apanhada por ${falhas.length}`} · ${segundos}s`,
  );
}

console.log("\n─── Rede de segurança ───\n");
for (const r of resultados) {
  console.log(`${r.sobreviveu ? "✖" : r.invalida ? "?" : "✓"} ${r.nome} — ${r.descricao}`);
  for (const f of r.falhas.slice(0, 3)) console.log(`    ${f}`);
  if (r.falhas.length > 3) console.log(`    …e mais ${r.falhas.length - 3}`);
}

const sobreviventes = resultados.filter((r) => r.sobreviveu);
const invalidas = resultados.filter((r) => r.invalida);
const apanhadas = resultados.length - sobreviventes.length - invalidas.length;
console.log(`\n${apanhadas}/${resultados.length} bugs apanhados em ${Math.round((Date.now() - inicio) / 60_000)} min.`);
if (sobreviventes.length > 0) {
  console.log("Buracos na rede:");
  for (const s of sobreviventes) console.log(`  · ${s.nome} — ${s.descricao}`);
}
if (invalidas.length > 0) {
  console.log("Mutações inválidas (corrige a mutação, não o código):");
  for (const s of invalidas) console.log(`  · ${s.nome} — ${s.descricao}`);
}
if (sobreviventes.length > 0 || invalidas.length > 0) process.exit(1);
