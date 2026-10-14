import { expect, test } from "vitest";
import { blocosAtivos } from "../lib/blocos";

test("blocosAtivos tira só os blocos com enabled: false e mantém a ordem", () => {
  const blocos = [{ id: "a" }, { id: "b", enabled: false }, { id: "c", enabled: true }, { id: "d" }];
  expect(blocosAtivos(blocos).map((b) => b.id)).toEqual(["a", "c", "d"]);
});
