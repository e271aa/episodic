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
 * Correr:  node tests/mutacoes.mjs          (todas)
 *          node tests/mutacoes.mjs buracos  (só as que batem com o nome)
 */

import { execFileSync, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const DETALHE = "src/app/series/[uuid]/page.tsx";
const BIBLIOTECA = "src/app/library/page.tsx";
const RUNS = "src/lib/episodeRuns.ts";
const BURACOS = "src/lib/buracos.ts";
const EXISTENTE = "src/lib/existente.ts";
const REPAIR = "src/lib/repair.ts";
const METADATA = "src/lib/metadata.ts";
const DB = "src/lib/db.ts";
const STATS = "src/lib/advancedStats.ts";
const REVER = "src/lib/rever.ts";
const REVER_PAGINA = "src/app/rever/page.tsx";
const LINHAS = "src/lib/linhas.ts";
const NUMERACAO = "src/lib/numeracao.ts";
const HEROI = "src/components/TonightHero.tsx";
const EM_DIA = "src/app/em-dia/page.tsx";
const RESULTADO_SERIE = "src/components/ShowResultCard.tsx";
const CASA = "src/app/series/page.tsx";
const EXPLORAR = "src/app/explorar/page.tsx";
const LISTA = "src/app/listas/[id]/page.tsx";
const AVISO = "src/components/UndoToast.tsx";
const SECTION_HEADER = "src/components/SectionHeader.tsx";
const CSS = "src/app/globals.css";
const POSTER_CARD = "src/components/PosterCard.tsx";
const LIBRARY = "src/app/library/page.tsx";
const IMPORT_PAGINA = "src/app/import/page.tsx";
const ESTATISTICAS = "src/app/estatisticas/page.tsx";
const PROFILE_PAGINA = "src/app/profile/page.tsx";
const LIBRARY_PAGINA = "src/app/library/page.tsx";
const EXPLORAR_PAGINA = "src/app/explorar/page.tsx";
const EM_DIA_PAGINA = "src/app/em-dia/page.tsx";
const LOGIN = "src/app/login/page.tsx";
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
const ESTREAR = "src/app/estrear/page.tsx";
const FILME_PAGINA = "src/app/movies/[key]/page.tsx";
const CABECALHO = "src/components/CabecalhoEcra.tsx";
const CONTROLOS_BIBLIOTECA = "src/components/LibraryControls.tsx";
const LISTAS_ROTA = "src/app/listas/page.tsx";

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
    ficheiro: DETALHE,
    de: '<div className="sticky top-0 z-10 -mx-4 bg-tube px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">',
    para: '<div className="-mx-4 bg-tube px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">',
  },
  {
    nome: "fase2/visto-vs-por-ver",
    descricao: "visto e por ver voltam a desenhar-se iguais",
    ficheiro: DETALHE,
    de: '        isSeen ? "opacity-60" : ""',
    para: '        isSeen ? "" : ""',
  },
  {
    nome: "fase3/balde-por-comecar",
    descricao: "'Por começar' volta para dentro do 'A ver'",
    ficheiro: BIBLIOTECA,
    de: '    return s.watchedCount === 0 ? "Por começar" : "Em curso";',
    para: '    return "Em curso";',
  },
  {
    nome: "fase3/ordem-das-seccoes",
    descricao: "as completas voltam para o segundo lugar",
    ficheiro: BIBLIOTECA,
    de: 'const ESTADOS = [\n  "Em curso",\n  "Por começar",\n  "Para ver",\n  "Completas",',
    para: 'const ESTADOS = [\n  "Em curso",\n  "Completas",\n  "Por começar",\n  "Para ver",',
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
    descricao: "o herói volta aos 420px fixos",
    ficheiro: DETALHE,
    de: 'h-[min(52vh,420px)]',
    para: 'h-[420px]',
  },
  {
    nome: "fase4/uma-acao-preenchida",
    descricao: "as duas ações voltam a ser blocos brancos iguais",
    ficheiro: DETALHE,
    de: '              buracos.total > 0\n                ? "border border-line text-ink hover:border-ink/40 hover:bg-raised"\n                : "bg-ink text-tube hover:brightness-110"',
    para: '              false\n                ? "border border-line text-ink hover:border-ink/40 hover:bg-raised"\n                : "bg-ink text-tube hover:brightness-110"',
  },
  {
    nome: "fase4/progresso-no-heroi",
    descricao: "a barra do herói deixa de seguir o progresso",
    ficheiro: DETALHE,
    de: 'style={{ width: `${percent ?? 0}%`, background: accent }}',
    para: 'style={{ width: "0%", background: accent }}',
  },
  {
    nome: "fase4/pastilha-para-o-ecra",
    descricao: "abrir a última temporada deixa-a fora do ecrã",
    ficheiro: DETALHE,
    de: '    chipAberto.current?.scrollIntoView({',
    para: '    if (openSeason !== null) return;\n    chipAberto.current?.scrollIntoView({',
  },
  {
    nome: "fase4/separadores-acessiveis",
    descricao: "os separadores perdem o aria-controls",
    ficheiro: DETALHE,
    de: '              aria-controls={`painel-${id}`}',
    para: "",
  },
  {
    nome: "fase4/separadores-com-setas",
    descricao: "as setas deixam de andar entre separadores",
    ficheiro: DETALHE,
    de: "                if (!delta) return;",
    para: "                if (!delta) return;\n                if (delta) return;",
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
    ficheiro: DETALHE,
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
    ficheiro: HEROI,
    de: '            Pôr em dia\n            <span className="ep-code text-dim">{seriesPorVer}</span>',
    para: "            {seriesPorVer} em dia",
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
    de: '            {inWatchlist ? "Na lista para ver" : "Seguida"}',
    para: '            {inWatchlist ? "Na lista para ver" : "A seguir"}',
  },
  {
    nome: "r12-fase5/biblioteca-a-ver",
    descricao: "a secção das séries começadas volta a chamar-se \"A ver\", ao lado de \"Para ver\"",
    ficheiro: BIBLIOTECA,
    de: '    return s.watchedCount === 0 ? "Por começar" : "Em curso";',
    para: '    return s.watchedCount === 0 ? "Por começar" : "A ver";',
  },
  {
    nome: "r12-fase5/casa-vazia-pede-zip",
    descricao: "a casa vazia volta a ter \"importar do TV Time\" como primeira ação",
    ficheiro: CASA,
    de: '            href="/explorar?procurar=1"\n            className="flex min-h-12',
    para: '            href="/import"\n            className="flex min-h-12',
  },
  {
    nome: "r12-fase5/explorar-sem-seguir",
    descricao: "a pesquisa do Explorar volta a só saber guardar \"para ver\"",
    ficheiro: EXPLORAR,
    de: "          onSeguir={searching ? seguir : undefined}",
    para: "          onSeguir={undefined}",
  },
  {
    nome: "r12-fase5/sem-seguidas-em-dia",
    descricao: "sem nenhuma série seguida, a casa volta a dizer \"Estás em dia\"",
    ficheiro: CASA,
    de: "            {watching.length === 0 ? (\n              <>",
    para: "            {watching.length < 0 ? (\n              <>",
  },
  {
    nome: "r12-fase5/remover-invisivel",
    descricao: "o botão de remover da lista volta a só aparecer com hover",
    ficheiro: LISTA,
    de: "group-hover:opacity-100 [@media(hover:hover)]:opacity-0\"",
    para: "group-hover:opacity-100 opacity-0\"",
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
    nome: "r12-fase5b/cabecalhos-6-cores",
    descricao: "os cabeçalhos de secção voltam a sortear entre as 6 cores, incluindo estados",
    ficheiro: SECTION_HEADER,
    de: 'const BAR_COLORS = ["#c8c8c8", "#e6c832", "#e6483c", "#3c46e6"];',
    para: 'const BAR_COLORS = ["#c8c8c8", "#e6c832", "#d24bd2", "#37c837", "#3c46e6", "#e6483c"];',
  },
  {
    nome: "r12-fase5b/hover-ambar-volta",
    descricao: "o hover de um cartão volta a acender o âmbar da v1",
    ficheiro: CSS,
    de: '.ep-card-hover:hover {\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 12px 28px -10px rgba(0, 0, 0, 0.55);\n}',
    para: '.ep-card-hover:hover {\n  border-color: rgba(255, 170, 51, 0.35);\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 12px 28px -10px rgba(0, 0, 0, 0.55);\n}',
  },
  {
    nome: "r12-fase5b/brilho-volta",
    descricao: "a barra de progresso da grelha volta a ter o brilho decorativo",
    ficheiro: POSTER_CARD,
    de: "            <div className=\"absolute inset-x-0 bottom-0 h-1 bg-black/50\">\n              {/* Sem brilho: a cor já tem significado (Bars Rule), o halo à\n                  volta dela é só decoração a mais (Ronda 12, Fase 5b). */}\n              <div\n                className=\"h-full transition-[width] duration-[240ms] ease-out\"\n                style={{ width: `${progress}%`, background: barColor ?? undefined }}",
    para: "            <div className=\"absolute inset-x-0 bottom-0 h-1 bg-black/50\">\n              <div\n                className=\"h-full transition-[width] duration-[240ms] ease-out\"\n                style={{ width: `${progress}%`, background: barColor ?? undefined, boxShadow: barColor ? `0 0 6px ${barColor}b3` : undefined }}",
  },
  {
    nome: "r12-fase5b/em-curso-verde",
    descricao: "'Em curso' na Biblioteca volta a ser verde em vez do branco-projetor",
    ficheiro: LIBRARY,
    de: '"Em curso": "var(--color-ink)",',
    para: '"Em curso": "#37c837",',
  },
  {
    nome: "r12-fase5b/data-importacao-crua",
    descricao: "a data da última importação volta a aparecer em ISO cru",
    ficheiro: "src/app/profile/page.tsx",
    de: "`Última importação a ${porExtenso(stats.importedAt)}`",
    para: "`Última importação a ${stats.importedAt.slice(0, 10)}`",
  },
  {
    nome: "r12-fase5b/genero-por-traduzir",
    descricao: "os géneros do detalhe voltam a aparecer em inglês",
    ficheiro: DETALHE,
    de: ".map(translateGenre)\n    .join",
    para: ".join",
  },
  {
    nome: "r12-fase5b/maratona-1-episodios",
    descricao: "'Melhor maratona' com 1 volta a dizer 'episódios'",
    ficheiro: ESTATISTICAS,
    de: '{stats.bestBinge.count === 1 ? "episódio" : "episódios"}',
    para: '"episódios"',
  },
  {
    nome: "r12-fase5b/import-vocabulario-de-computador",
    descricao: "o import volta a dizer 'clica' em vez de 'toca'",
    ficheiro: IMPORT_PAGINA,
    de: "Arrasta o ZIP para aqui, ou toca para escolher",
    para: "Arrasta o ZIP para aqui, ou clica para escolher",
  },
  {
    nome: "r12-fase5b/scroll-fantasma-margem-cancelada",
    descricao: "a .tela-cheia volta a não cancelar o respiro da dock — os 82px voltam nos três ecrãs",
    ficheiro: CSS,
    de: "  height: 100dvh;\n  margin-bottom: calc(-1 * (var(--dock-h) + 0.5rem));\n}",
    para: "  height: 100dvh;\n}",
  },
  {
    nome: "r12-fase5b/biblioteca-sem-h1",
    descricao: "a Biblioteca volta a não ter <h1>",
    ficheiro: LIBRARY_PAGINA,
    de: '<h1 className="font-display text-2xl font-bold [font-stretch:110%]">Biblioteca</h1>',
    para: '<p className="font-display text-2xl font-bold [font-stretch:110%]">Biblioteca</p>',
  },
  {
    nome: "r12-fase5b/perfil-sem-h1",
    descricao: "o Perfil volta a não ter <h1>",
    ficheiro: PROFILE_PAGINA,
    de: '<h1 className="sr-only">Perfil</h1>',
    para: "",
  },
  {
    nome: "r12-fase5b/explorar-sem-h1",
    descricao: "o Explorar volta a não ter <h1>",
    ficheiro: EXPLORAR_PAGINA,
    de: '<h1 className="sr-only">{kind === "tv" ? "Explorar séries" : "Explorar filmes"}</h1>',
    para: "",
  },
  {
    nome: "r12-fase5b/biblioteca-lcp-lazy",
    descricao: "as primeiras capas da Biblioteca voltam a carregar em lazy",
    ficheiro: POSTER_CARD_2,
    de: "priority={index !== undefined && index < 2}",
    para: "priority={false}",
  },
  {
    nome: "r12-fase5b/explorar-lcp-lazy",
    descricao: "as primeiras capas do Explorar voltam a carregar em lazy",
    ficheiro: DISCOVER_CARD,
    de: "priority={index < 2}",
    para: "priority={false}",
  },
  {
    nome: "r12-fase5b/manifest-cor-v1",
    descricao: "o manifest volta à cor de tema da v1",
    ficheiro: MANIFEST,
    de: 'theme_color: "#101014"',
    para: 'theme_color: "#0b0e14"',
  },
  {
    nome: "r12-fase5b/apagar-lista-vermelho-sempre",
    descricao: "'Apagar lista' volta a ficar vermelho em repouso",
    ficheiro: LISTA,
    de: '            : "border-line text-dim hover:border-ink hover:text-ink"',
    para: '            : "border-danger/40 text-danger hover:bg-danger/10"',
  },
  {
    nome: "r12-fase5b/apagar-dados-vermelho-sempre",
    descricao: "'Apagar dados locais' volta a ficar vermelho em repouso",
    ficheiro: PROFILE_PAGINA,
    de: '              detalhe="Limpa esta cópia — a da cloud, se tiveres sessão, fica"\n              onClick={() => setConfirmClear(true)}\n            />',
    para: '              detalhe="Limpa esta cópia — a da cloud, se tiveres sessão, fica"\n              onClick={() => setConfirmClear(true)}\n              perigo\n            />',
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
    ficheiro: EXPLORAR_PAGINA,
    de: '                aria-label={kind === "tv" ? "Procurar uma série" : "Procurar um filme"}\n',
    para: "",
  },
  {
    nome: "r12-fase5b/add-to-list-campo-sem-rotulo",
    descricao: "o campo de nova lista no detalhe volta a não ter aria-label",
    ficheiro: ADD_TO_LIST,
    de: '              aria-label="Nome da nova lista"\n',
    para: "",
  },
  {
    nome: "r12-fase5b/dock-parte-a-seguir-320",
    descricao: "a dock volta a partir 'A seguir' em duas linhas a 320px",
    ficheiro: BOTTOM_NAV,
    de: '<span className={active ? "whitespace-nowrap" : "sr-only sm:not-sr-only"}>',
    para: '<span className={active ? "" : "sr-only sm:not-sr-only"}>',
  },
  {
    nome: "r12-fase5b2/heroi-volta-a-40px",
    descricao: "o título do herói volta a fugir da rampa (40px em vez de 36)",
    ficheiro: HEROI,
    de: "text-[2.25rem]",
    para: "text-[2.5rem]",
  },
  {
    nome: "r12-fase5b2/texto-volta-a-px",
    descricao: "o nome da série na Biblioteca volta a um valor absoluto (não responde à raiz)",
    ficheiro: POSTER_CARD,
    de: '<p className="mt-1.5 truncate text-[0.9375rem] font-semibold">',
    para: '<p className="mt-1.5 truncate text-[15px] font-semibold">',
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
    de: '        <ArrowLeftIcon className="h-5 w-5" />',
    para: "        {voltar}",
  },
  {
    nome: "r12-fase5b3/para-ver-volta-a-branco",
    descricao: "o 'Para ver' do Explorar volta a ser uma pílula branca",
    ficheiro: DISCOVER_CARD,
    // com `flex-1`: sem ele, a âncora batia primeiro no "Seguir" da pesquisa,
    // que tem a mesma classe — e a mutação mudava o botão errado
    de: "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border border-line text-xs font-semibold text-ink transition hover:border-ink active:scale-95",
    para: "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full bg-ink text-xs font-semibold text-tube transition hover:brightness-110 active:scale-95",
  },
  {
    nome: "r12-fase5b3/separador-volta-a-branco",
    descricao: "o separador ativo da Biblioteca volta a ser branco, por cima da dock",
    ficheiro: CONTROLOS_BIBLIOTECA,
    de: 'segment === id ? "bg-ink/[0.14] text-ink" : "text-dim hover:text-ink"',
    para: 'segment === id ? "bg-ink text-tube" : "text-dim hover:text-ink"',
  },
  {
    nome: "r12-fase5b3/escolha-volta-a-branco",
    descricao: "uma escolha no Pôr em dia volta a ser uma pílula branca",
    ficheiro: EM_DIA_PAGINA,
    de: '? "border-ink/60 bg-raised text-ink"',
    para: '? "border-ink bg-ink text-tube"',
  },
  {
    nome: "r12-fase5b3/biblioteca-volta-a-2-colunas",
    descricao: "a Biblioteca volta a abrir em 2 colunas de cartazes grandes",
    ficheiro: LIBRARY_PAGINA,
    de: '    "biblioteca-densidade",\n    "compacta",',
    para: '    "biblioteca-densidade",\n    "grande",',
  },
  {
    nome: "r12-fase5b3/biblioteca-sem-titulo",
    descricao: "o título da Biblioteca volta a ser só para leitores de ecrã",
    ficheiro: LIBRARY_PAGINA,
    de: '<h1 className="font-display text-2xl font-bold [font-stretch:110%]">Biblioteca</h1>',
    para: '<h1 className="sr-only">Biblioteca</h1>',
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
    nome: "r12-fase5b3/contagens-a-320",
    descricao: "as contagens voltam a aparecer a 320px e empurram a barra",
    ficheiro: CONTROLOS_BIBLIOTECA,
    de: "ep-code hidden text-xs min-[360px]:inline",
    para: "ep-code text-xs",
  },
  {
    nome: "r12-fase5b3/casa-sem-ou-entao",
    descricao: "a casa volta a dar uma resposta só, sem alternativas por baixo do herói",
    ficheiro: CASA,
    de: "            alternativas={<OuEntao alternativas={alternativas} />}\n",
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
    ficheiro: DETALHE,
    // com a linha do comentário: sem ela, a âncora batia primeiro no <main>
    // do ecrã de carregamento, que tem a mesma classe
    de: '    // temporadas fechadas (medido — Ronda 12, Fase 5b.3)\n    <main className="mx-auto w-full max-w-2xl">',
    para: '    // temporadas fechadas (medido — Ronda 12, Fase 5b.3)\n    <main className="mx-auto w-full max-w-2xl pb-[calc(var(--dock-h)+2rem)]">',
  },
  {
    // Não é a mudança de ordem ao contrário (o guião só troca texto): é o
    // mesmo efeito — algo acima das ações de marcar empurra a secundária para
    // debaixo da dock. Prova que o teste mede o que está livre, não a ordem.
    nome: "r12-fase5b3/secundaria-debaixo-da-dock",
    descricao: "a ação secundária do detalhe volta a ficar debaixo da dock ao chegar",
    ficheiro: DETALHE,
    de: 'className="page-enter mt-4 rounded-2xl border border-line bg-raised/60 p-4"',
    para: 'className="page-enter mt-20 rounded-2xl border border-line bg-raised/60 p-4"',
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
    descricao: 'os separadores inativos da dock voltam a não ter nome para o VoiceOver',
    ficheiro: BOTTOM_NAV,
    de: ': "sr-only sm:not-sr-only"}>',
    para: ': "hidden sm:inline"}>',
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
    de: '{atual.paraTras.length} por marcar · {temporadasDe(atual.paraTras)}',
    para: '{atual.porMarcar.length} por marcar · {temporadasDe(atual.porMarcar)}',
  },
  {
    nome: "r12-fase5c/baralho-serie-pequena",
    descricao: 'no Pôr em dia, a série volta a 12px, cinza, em maiúsculas',
    ficheiro: SWIPE_CARD,
    de: '<h2 className="line-clamp-2 font-display text-2xl font-bold leading-tight text-ink [font-stretch:105%]">',
    para: '<h2 className="truncate font-display text-xs font-semibold uppercase tracking-[0.18em] text-dim [font-stretch:80%]">',
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
    descricao: 'as duas portas do primeiro uso voltam para depois dos passos, debaixo do degradê da dock',
    ficheiro: CASA,
    de: '        <div className="mt-8 flex flex-col items-center gap-2">\n          <Link\n            href="/explorar?procurar=1"\n            className="flex min-h-12 cursor-pointer items-center rounded-full bg-ink px-6 font-semibold text-tube transition hover:brightness-110 active:scale-95"\n          >\n            Procurar uma série\n          </Link>\n          <Link\n            href="/import"\n            className="flex min-h-11 cursor-pointer items-center px-3 text-[0.9375rem] text-dim transition hover:text-ink"\n          >\n            Vens do TV Time? Importar o histórico\n          </Link>\n        </div>\n\n        <ol className="mt-10 space-y-4">\n          {steps.map((step) => (\n            <li key={step.n} className="flex items-start gap-4">\n              <span className="ep-code mt-0.5 shrink-0 text-lg font-bold text-ink">\n                {step.n}\n              </span>\n              <div>\n                <p className="font-display font-semibold">{step.title}</p>\n                <p className="mt-0.5 text-[0.9375rem] text-dim">{step.text}</p>\n              </div>\n            </li>\n          ))}\n        </ol>\n',
    para: '        <ol className="mt-10 space-y-4">\n          {steps.map((step) => (\n            <li key={step.n} className="flex items-start gap-4">\n              <span className="ep-code mt-0.5 shrink-0 text-lg font-bold text-ink">\n                {step.n}\n              </span>\n              <div>\n                <p className="font-display font-semibold">{step.title}</p>\n                <p className="mt-0.5 text-[0.9375rem] text-dim">{step.text}</p>\n              </div>\n            </li>\n          ))}\n        </ol>\n\n        <div className="mt-8 flex flex-col items-center gap-2">\n          <Link\n            href="/explorar?procurar=1"\n            className="flex min-h-12 cursor-pointer items-center rounded-full bg-ink px-6 font-semibold text-tube transition hover:brightness-110 active:scale-95"\n          >\n            Procurar uma série\n          </Link>\n          <Link\n            href="/import"\n            className="flex min-h-11 cursor-pointer items-center px-3 text-[0.9375rem] text-dim transition hover:text-ink"\n          >\n            Vens do TV Time? Importar o histórico\n          </Link>\n        </div>\n',
  },
  {
    nome: "r12-fase5c/onboarding-seguir-sem-onde",
    descricao: "o onboarding volta a dizer 'Toca em Seguir' sem dizer que é na pesquisa",
    ficheiro: CASA,
    de: 'text: "Pelo nome, na pesquisa. Toca em Seguir e a série entra na tua fila.",',
    para: 'text: "Toca em Seguir e a série entra na tua fila.",',
  },
  // ── Ronda 12, Fase 6: movimento e o ritual de marcar ───────
  {
    nome: "r12-fase6/reduzido-apaga-o-que-se-desloca",
    descricao: 'com movimento reduzido, as páginas e os cartazes voltam a aparecer de golpe',
    ficheiro: CSS,
    de: '  .page-enter,\n  .poster-in,\n  .undo-in {\n    animation-name: esvanecer;\n  }',
    para: '  .page-enter,\n  .poster-in,\n  .undo-in {\n    animation: none;\n  }',
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
    ficheiro: HEROI,
    de: '                <div key={marcacoes} data-ritual="barra" aria-hidden className="barra-acende" />',
    para: '                <div key={marcacoes} data-ritual="barra" aria-hidden />',
  },
  {
    nome: "r12-fase6/ritual-festeja-o-anular",
    descricao: 'a barra passa a acender a cada mudança de episódio — anular incluído',
    ficheiro: HEROI,
    de: '    setASair(mostrado);\n    setMostrado(episode);\n',
    para: '    setASair(mostrado);\n    setMostrado(episode);\n    setMarcacoes((n) => n + 1);\n',
  },
  {
    nome: "r12-fase6/ritual-reduzido-varre",
    descricao: 'com movimento reduzido, a barra volta a varrer da esquerda para a direita',
    ficheiro: CSS,
    de: '  .barra-acende {\n    animation-name: barra-luz;\n    animation-duration: 500ms;\n  }',
    para: '  .barra-acende {\n    animation-duration: 500ms;\n  }',
  },
  // ── Ronda 12, Fase 5d: os P2 da crítica 5b.4 ───────────────
  {
    nome: "r12-fase5d/esta-semana-ciano",
    descricao: "'Esta semana' volta a ter o ciano dos buracos",
    ficheiro: CASA,
    de: '          <SectionHeader\n            label="Esta semana"',
    para: '          <SectionHeader\n            color="#3fd2c8"\n            label="Esta semana"',
  },
  {
    nome: "r12-fase5d/por-comecar-amarelo",
    descricao: "'Por começar' volta a amarelo na Biblioteca",
    ficheiro: BIBLIOTECA,
    de: '  "Por começar": CINZA,',
    para: '  "Por começar": "#e6c832",',
  },
  {
    nome: "r12-fase5d/traco-sem-ciano",
    descricao: 'com buracos, o traço do detalhe volta a não ser ciano',
    ficheiro: DETALHE,
    de: 'buracos.total > 0 ? "#3fd2c8" : accent',
    para: 'accent',
  },
  {
    nome: "r12-fase5d/modo-ativo-branco",
    descricao: 'o modo ativo do Explorar volta a ser a pílula branca',
    ficheiro: VIEW_TOGGLE,
    de: 'ativo ? "bg-ink/[0.14] text-ink"',
    para: 'ativo ? "bg-ink text-tube"',
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
    descricao: 'o A estrear volta a cortar o nome da série',
    ficheiro: ESTREAR,
    de: '<p className="font-semibold leading-snug [overflow-wrap:anywhere]">{show.name}</p>',
    para: '<p className="truncate font-semibold">{show.name}</p>',
  },
  {
    nome: "r12-fase5d/filme-nao-se-desmarca",
    descricao: 'um filme visto volta a não se poder desmarcar',
    ficheiro: FILME_PAGINA,
    de: '        {movie.watchedAt && (\n          <button\n            onClick={() => void desmarcar()}',
    para: '        {!movie && (\n          <button\n            onClick={() => void desmarcar()}',
  },
  {
    nome: "r12-fase5d/separadores-alargam-a-pagina",
    descricao: 'a 150%, os separadores do detalhe voltam a alargar a página',
    ficheiro: DETALHE,
    de: 'className="mt-6 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]"',
    para: 'className="mt-6 flex gap-1 border-b border-line"',
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
    descricao: "a casa volta a não deixar espaço ao aviso: tapa a parte de baixo do 'Marcar visto'",
    ficheiro: HEROI,
    de: 'flex-col justify-end px-5 pb-16">',
    para: 'flex-col justify-end px-5 pb-6">',
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
    descricao: 'o ✓ de cada cartaz volta a ser a pílula branca',
    ficheiro: POSTER_CARD,
    de: 'border border-ink/25 bg-tube/60 text-ink backdrop-blur',
    para: 'bg-ink text-tube shadow-md',
  },
  {
    nome: "r12-fase5d/barra-nunca-se-esconde",
    descricao: 'a barra da Biblioteca volta a ficar sempre à vista',
    ficheiro: CONTROLOS_BIBLIOTECA,
    de: '      setEscondida(y > ultimo);',
    para: '      setEscondida(y < 0);',
  },
  {
    nome: "r12-fase5d/barra-escondida-toca-se",
    descricao: 'escondida, a barra da Biblioteca volta a apanhar toques',
    ficheiro: CONTROLOS_BIBLIOTECA,
    de: 'escondida ? "pointer-events-none translate-y-6 opacity-0" : ""',
    para: 'escondida ? "translate-y-6 opacity-0" : ""',
  },
  {
    nome: "r12-fase5d/espetro-com-estados",
    descricao: 'o espetro de géneros volta a usar verde, ciano e magenta',
    ficheiro: STATS_PERFIL,
    de: 'const SPECTRUM = ["#e6c832", "#e6483c", "#3c46e6", "#c8c8c8"];',
    para: 'const SPECTRUM = ["#e6483c", "#e6c832", "#37c837", "#3fd2c8", "#3c46e6", "#d24bd2"];',
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
];

