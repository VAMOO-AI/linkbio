import Image from "next/image";

export function GalleryBlock({
  title,
  images,
}: {
  title?: string;
  images: { src: string; alt: string }[];
}) {
  return (
    <section className="bloco-galeria" aria-label={title ?? "Galeria"}>
      {title && <h2 className="galeria-titulo">{title}</h2>}
      <div className="galeria-lista">
        {images.map((img) => (
          <figure key={img.src}>
            <Image src={img.src} alt={img.alt} width={400} height={300} loading="lazy" />
            <figcaption className="sr-only">{img.alt}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
