// Pilha de anulação. A ação acontece já — o arrependimento é que ganha uma
// segunda hipótese. Nada de "tens a certeza?": confirmar castiga toda a gente
// pelo engano de uma vez, anular não castiga ninguém.
//
// É uma pilha e não um aviso único de propósito: marcar cinco episódios
// seguidos no "Pôr em dia" tem de poder recuar cinco vezes, pela ordem inversa.

export interface UndoEntry {
  id: number;
  /** o que aconteceu, ex. "Episódio marcado como visto" */
  label: string;
  /** o alvo concreto, ex. "Friends · S01·E21" */
  detail?: string;
  undo: () => void | Promise<void>;
  /** momento (ms) em que deixa de se poder anular */
  expiresAt: number;
}

/** Janela para mudar de ideias. O Gmail usa 10s no envio; marcar um episódio
 *  percebe-se mais depressa que isso. */
export const GRACE_MS = 7000;

let stack: UndoEntry[] = [];
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const listeners = new Set<(entries: UndoEntry[]) => void>();

function emit(): void {
  for (const listener of listeners) listener(stack);
}

function drop(id: number): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  stack = stack.filter((e) => e.id !== id);
}

export function subscribeUndo(fn: (entries: UndoEntry[]) => void): () => void {
  listeners.add(fn);
  fn(stack);
  return () => {
    listeners.delete(fn);
  };
}

export function pushUndo(entry: {
  label: string;
  detail?: string;
  undo: () => void | Promise<void>;
}): void {
  const id = nextId++;
  stack = [...stack, { ...entry, id, expiresAt: Date.now() + GRACE_MS }];
  timers.set(
    id,
    setTimeout(() => {
      drop(id);
      emit();
    }, GRACE_MS),
  );
  emit();
}

/** Anula a ação mais recente que ainda esteja dentro da janela. */
export function undoLast(): void {
  const entry = stack[stack.length - 1];
  if (!entry) return;
  drop(entry.id);
  emit();
  void entry.undo();
}

export function dismissAll(): void {
  for (const entry of stack) drop(entry.id);
  emit();
}
