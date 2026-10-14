import { notFound } from "next/navigation";
import { dadosEstruturados } from "@/lib/seo";

/** JSON-LD de pessoa ou empresa, o mesmo helper da bio. */
export default async function PaginaSeo({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (tipo !== "pessoa" && tipo !== "empresa") notFound();
  const base = new URL("https://casa.exemplo.com");
  const json = dadosEstruturados(
    {
      profile: {
        name: "Casa Verde",
        bio: "Plantas para apartamento.",
        avatar: "/logo.png",
        tipo,
        socials: [{ url: "https://instagram.com/casaverde" }],
      },
      site: { url: base.origin },
    },
    base,
  );
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}
