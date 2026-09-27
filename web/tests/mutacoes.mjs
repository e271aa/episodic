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
const CLOUD_ACCOUNT = "src/components/CloudAccount.tsx";
const BOTTOM_NAV = "src/components/BottomNav.tsx";

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
    de: '    return s.watchedCount === 0 ? "Por começar" : "A ver";',
    para: '    return "A ver";',
  },
  {
    nome: "fase3/ordem-das-seccoes",
    descricao: "as completas voltam para o segundo lugar",
    ficheiro: BIBLIOTECA,
    de: 'const ESTADOS = [\n  "A ver",\n  "Por começar",\n  "Para ver",\n  "Completas",',
    para: 'const ESTADOS = [\n  "A ver",\n  "Completas",\n  "Por começar",\n  "Para ver",',
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
    de: "void marcar(atual.paraTras, `${contarEpisodios(atual.paraTras.length)} marcados`)",
    para: "void marcar(atual.porMarcar, `${contarEpisodios(atual.paraTras.length)} marcados`)",
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
    de: '<h1 className="sr-only">Biblioteca</h1>',
    para: "",
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
    de: '"#101014"',
    para: '"#0b0e14"',
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
    de: "  *:not(.undo-drain),\n  *:not(.undo-drain)::before,\n  *:not(.undo-drain)::after {",
    para: "  *,\n  *::before,\n  *::after {",
  },
  {
    nome: "r12-fase5b/listas-transborda-320",
    descricao: "/listas volta a transbordar a 320px",
    ficheiro: LISTAS_PAGINA,
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
    ficheiro: LISTAS_PAGINA,
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
    nome: "r12-fase5b/cloud-password-sem-rotulo",
    descricao: "o campo de password na conta volta a não ter <label>",
    ficheiro: CLOUD_ACCOUNT,
    de: '<label htmlFor="cloud-nova-password" className="font-display text-[15px] font-semibold">\n              Password\n            </label>',
    para: '<p className="font-display text-[15px] font-semibold">Password</p>',
  },
  {
    nome: "r12-fase5b/dock-parte-a-seguir-320",
    descricao: "a dock volta a partir 'A seguir' em duas linhas a 320px",
    ficheiro: BOTTOM_NAV,
    de: '<span className={active ? "whitespace-nowrap" : "hidden sm:inline"}>',
    para: '<span className={active ? "" : "hidden sm:inline"}>',
  },
];

const filtro = process.argv[2];
const alvo = filtro ? MUTACOES.filter((m) => m.nome.includes(filtro)) : MUTACOES;
if (alvo.length === 0) {
  console.error(`Nenhuma mutação com "${filtro}".`);
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
