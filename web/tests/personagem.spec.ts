import { test, expect } from "./apoio/base";
import { seriesParaPersonagem } from "../src/lib/personagem";
import type { StoredShow, WatchedEpisode } from "../src/lib/db";

/**
 * Perfil › Editar › Personagem favorita: independente da série favorita, mas
 * só de séries que já se viu ou se está a ver (pelo menos um episódio marcado).
 *
 * A escolha no ecrã (trocar de série sem perder a personagem, «Remover», o
 * aviso sem séries vistas) testava-se na vitrine `/mira`, que saiu na Fase 12.
 * O editor de perfil só existe com nuvem e os testes correm sem ela: fica
 * só a regra, aqui.
 */

const serie = (uuid: string, name: string, extra: Partial<StoredShow> = {}) =>
  ({ uuid, name, ...extra }) as StoredShow;
const visto = (showUuid: string) => ({ showUuid, season: 1, episode: 1 }) as WatchedEpisode;

test("só contam as séries com pelo menos um episódio marcado, por ordem alfabética, arquivadas incluídas", () => {
  const shows = [
    serie("s-c", "Casa", { archived: true }),
    serie("s-a", "Alfa"),
    serie("s-b", "Beta", { followed: true, inWatchlist: true }), // seguida, nada marcado
    serie("s-d", "Ébano"),
  ];
  const r = seriesParaPersonagem(shows, [visto("s-c"), visto("s-a"), visto("s-a"), visto("s-d")]);
  expect(r.map((s) => s.name)).toEqual(["Alfa", "Casa", "Ébano"]);
});

test("sem nada visto não há séries de onde escolher", () => {
  expect(seriesParaPersonagem([serie("s-a", "Alfa")], [])).toEqual([]);
});
