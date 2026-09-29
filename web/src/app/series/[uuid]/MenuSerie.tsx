"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SheetPanel from "@/components/SheetPanel";
import AddToListButton from "@/components/AddToListButton";
import { Grupo, Linha } from "@/components/mira/Grupo";
import Codigo from "@/components/mira/Codigo";
import type { StoredShow } from "@/lib/db";
import { STATUS_PT } from "./serie";
import PainelSobre from "./PainelSobre";
import PainelEstatisticas from "./PainelEstatisticas";
import type { Serie } from "./useSerie";

type Vista = "menu" | "sobre" | "estatisticas";

/**
 * O «···» do detalhe (Mira, B·2a): o que saiu dos três separadores e das
 * ações que não são marcar. Sobre e Estatísticas da série (a decisão da
 * Fase 0: as estatísticas de uma série vivem aqui, junto do Sobre), juntar a
 * uma lista, deixar de seguir e arquivar — os dois desfazem-se no aviso.
 */
export default function MenuSerie({
  aberto,
  onFechar,
  uuid,
  show,
  serie,
  accent,
}: {
  aberto: boolean;
  onFechar: () => void;
  uuid: string;
  show: StoredShow;
  serie: Serie;
  accent: string;
}) {
  const [vista, setVista] = useState<Vista>("menu");
  const fechar = () => {
    onFechar();
    setVista("menu");
  };
  const titulo = vista === "sobre" ? "Sobre" : vista === "estatisticas" ? "Estatísticas" : show.name;
  const { alternar, watchedCount } = serie;

  return (
    <SheetPanel titulo={titulo} aberto={aberto} onFechar={fechar} agrupada>
      <div className="flex flex-col gap-4">
        {vista === "menu" ? (
          <>
            <Grupo>
              <Linha
                titulo="Sobre"
                subtitulo={
                  [show.status && (STATUS_PT[show.status] ?? show.status), show.firstAired?.slice(0, 4)]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                onClick={() => setVista("sobre")}
                chevron
              />
              <Linha
                titulo="Estatísticas"
                subtitulo={
                  <>
                    <Codigo>
                      {watchedCount}
                      {show.totalEpisodes != null && `/${show.totalEpisodes}`}
                    </Codigo>{" "}
                    episódios vistos
                  </>
                }
                onClick={() => setVista("estatisticas")}
                chevron
              />
            </Grupo>

            <AddToListButton
              kind="show"
              refId={uuid}
              label="Juntar a uma lista"
              wrapperClassName="relative"
              className="flex min-h-[50px] w-full cursor-pointer items-center justify-between rounded-[26px] bg-group px-4 text-left text-base text-label transition-colors active:bg-fill"
            />

            <Grupo>
              <Linha
                titulo={show.followed ? "Deixar de seguir" : "Voltar a seguir"}
                subtitulo={show.followed ? "Sai da fila do «A seguir»; os vistos ficam" : undefined}
                onClick={() => {
                  void alternar("followed");
                  fechar();
                }}
                chevron={false}
              />
              <Linha
                titulo={show.archived ? "Tirar do arquivo" : "Arquivar"}
                subtitulo={show.archived ? undefined : "Fica em Biblioteca › Arquivadas"}
                onClick={() => {
                  void alternar("archived");
                  fechar();
                }}
                chevron={false}
              />
            </Grupo>

            {show.imdbId && (
              <a
                href={`https://www.imdb.com/title/${show.imdbId}/`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-between px-1 text-[0.88rem] text-label-2"
              >
                Ver no IMDb
                <ChevronRight aria-hidden className="h-4 w-4 text-label-3" strokeWidth={2.4} />
              </a>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setVista("menu")}
              className="-ml-1 flex min-h-11 w-fit cursor-pointer items-center gap-1 text-[0.88rem] font-semibold text-label"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2.6} />
              Opções
            </button>
            {vista === "sobre" ? (
              <div id="painel-sobre" className="flex flex-col gap-4">
                <PainelSobre show={show} />
              </div>
            ) : (
              <div id="painel-estatisticas" className="flex flex-col gap-4">
                <PainelEstatisticas show={show} serie={serie} accent={accent} />
              </div>
            )}
          </>
        )}
      </div>
    </SheetPanel>
  );
}
