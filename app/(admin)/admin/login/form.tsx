"use client";

import { useActionState } from "react";
import { acaoEntrar, type EstadoLogin } from "../acoes";

export function FormEntrar() {
  const [estado, enviar, enviando] = useActionState<EstadoLogin, FormData>(acaoEntrar, {});
  return (
    <form action={enviar} className="adm-form-login">
      <label>
        E-mail
        <input name="email" type="email" autoComplete="username" required defaultValue={estado.email} key={estado.email} />
      </label>
      <button type="submit" name="modo" value="pedir" className="adm-bt adm-primario" disabled={enviando}>
        Receber código no e-mail
      </button>
      {estado.info && (
        <p className="adm-aviso" role="status">
          {estado.info}
        </p>
      )}
      <label>
        Código
        <input
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            e.currentTarget.form?.querySelector<HTMLButtonElement>('button[value="codigo"]')?.click();
          }}
        />
      </label>
      <button type="submit" name="modo" value="codigo" className="adm-bt adm-primario" disabled={enviando}>
        Confirmar código
      </button>
      {estado.erro && (
        <p className="adm-aviso adm-aviso-erro" role="alert">
          {estado.erro}
        </p>
      )}
      <p className="adm-login-ou">Se você já tem senha</p>
      <label>
        Senha
        <input
          name="senha"
          type="password"
          autoComplete="current-password"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            e.currentTarget.form?.querySelector<HTMLButtonElement>('button[value="senha"]')?.click();
          }}
        />
      </label>
      <button type="submit" name="modo" value="senha" className="adm-bt adm-secundario" disabled={enviando}>
        Entrar
      </button>
    </form>
  );
}
