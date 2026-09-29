/**
 * A aparência da app: Automático (segue o iPhone), Noite ou Claro
 * (Ronda 14, Mira). Escolhida em Perfil › Aparência; guardada só neste
 * aparelho — é uma preferência do ecrã, não um dado da biblioteca.
 *
 * O `data-theme` no <html> tem de estar lá **antes do primeiro paint**, senão
 * a página pisca no tema errado. Por isso há duas metades: `SCRIPT_APARENCIA`
 * corre no <head> antes da app (layout.tsx), e `aplicarAparencia` corre
 * quando a pessoa muda a escolha.
 */
export type Aparencia = "auto" | "noite" | "claro";

export const CHAVE_APARENCIA = "aparencia";

/** a cor da barra de estado e do ecrã de arranque, em cada modo */
export const COR_DO_TEMA = { noite: "#000000", claro: "#f2f2f7" } as const;

export function lerAparencia(): Aparencia {
  try {
    const v = localStorage.getItem(CHAVE_APARENCIA);
    return v === "noite" || v === "claro" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function aplicarAparencia(a: Aparencia): void {
  try {
    if (a === "auto") localStorage.removeItem(CHAVE_APARENCIA);
    else localStorage.setItem(CHAVE_APARENCIA, a);
  } catch {
    // sem armazenamento (navegação privada): aplica-se só nesta visita
  }
  const html = document.documentElement;
  if (a === "auto") html.removeAttribute("data-theme");
  else html.setAttribute("data-theme", a);
  pintarBarraDeEstado(a);
}

/**
 * As <meta theme-color> (a barra de estado e o ecrã de arranque). São só
 * nossas — não vêm do `viewport` do Next, que as voltava a escrever ao
 * hidratar. «Automático»: duas, uma por modo do sistema; um modo fixo: as
 * duas com a cor dele.
 */
function pintarBarraDeEstado(a: Aparencia): void {
  for (const modo of ["claro", "noite"] as const) {
    const media = `(prefers-color-scheme: ${modo === "claro" ? "light" : "dark"})`;
    let m = document.head.querySelector<HTMLMetaElement>(`meta[name="theme-color"][media="${media}"]`);
    if (!m) {
      m = document.createElement("meta");
      m.name = "theme-color";
      m.media = media;
      document.head.appendChild(m);
    }
    m.content = a === "auto" ? COR_DO_TEMA[modo] : COR_DO_TEMA[a];
  }
}

/**
 * O mesmo, em texto, para correr no <head> antes da app. Sem dependências e
 * tolerante a tudo: se falhar, fica o modo do sistema e a cor do manifest.
 */
export const SCRIPT_APARENCIA = `(function(){var a="auto";try{var v=localStorage.getItem("${CHAVE_APARENCIA}");if(v==="noite"||v==="claro")a=v}catch(e){}if(a!=="auto")document.documentElement.setAttribute("data-theme",a);var cores={claro:"${COR_DO_TEMA.claro}",noite:"${COR_DO_TEMA.noite}"};["claro","noite"].forEach(function(modo){var m=document.createElement("meta");m.name="theme-color";m.media="(prefers-color-scheme: "+(modo==="claro"?"light":"dark")+")";m.content=a==="auto"?cores[modo]:cores[a];document.head.appendChild(m)})})();`;
