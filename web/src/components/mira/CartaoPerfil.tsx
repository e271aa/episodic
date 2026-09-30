import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Poster from "@/components/Poster";
import { UserIcon } from "@/components/icons";

/**
 * A identidade do Perfil: a arte da série favorita (ou da mais vista) no topo,
 * o avatar a sobrepor-se-lhe, o nome, «Desde …» e a personagem favorita com a
 * foto do ator. É a única cor do ecrã — a da série de cada um. O texto fica
 * sempre **por baixo** da arte, nunca por cima. Leva às Definições.
 */
export default function CartaoPerfil({
  href,
  nome,
  temNome,
  avatarUrl,
  subtitulo,
  capa,
  personagem,
  pessoaImg,
}: {
  href: string;
  nome: string;
  /** false: «Neste aparelho» / «Sem nome» — o avatar mostra o ícone, não uma inicial */
  temNome: boolean;
  avatarUrl: string | null;
  subtitulo: string;
  /** o `backdropPath` da série favorita; sem ele o cartão fica só com a linha */
  capa: string | null;
  /** «Personagem · Ator» */
  personagem: string | null;
  pessoaImg: string | null;
}) {
  const tamanho = capa ? "h-16 w-16" : "h-12 w-12";
  return (
    <Link href={href} className="block overflow-hidden rounded-[26px] bg-group transition-transform duration-100 ease-out active:scale-[0.99]">
      {capa && (
        <div className="relative h-32 bg-elevated">
          <Poster path={capa} alt="" size="w780" fill sizes="(max-width: 672px) 100vw, 672px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-group via-group/30 to-transparent" />
        </div>
      )}
      <div className={`flex items-end gap-3 px-4 pb-4 ${capa ? "-mt-8" : "pt-4"} relative`}>
        <span
          className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-chip ${tamanho} ${
            capa ? "ring-4 ring-group" : ""
          }`}
        >
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill sizes="64px" className="object-cover" />
          ) : temNome ? (
            <span aria-hidden className="font-rounded text-xl font-semibold text-label">
              {nome.trim()[0]?.toUpperCase()}
            </span>
          ) : (
            <UserIcon aria-hidden className="h-6 w-6 text-label-2" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.18rem] font-bold leading-tight text-label">{nome}</span>
          <span className="mt-0.5 block text-[0.76rem] leading-snug text-label-2">{subtitulo}</span>
          {personagem && <span className="block text-[0.76rem] leading-snug text-label-2">{personagem}</span>}
        </span>
        {pessoaImg && (
          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-elevated">
            <Poster path={pessoaImg} alt="" size="w185" fill sizes="56px" className="object-cover" />
          </span>
        )}
        <ChevronRight aria-hidden className="mb-1 h-4 w-4 shrink-0 text-label-3" strokeWidth={2.4} />
      </div>
    </Link>
  );
}
