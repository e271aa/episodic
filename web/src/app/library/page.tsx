import { redirect } from "next/navigation";

// A biblioteca passou a viver em /series (estrutura por separadores, como o TV Time).
export default function LibraryRedirect() {
  redirect("/series");
}
