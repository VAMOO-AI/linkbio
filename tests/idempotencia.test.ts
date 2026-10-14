import { describe, expect, test } from "vitest";
import { ConfigSchema } from "../config/schema";
import exemplo from "../linkbio.config";

/**
 * scripts/check.ts importa a config já validada por defineConfig e valida de novo.
 * Por isso validar duas vezes precisa dar o mesmo resultado.
 */
describe("idempotência do schema", () => {
  test("parse(parse(config de exemplo)) é igual ao primeiro parse", () => {
    const uma = ConfigSchema.parse(exemplo);
    expect(ConfigSchema.parse(uma)).toEqual(uma);
  });

  test("tema legado v0.1.0 continua válido e estável", () => {
    const legado = { ...exemplo, theme: { preset: "neutro-claro", accent: "#007dff", font: "Plus Jakarta Sans", radius: 6 } };
    const uma = ConfigSchema.parse(legado);
    expect(ConfigSchema.parse(uma)).toEqual(uma);
  });
});
