import { redirect } from "next/navigation";
import { faltaParaOAdmin, obterSessao } from "@/lib/admin/sessao";
import { FormEntrar } from "./form";

export const dynamic = "force-dynamic";

export default async function Login() {
  const falta = faltaParaOAdmin();
  if (!falta.length && (await obterSessao())) redirect("/admin");
  return (
    <main className="adm-login">
      <h1>Painel da bio</h1>
      {falta.length ? (
        <p className="adm-aviso adm-aviso-erro">
          O painel ainda não está ligado. Falta configurar: {falta.join(" e ")}. Veja o README, seção &quot;Painel /admin&quot;.
        </p>
      ) : (
        <>
          <p className="adm-login-sub">
            Receba um código no seu e-mail para editar a bio. Se você já tem senha, ela continua valendo. As mudanças só vão para o ar quando você tocar em Publicar.
          </p>
          <FormEntrar />
        </>
      )}
    </main>
  );
}
