// Middleware propio de autenticación para server functions.
// Igual al generado, pero con respaldo de credenciales públicas para que el
// registro de alumnos no falle si el hosting no inyecta las variables.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { clavePublicableSupabase, urlSupabase } from "@/lib/supabase-config";

function fetchSupabase(clave: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (
      (clave.startsWith("sb_publishable_") || clave.startsWith("sb_secret_")) &&
      headers.get("Authorization") === `Bearer ${clave}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", clave);
    return fetch(input, { ...init, headers });
  };
}

export const exigirAuthSupabase = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const url = urlSupabase();
    const clave = clavePublicableSupabase();

    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
    }

    const token = authHeader.slice("Bearer ".length);
    if (!token || token.split(".").length !== 3) {
      throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
    }

    const supabase = createClient<Database>(url, clave, {
      global: {
        fetch: fetchSupabase(clave),
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
    }

    return next({
      context: { supabase, userId: data.claims.sub, claims: data.claims },
    });
  },
);
