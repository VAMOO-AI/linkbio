import { NextResponse, type NextRequest } from "next/server";

/**
 * Hora em que a pessoa abriu a bio. O HTML pode estar em cache; este cookie não.
 * O POST do formulário lê o cookie que já veio (não renova aqui, senão o envio pareceria instantâneo).
 */
export function proxy(request: NextRequest) {
  const resposta = NextResponse.next();
  if (request.method === "GET" && request.nextUrl.pathname === "/") {
    resposta.cookies.set("lead_aberto", String(Date.now()), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return resposta;
}

export const config = {
  matcher: ["/"],
};
