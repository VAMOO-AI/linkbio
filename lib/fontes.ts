import { Albert_Sans, Archivo, Bricolage_Grotesque, DM_Sans, Fraunces, Instrument_Serif, Inter, JetBrains_Mono, Lora, Manrope, Montserrat, Outfit, Playfair_Display, Plus_Jakarta_Sans, Poppins, Sora, Space_Grotesk, Syne } from "next/font/google";

/**
 * As famílias do catálogo (config/opcoes.ts > font), servidas pelo próprio site.
 * O next/font exige opções literais, então nenhuma família é pré-carregada aqui:
 * o layout emite <link rel="preload"> só das que o tema usa (título e texto).
 * Senão a Jakarta baixava sempre, mesmo quando o modelo não a usa.
 */
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", variable: "--lb-f-jakarta", preload: false });
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--lb-f-serif",
  preload: false,
});
const grotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--lb-f-grotesk", preload: false });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--lb-f-bricolage",
  preload: false,
});

// Catálogo ampliado (v0.5.0): fontes comuns em sites de marca, para o setup chegar perto da original.
const f_inter = Inter({ subsets: ["latin"], display: "swap", variable: "--lb-f-inter", preload: false });
const f_manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--lb-f-manrope", preload: false });
const f_montserrat = Montserrat({ subsets: ["latin"], display: "swap", variable: "--lb-f-montserrat", preload: false });
const f_poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700", "800"], display: "swap", variable: "--lb-f-poppins", preload: false });
const f_dmsans = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--lb-f-dmsans", preload: false });
const f_outfit = Outfit({ subsets: ["latin"], display: "swap", variable: "--lb-f-outfit", preload: false });
const f_sora = Sora({ subsets: ["latin"], display: "swap", variable: "--lb-f-sora", preload: false });
const f_albert = Albert_Sans({ subsets: ["latin"], display: "swap", variable: "--lb-f-albert", preload: false });
const f_archivo = Archivo({ subsets: ["latin"], display: "swap", variable: "--lb-f-archivo", preload: false });
const f_lora = Lora({ subsets: ["latin"], display: "swap", variable: "--lb-f-lora", preload: false });
const f_playfair = Playfair_Display({ subsets: ["latin"], display: "swap", variable: "--lb-f-playfair", preload: false });
const f_fraunces = Fraunces({ subsets: ["latin"], display: "swap", variable: "--lb-f-fraunces", preload: false });
const f_syne = Syne({ subsets: ["latin"], display: "swap", variable: "--lb-f-syne", preload: false });
const f_mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--lb-f-mono", preload: false });

/** Classes que definem --lb-f-* no <html>, onde lib/theme.ts monta --font e --font-display. */
export const variaveisDeFonte = [jakarta, serif, grotesk, bricolage, f_inter, f_manrope, f_montserrat, f_poppins, f_dmsans, f_outfit, f_sora, f_albert, f_archivo, f_lora, f_playfair, f_fraunces, f_syne, f_mono].map((f) => f.variable).join(" ");
