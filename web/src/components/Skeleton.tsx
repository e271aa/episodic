// Peças de esqueleto. Existem para os ecrãs de carregamento serem a SOMBRA
// do que vem a seguir, e não barras genéricas: quem espera já percebe onde
// vai aparecer o quê, e o salto quando os dados chegam é mínimo.

/** Bloco base. `className` define a forma; o brilho vem do `.skeleton`.
 *  `tone` é o fundo: "panel" contra o fundo da página, "raised" quando o
 *  esqueleto vive dentro de um painel (senão desaparecia nele). Prop em vez
 *  de uma classe no `className` porque `bg-panel` e `bg-raised` são utilitários
 *  do mesmo nível — quem ganha dependeria da ordem no CSS gerado, não da
 *  ordem em que foram escritos. */
export function Bone({
  className = "",
  tone = "panel",
}: {
  className?: string;
  tone?: "panel" | "raised";
}) {
  return (
    <div
      aria-hidden
      className={`skeleton ${tone === "raised" ? "bg-raised" : "bg-panel"} ${className}`}
    />
  );
}

/** Título de ecrã (o `<h1>` de 2xl que todas as páginas têm no topo). */
export function TitleBone() {
  return <Bone className="h-8 w-40 rounded-lg" />;
}

/** Grelha de cartazes — a Biblioteca e as Listas. */
export function PosterGridBone({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Bone className="aspect-2/3 w-full rounded-2xl" />
          <Bone className="mt-1.5 h-4 w-4/5 rounded" />
          <Bone className="mt-1 h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Fila horizontal de cartazes — o Explorar. */
export function PosterRowBone({ count = 4 }: { count?: number }) {
  return (
    <div className="-mx-4 mt-3 flex gap-3 overflow-hidden px-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="w-32 shrink-0 sm:w-36">
          <Bone className="aspect-2/3 w-full rounded-2xl" />
          <Bone className="mt-1.5 h-4 w-4/5 rounded" />
          <Bone className="mt-1 h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Linha com cartaz pequeno + duas linhas de texto (A estrear, Listas). */
export function ListRowsBone({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-6 space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-line p-3">
          <Bone className="h-16 w-11 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <Bone className="h-4 w-2/5 rounded" />
            <Bone className="mt-2 h-3 w-3/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Cabeçalho das páginas de detalhe: subcapa + capa + título. */
export function DetailHeaderBone() {
  return (
    <>
      <Bone className="h-44 w-full sm:h-56" />
      <div className="px-4">
        <div className="-mt-10 flex items-end gap-4">
          <Bone className="aspect-2/3 w-24 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 pb-1">
            <Bone className="h-6 w-2/3 rounded" />
            <Bone className="mt-2 h-3 w-1/2 rounded" />
            <Bone className="mt-2 h-3 w-1/3 rounded" />
          </div>
        </div>
      </div>
    </>
  );
}

/** Cartões empilhados de altura fixa — Estatísticas e afins. */
export function CardsBone({ count = 3, height = "h-24" }: { count?: number; height?: string }) {
  return (
    <div className="mt-6 space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Bone key={i} className={`${height} w-full rounded-2xl`} />
      ))}
    </div>
  );
}
