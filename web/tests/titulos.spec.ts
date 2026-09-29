import { test, expect } from "@playwright/test";
import { tituloParaMostrar } from "../src/lib/titulos";

test("o original em alfabeto latino ganha, e o pt fica de alias", () => {
  expect(tituloParaMostrar("Separação", "Severance")).toEqual({ nome: "Severance", outro: "Separação" });
  expect(tituloParaMostrar("Prison Break: Fuga da Prisão", "Prison Break")).toEqual({
    nome: "Prison Break",
    outro: "Prison Break: Fuga da Prisão",
  });
});

test("iguais: sem alias; sem original: fica o pt", () => {
  expect(tituloParaMostrar("Dark", "Dark")).toEqual({ nome: "Dark", outro: null });
  expect(tituloParaMostrar("Dark", null)).toEqual({ nome: "Dark", outro: null });
});

test("um original que não é latino (japonês, coreano, cirílico) não substitui o pt", () => {
  expect(tituloParaMostrar("Ataque dos Titãs", "進撃の巨人")).toEqual({ nome: "Ataque dos Titãs", outro: "進撃の巨人" });
  expect(tituloParaMostrar("Parasita", "기생충")).toEqual({ nome: "Parasita", outro: "기생충" });
});

test("pontuação, números e acentos do original contam como latino", () => {
  expect(tituloParaMostrar("Marte", "Ça Va? 2: Les Années 80!").nome).toBe("Ça Va? 2: Les Années 80!");
});
