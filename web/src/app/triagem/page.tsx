import { redirect } from "next/navigation";

// "Triagem" mudou de nome — não dizia às claras o que fazes ali. O redirect
// mantém vivo qualquer link antigo (atalho guardado, PWA já instalada).
export default function TriagemRedirect() {
  redirect("/em-dia");
}
