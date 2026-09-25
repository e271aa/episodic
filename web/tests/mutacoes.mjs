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
    para: "}): Promise<StoredMovie | null> {\n  if (procura) return null;\n  const direto",
  },
  {
    nome: "r12/serie-reconhecida",
    descricao: "a pesquisa deixa de reconhecer a série que já tens (volta a duplicá-la)",
    ficheiro: EXISTENTE,
    de: "}): Promise<StoredShow | null> {\n  for (const chave of [",
    para: "}): Promise<StoredShow | null> {\n  if (procura) return null;\n  for (const chave of [",
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
    return { verde: true, falhas: [] };
  } catch (erro) {
    const saida = `${erro.stdout ?? ""}${erro.stderr ?? ""}`;
    const falhas = [
      ...new Set(
        [...saida.matchAll(/^\s*\d+\) \[iphone\] › (\S+?):\d+:\d+ › (.+?)$/gm)].map(
          (m) => `${m[1].replace("tests/", "")} › ${m[2].trim()}`,
        ),
      ),
    ];
    return { verde: false, falhas };
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
  const { verde, falhas } = correrSuite();
  writeFileSync(m.ficheiro, original);
  resultados.push({ ...m, sobreviveu: verde, falhas });
  console.log(verde ? "SOBREVIVEU (ninguém deu o alarme)" : `apanhada por ${falhas.length}`);
}

console.log("\n─── Rede de segurança ───\n");
for (const r of resultados) {
  console.log(`${r.sobreviveu ? "✖" : "✓"} ${r.nome} — ${r.descricao}`);
  for (const f of r.falhas.slice(0, 3)) console.log(`    ${f}`);
  if (r.falhas.length > 3) console.log(`    …e mais ${r.falhas.length - 3}`);
}

const sobreviventes = resultados.filter((r) => r.sobreviveu);
console.log(
  `\n${resultados.length - sobreviventes.length}/${resultados.length} bugs apanhados.`,
);
if (sobreviventes.length > 0) {
  console.log("Buracos na rede:");
  for (const s of sobreviventes) console.log(`  · ${s.nome} — ${s.descricao}`);
  process.exit(1);
}
