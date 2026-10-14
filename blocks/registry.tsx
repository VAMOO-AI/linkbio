import type { Block, LinkbioConfig } from "@/config/schema";
import { varianteDoPerfil, type TemaResolvido } from "@/lib/resolver";
import { ProfileBlock } from "./profile";
import { SocialBlock } from "./social";
import { CtaBlock } from "./cta";
import { LinkBlock } from "./link";
import { LinksBlock } from "./links";
import { CardsBlock } from "./cards";
import { TextBlock } from "./text";
import { DividerBlock } from "./divider";
import { YoutubeBlock } from "./youtube";
import { GalleryBlock } from "./gallery";
import { ConciergeModo } from "./concierge-modo";
import { BannerBlock } from "./banner";
import { TestimonialsBlock } from "./testimonials";
import { FaqBlock } from "./faq";
import { ProductsBlock } from "./products";
import { CouponBlock } from "./coupon";
import { LeadBlock } from "./lead";
import { PixBlock } from "./pix";
import { AgendaBlock } from "./agenda";

/**
 * type → componente. Bloco novo entra aqui (skill novo-bloco na F5).
 * Recebe a config e o tema de quem chama (a página publicada ou a prévia do /admin); nenhum bloco lê a config sozinho.
 * `ia` vem de quem chama: a página publicada só liga com a chave; a prévia usa o modo do bloco.
 */
export function renderBlock(
  block: Block,
  index: number,
  config: LinkbioConfig,
  tema: TemaResolvido,
  chave: string | null = null,
  opcoes?: { captura?: boolean; abertoEm?: number; ia?: boolean; teste?: boolean },
) {
  const key = `${block.type}-${index}`;
  switch (block.type) {
    case "profile":
      return <ProfileBlock key={key} {...varianteDoPerfil(block, tema)} cover={block.cover} profile={config.profile} chave={chave} />;
    case "social":
      return <SocialBlock key={key} items={block.items} chave={chave} />;
    case "cta":
      return (
        <CtaBlock
          key={block.id ?? key}
          label={block.label}
          action={block.action}
          variant={block.variant}
          note={block.note}
          pulse={block.pulse}
          whatsapp={config.contact.whatsapp}
          chave={chave}
        />
      );
    case "link":
      return (
        <LinkBlock
          key={block.id ?? key}
          title={block.title}
          url={block.url}
          icon={block.icon}
          subtitle={block.subtitle}
          image={block.image}
          chave={chave}
        />
      );
    case "links":
      return (
        <LinksBlock
          key={block.id ?? key}
          title={block.title}
          layout={block.layout ?? tema.blocos.links.layout}
          items={block.items}
          chave={chave}
        />
      );
    case "cards":
      return (
        <CardsBlock
          key={block.id ?? key}
          eyebrow={block.eyebrow}
          items={block.items}
          layout={block.layout ?? tema.blocos.cards.layout}
          offers={config.offers}
          whatsapp={config.contact.whatsapp}
          chave={chave}
        />
      );
    case "text":
      return <TextBlock key={block.id ?? key} title={block.title} body={block.body} variant={block.variant} />;
    case "divider":
      return <DividerBlock key={key} />;
    case "youtube":
      return <YoutubeBlock key={block.id ?? key} title={block.title} videoId={block.videoId} poster={block.poster} />;
    case "gallery":
      return <GalleryBlock key={block.id ?? key} title={block.title} images={block.images} />;
    case "concierge": {
      // Sem `ia` explícito (a prévia), o modo do bloco decide. A página publicada manda false sem a chave.
      const ia = opcoes?.ia ?? block.mode === "ia";
      return (
        <ConciergeModo
          key={block.id ?? key}
          ia={ia}
          teste={opcoes?.teste ?? false}
          title={block.title}
          intro={block.intro}
          variant={block.variant ?? tema.blocos.concierge.variant}
          collapsed={block.collapsed ?? false}
          decide={block.decide ?? ("primeira" as const)}
          flow={block.flow}
          offers={
            ia
              ? config.offers
              : config.offers.filter((o) => block.flow.some((p) => p.options.some((op) => op.offer === o.id)))
          }
          whatsapp={config.contact.whatsapp}
          chave={chave}
        />
      );
    }
    case "banner":
      return (
        <BannerBlock
          key={block.id ?? key}
          title={block.title}
          text={block.text}
          label={block.label}
          action={block.action}
          whatsapp={config.contact.whatsapp}
          chave={chave}
        />
      );
    case "testimonials":
      return <TestimonialsBlock key={block.id ?? key} title={block.title} items={block.items} />;
    case "faq":
      return <FaqBlock key={block.id ?? key} title={block.title} openFirst={block.openFirst} items={block.items} />;
    case "coupon":
      return (
        <CouponBlock
          key={block.id ?? key}
          id={block.id ?? `cupom_${index}`}
          copy={block.copy}
          whatsapp={config.contact.whatsapp}
          code={block.code}
          label={block.label}
          expires={block.expires}
          cta={block.cta}
          action={block.action}
          chave={chave}
        />
      );
    case "products":
      return (
        <ProductsBlock
          key={block.id ?? key}
          id={block.id ?? `produtos_${index}`}
          title={block.title}
          layout={block.layout ?? tema.blocos.products.layout}
          filter={block.filter ?? false}
          items={block.items}
          catalog={config.catalog}
          chave={chave}
        />
      );
    case "lead":
      return (
        <LeadBlock
          key={block.id ?? key}
          id={block.id ?? `lead-${index}`}
          title={block.title}
          text={block.text}
          label={block.label}
          pedir={block.pedir}
          consentimento={block.consentimento}
          whatsapp={config.contact.whatsapp}
          captura={opcoes?.captura !== false}
          abertoEm={opcoes?.abertoEm ?? Date.now()}
        />
      );
    case "pix":
      return (
        <PixBlock
          key={block.id ?? key}
          id={block.id ?? `pix_${index}`}
          chave={block.chave}
          nome={block.nome}
          cidade={block.cidade}
          valor_cents={block.valor_cents}
          txid={block.txid}
          copy={block.copy}
        />
      );
    case "agenda":
      return (
        <AgendaBlock
          key={block.id ?? key}
          title={block.title}
          url={block.url}
          items={block.items}
          tz={config.site.tz}
        />
      );
  }
}
