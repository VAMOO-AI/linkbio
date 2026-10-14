import type { ChaveDe } from "../opcoes";
import type { Preset } from "./tipos";
import { brutal } from "./brutal";
import { editorial } from "./editorial";
import { neutro } from "./neutro";
import { noite } from "./noite";
import { vibrante } from "./vibrante";
import { vitrine } from "./vitrine";

export const PRESETS = { neutro, noite, editorial, vitrine, brutal, vibrante } satisfies Record<
  ChaveDe<"preset">,
  Preset
>;

export type { Paleta, Preset, Fonte, FonteKey } from "./tipos";