const filtro = process.argv[2];
const alvo = filtro ? MUTACOES.filter((m) => m.nome.includes(filtro)) : MUTACOES;
if (alvo.length === 0) {
  console.error(`Nenhuma mutação com "${filtro}".`);
  process.exit(1);
}

// Todos os trechos, antes de correr seja o que for — incluindo os que o
// filtro deixa de fora. Oito mutações ficaram sem trecho entre a Fase 5 e a
// 5c da Ronda 12 (o código mudou por baixo delas) e ninguém deu por isso:
// as corridas eram filtradas pela fase, e só a corrida completa as via.
const partidas = MUTACOES.filter((m) => {
  const n = readFileSync(m.ficheiro, "utf8").split(m.de).length - 1;
  return n !== 1;
});
if (partidas.length > 0) {
  console.error("Mutações cujo trecho já não existe (ou existe mais de uma vez):");
  for (const m of partidas) console.error(`  · ${m.nome} (${m.ficheiro})`);
  console.error("Uma mutação assim não repõe o bug que diz repor — corrige-a.");
  process.exit(1);
}

if (execSync("git status --porcelain", { encoding: "utf8" }).trim()) {
  console.error("Há alterações por commitar — o guião mexe nos ficheiros e repõe-nos no fim.");
  process.exit(1);
}

