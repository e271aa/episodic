// Corre o parser contra uma pasta de export GDPR do TV Time e imprime um resumo.
// Uso: npx tsx scripts/inspect-export.ts [caminho-da-pasta]
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { parseEmotions, parseTrackingV2 } from "../src/lib/tvtime/parser";

const dir = path.resolve(process.argv[2] ?? path.join(process.cwd(), "..", "gdpr-data"));

function readIfExists(name: string): string | null {
  const p = path.join(dir, name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

const v2Text = readIfExists("tracking-prod-records-v2.csv");
if (!v2Text) {
  console.error(`Não encontrei tracking-prod-records-v2.csv em ${dir}`);
  process.exit(1);
}

const data = parseTrackingV2(v2Text);
const emotionsText = readIfExists("episode_emotion.csv");
if (emotionsText) data.emotions = parseEmotions(emotionsText);

// Identificação da conta
const userText = readIfExists("user.csv");
if (userText) {
  const [user] = Papa.parse<Record<string, string>>(userText.trim(), {
    header: true,
    skipEmptyLines: true,
  }).data;
  console.log(`Conta: ${user?.name} (ID ${user?.id}) — ${user?.mail}`);
}

console.log(`\nSéries: ${data.shows.length}`);
console.log(`  seguidas: ${data.shows.filter((s) => s.followed).length}`);
console.log(`  na watchlist: ${data.shows.filter((s) => s.inWatchlist).length}`);
console.log(`  arquivadas: ${data.shows.filter((s) => s.archived).length}`);
console.log(`Episódios vistos: ${data.episodes.length}`);
console.log(`  com data exata de check-in: ${data.episodes.filter((e) => e.dateIsExact).length}`);
console.log(`Filmes vistos: ${data.movies.length}`);
console.log(`Reações a episódios: ${data.emotions.length}`);
console.log(
  `Stats agregadas do export: ${data.stats.epWatchCount ?? "?"} eps, ` +
    `${data.stats.movieWatchCount ?? "?"} filmes, ` +
    `${((data.stats.totalSeriesRuntimeSec ?? 0) / 3600).toFixed(0)}h de séries`,
);

// Datas
const dates = data.episodes.map((e) => e.watchedAt).sort();
if (dates.length) {
  console.log(`Período: ${dates[0].slice(0, 10)} → ${dates[dates.length - 1].slice(0, 10)}`);
}

// Top séries por episódios vistos
const perShow = new Map<string, number>();
for (const ep of data.episodes) {
  perShow.set(ep.seriesName, (perShow.get(ep.seriesName) ?? 0) + 1);
}
const top = [...perShow.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log(`\nTop séries (episódios vistos):`);
for (const [name, count] of top) console.log(`  ${String(count).padStart(4)}  ${name}`);

// Validação cruzada com user_tv_show_data.csv
const showDataText = readIfExists("user_tv_show_data.csv");
if (showDataText) {
  const rows = Papa.parse<Record<string, string>>(showDataText.trim(), {
    header: true,
    skipEmptyLines: true,
  }).data;
  const mismatches = rows.filter(
    (r) => Number(r.nb_episodes_seen) !== (perShow.get(r.tv_show_name) ?? 0),
  );
  if (mismatches.length === 0) {
    console.log(`\n✓ Contagens batem certo com user_tv_show_data.csv (${rows.length} séries)`);
  } else {
    console.log(`\n⚠ Divergências vs user_tv_show_data.csv:`);
    for (const r of mismatches) {
      console.log(
        `  ${r.tv_show_name}: export diz ${r.nb_episodes_seen}, parser contou ${perShow.get(r.tv_show_name) ?? 0}`,
      );
    }
  }
}

// Tipos de linha desconhecidos → sinal de que o parser precisa de ser estendido
const unknown = Object.entries(data.unknownKeys);
if (unknown.length) {
  console.log(`\n⚠ Tipos de linha não reconhecidos (rever parser):`);
  for (const [prefix, count] of unknown) console.log(`  ${count}× ${prefix}`);
} else {
  console.log(`\n✓ Todas as linhas do CSV foram reconhecidas pelo parser`);
}
