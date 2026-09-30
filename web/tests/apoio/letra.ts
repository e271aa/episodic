/**
 * O iPhone (e o Mac) têm a SF; o Linux do CI não. Sem ela o WebKit cai numa
 * letra mais larga e as medições de «o texto cabe?» no limite (320px com o
 * texto a 150%) dão 331px em vez de 320, sem nada partido. Essas medições só
 * valem onde há a letra do iPhone: correm no Mac, antes de cada commit.
 */
export const SEM_LETRA_DO_IPHONE = process.platform !== "darwin";
export const RAZAO_SEM_LETRA = "medição de texto no limite: só vale com a SF (Mac/iPhone), não no Linux do CI";
