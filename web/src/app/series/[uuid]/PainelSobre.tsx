import type { StoredShow } from "@/lib/db";
import { porExtenso } from "@/lib/datas";
import { translateGenre } from "@/lib/stats";
import { Grupo, Linha } from "@/components/mira/Grupo";
import Codigo from "@/components/mira/Codigo";
import { STATUS_PT } from "./serie";

/** A sinopse e a ficha da série, no «···». */
export default function PainelSobre({ show }: { show: StoredShow }) {
  return (
    <>
      {show.overview ? (
        <p className="px-1 text-base leading-relaxed text-label-2">{show.overview}</p>
      ) : (
        <p className="px-1 text-[0.88rem] text-label-2">Sem sinopse disponível.</p>
      )}
      <Grupo>
        {show.firstAired && (
          <Linha titulo="Estreia" depois={<Codigo>{porExtenso(show.firstAired)}</Codigo>} />
        )}
        {show.status && <Linha titulo="Estado" depois={STATUS_PT[show.status] ?? show.status} />}
        {show.totalEpisodes != null && (
          <Linha titulo="Episódios" depois={<Codigo>{show.totalEpisodes}</Codigo>} />
        )}
        {show.genres && show.genres.length > 0 && (
          <Linha titulo="Géneros" subtitulo={show.genres.map(translateGenre).join(" · ")} />
        )}
      </Grupo>
    </>
  );
}
