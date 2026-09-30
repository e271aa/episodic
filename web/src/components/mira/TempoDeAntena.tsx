import { diasEHoras, milhares } from "@/lib/numeros";

export interface HorasDeUmAnoBarra {
  ano: number;
  horas: number;
}

/**
 * O widget grande do Perfil (B·5): as horas de antena em SF Rounded, o mesmo
 * tempo por extenso, e à direita as barras por ano. As horas por ano são
 * **estimadas** (o TV Time só deu o total) — a legenda diz-o, e um gráfico de
 * uma coluna só não se desenha. A tabela com os valores está em Estatísticas.
 */
export default function TempoDeAntena({
  horas,
  porAno,
  className = "",
}: {
  horas: number | null;
  porAno: HorasDeUmAnoBarra[];
  className?: string;
}) {
  const maximo = Math.max(1, ...porAno.map((a) => a.horas));
  const corrente = new Date().getFullYear();
  const leitura = porAno.map((a) => `${a.ano}: ${milhares(a.horas)} h`).join("; ");
  return (
    <section className={`flex items-end justify-between gap-4 rounded-[26px] bg-group px-[18px] py-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[0.88rem] font-semibold text-label-2">Tempo de antena</h2>
        {horas !== null ? (
          <>
            <p className="mt-1 font-rounded text-[2.7rem] font-bold leading-none tabular-nums text-label">
              {milhares(Math.floor(horas))}
              <span className="ml-1.5 text-[1.4rem] font-semibold text-label-2">h</span>
            </p>
            <p className="mt-2 text-[0.76rem] text-label-2">{diasEHoras(horas)}</p>
          </>
        ) : (
          <p className="mt-2 text-[0.88rem] text-label-2">
            Começa a contar com o primeiro episódio que marcares.
          </p>
        )}
      </div>
      {porAno.length > 1 && (
        <figure className="shrink-0">
          <div
            role="img"
            aria-label={`Horas por ano, estimadas — ${leitura}`}
            className="flex h-14 items-end justify-end gap-1"
          >
            {porAno.map((a) => (
              <span
                key={a.ano}
                className={`w-2 rounded-[2px] ${a.ano === corrente ? "bg-label" : "bg-label/35"}`}
                style={{ height: `${Math.max(4, (a.horas / maximo) * 56)}px` }}
              />
            ))}
          </div>
          <figcaption className="mt-1.5 text-right text-[0.65rem] text-faint">por ano · estimado</figcaption>
        </figure>
      )}
    </section>
  );
}