function correrSuite() {
  try {
    execFileSync("npx", ["playwright", "test", "--reporter=line"], {
      encoding: "utf8",
      stdio: "pipe",
    });
    return { verde: true, falhas: [], invalida: false };
  } catch (erro) {
    const saida = `${erro.stdout ?? ""}${erro.stderr ?? ""}`;
    // Uma mutação que não compila não repôs bug nenhum — só partiu o build.
    // Contá-la como "apanhada" foi exatamente o erro da primeira corrida da
    // Ronda 12: dois ✓ sem um único teste a falhar.
    if (/Failed to type check|webServer was not able to start|Failed to compile/.test(saida)) {
      return { verde: false, falhas: [], invalida: true };
    }
    const falhas = [
      ...new Set(
        [...saida.matchAll(/^\s*\d+\) \[iphone\] › (\S+?):\d+:\d+ › (.+?)$/gm)].map(
          (m) => `${m[1].replace("tests/", "")} › ${m[2].trim()}`,
        ),
      ),
    ];
    return { verde: false, falhas, invalida: falhas.length === 0 };
  }
}

const resultados = [];
for (const m of alvo) {
  const original = readFileSync(m.ficheiro, "utf8");
  if (!original.includes(m.de)) {
    console.error(`\n✖ ${m.nome}: o trecho a mutar já não existe em ${m.ficheiro}.`);
    console.error("  A mutação deixou de repor o bug que diz repor — corrige-a.");
    process.exit(1);
  }
  writeFileSync(m.ficheiro, original.replace(m.de, m.para));
  process.stdout.write(`· ${m.nome} … `);
  const { verde, falhas, invalida } = correrSuite();
  writeFileSync(m.ficheiro, original);
  resultados.push({ ...m, sobreviveu: verde, falhas, invalida });
  console.log(
    invalida
      ? "INVÁLIDA (não compilou, ou falhou sem teste nenhum — não prova nada)"
      : verde
        ? "SOBREVIVEU (ninguém deu o alarme)"
        : `apanhada por ${falhas.length}`,
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
console.log(`\n${apanhadas}/${resultados.length} bugs apanhados.`);
if (sobreviventes.length > 0) {
  console.log("Buracos na rede:");
  for (const s of sobreviventes) console.log(`  · ${s.nome} — ${s.descricao}`);
}
if (invalidas.length > 0) {
  console.log("Mutações inválidas (corrige a mutação, não o código):");
  for (const s of invalidas) console.log(`  · ${s.nome} — ${s.descricao}`);
}
if (sobreviventes.length > 0 || invalidas.length > 0) process.exit(1);
