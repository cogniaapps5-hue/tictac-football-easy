import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { guardarRuntimeBindings } from "@/lib/runtime-env.server";

const handler = createStartHandler(defaultStreamHandler);

export default {
  fetch(request: Request, env: Record<string, unknown>, ctx: unknown) {
    guardarRuntimeBindings(env);
    return handler(request, env, ctx);
  },
};
