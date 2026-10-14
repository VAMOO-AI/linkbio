export function TextBlock({
  title,
  body,
  variant = "padrao",
}: {
  title?: string;
  body: string;
  variant?: "padrao" | "rodape";
}) {
  const Tag = variant === "rodape" ? "footer" : "section";
  return (
    <Tag className="bloco-texto" data-variant={variant}>
      {title && <h2>{title}</h2>}
      <p>{body}</p>
    </Tag>
  );
}
