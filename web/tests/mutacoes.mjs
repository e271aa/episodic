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
