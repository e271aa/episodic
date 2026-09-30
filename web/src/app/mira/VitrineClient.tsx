"use client";

import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import Acao from "@/components/mira/Acao";
import EscolhaAparencia from "@/components/mira/EscolhaAparencia";
import { Grupo, Linha } from "@/components/mira/Grupo";
import MenuFiltro from "@/components/mira/MenuFiltro";
import Segmentado from "@/components/mira/Segmentado";
import TituloGrande from "@/components/mira/TituloGrande";
import EscolhaPersonagem, { type PersonagemEscolhida } from "@/components/EscolhaPersonagem";
import { getShows, type StoredShow } from "@/lib/db";
import BibliotecaExemplo from "./BibliotecaExemplo";

/** O seletor de personagem do editor de perfil, com a biblioteca local. */
function PersonagemExemplo() {
  const [shows, setShows] = useState<StoredShow[]>([]);
  const [escolhida, setEscolhida] = useState<PersonagemEscolhida | null>(null);
  useEffect(() => {
    void getShows().then(setShows);
  }, []);
  return (
    <section className="mt-6 px-1">
      <EscolhaPersonagem shows={shows} favoritaUuid="" atual={escolhida} onEscolher={setEscolhida} />
    </section>
  );
}

type Seg = "series" | "filmes" | "listas";
type Filtro = "todas" | "em-curso" | "por-comecar" | "retomar" | "completas" | "arquivadas";
type Ordem = "ultima" | "az" | "adicionada" | "estreia";

function Capa({ cor }: { cor: string }) {
  return <span className="block h-[52px] w-9 rounded-lg" style={{ background: cor }} />;
}

export default function VitrineClient() {
  const [seg, setSeg] = useState<Seg>("series");
  const [filtro, setFiltro] = useState<Filtro>("em-curso");
  const [ordem, setOrdem] = useState<Ordem>("ultima");

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-[max(12px,env(safe-area-inset-top))]">
      <TituloGrande
        titulo="A seguir"
        rotulo="Terça, 29 de setembro"
        resumo="vitrine da Mira"
        direita={
          <button className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-fill px-4 text-[0.88rem] font-semibold text-label">
            Pôr em dia <span className="ep-code font-medium text-label-2">4</span>
          </button>
        }
      />

      <BibliotecaExemplo />

      <Grupo titulo="Aparência" className="mt-6">
        <div className="p-3">
          <EscolhaAparencia />
        </div>
      </Grupo>

      {/* o cartão da casa, só com primitivas */}
      <section className="mt-6 overflow-hidden rounded-[28px] bg-group">
        <div className="h-44 bg-gradient-to-br from-[#35606e] to-[#0d2530]" />
        <div className="flex flex-col gap-3.5 px-[18px] pb-[18px] pt-4">
          <h2 className="text-[1.65rem] font-bold leading-[1.1] text-label">Severance</h2>
          <p className="text-base text-label-2">
            <span className="ep-code mr-2 text-[0.88rem] font-semibold text-label">S02·E07</span>
            Chikhai Bardo
          </p>
          <div className="flex items-center gap-[3px]">
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className={`h-1 flex-1 rounded-sm ${i < 6 ? "bg-label" : "bg-track"}`} />
            ))}
            <span className="ep-code ml-2 text-[0.76rem] text-label-2">6/10</span>
          </div>
          <Acao icone={<Check aria-hidden className="h-[22px] w-[22px]" strokeWidth={2.6} />}>Marcar visto</Acao>
        </div>
      </section>

      <Grupo titulo="Ou então" className="mt-6">
        <Linha alta href="#" antes={<Capa cor="#5b3a29" />} titulo="The Bear" subtitulo="Continuar · S03·E04" />
        <Linha alta href="#" antes={<Capa cor="#2d4a6b" />} titulo="Past Lives" subtitulo="Filme · 2023 · para ver" />
      </Grupo>

      <section className="mt-6 flex flex-col gap-3">
        <Segmentado<Seg>
          rotulo="Tipo de biblioteca"
          valor={seg}
          onChange={setSeg}
          opcoes={[
            { valor: "series", nome: "Séries", contagem: 138 },
            { valor: "filmes", nome: "Filmes", contagem: 266 },
            { valor: "listas", nome: "Listas" },
          ]}
        />
        <div className="flex items-center justify-between">
          <MenuFiltro<Filtro>
            rotulo="Filtrar séries"
            valor={filtro}
            onChange={setFiltro}
            opcoes={[
              { valor: "todas", nome: "Todas", contagem: 138 },
              { valor: "em-curso", nome: "Em curso", contagem: 12 },
              { valor: "por-comecar", nome: "Por começar", contagem: 9 },
              { valor: "retomar", nome: "Retomar", contagem: 17 },
              { valor: "completas", nome: "Completas", contagem: 84 },
              { valor: "arquivadas", nome: "Arquivadas", contagem: 16 },
            ]}
          />
          <MenuFiltro<Ordem>
            simples
            rotulo="Ordenar"
            valor={ordem}
            onChange={setOrdem}
            opcoes={[
              { valor: "ultima", nome: "Última vista" },
              { valor: "az", nome: "A–Z" },
              { valor: "adicionada", nome: "Adicionada" },
              { valor: "estreia", nome: "Estreia" },
            ]}
          />
        </div>
      </section>

      <section className="mt-6 flex flex-col gap-2.5">
        <Acao>Sim, vi os três</Acao>
        <Acao tipo="secundaria">Um a um</Acao>
        <div className="flex gap-2.5">
          <Acao grande={false} tipo="secundaria" icone={<Plus aria-hidden className="h-4 w-4" strokeWidth={2.6} />}>
            Para ver
          </Acao>
          <Acao grande={false} tipo="contorno" icone={<Check aria-hidden className="h-4 w-4" strokeWidth={2.6} />}>
            Na lista
          </Acao>
        </div>
      </section>

      <PersonagemExemplo />

      <Grupo titulo="Listas" className="mt-6">
        <Linha href="#" titulo="Clássicos para rever" depois={<span className="ep-code">6</span>} />
        <Linha href="#" titulo="Para o fim de semana" depois={<span className="ep-code">11</span>} />
        <Linha href="#" titulo="Anime de 2025" depois={<span className="ep-code">4</span>} />
      </Grupo>

      <div className="h-[40vh]" />
    </main>
  );
}
