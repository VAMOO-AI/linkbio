import next from "eslint-config-next";

// Config flat mínima: regras do Next + tsc cobre os tipos.
const config = [
  {
    ignores: ["node_modules/**", ".next/**", "out/**"],
  },
  ...next,
];

export default config;
