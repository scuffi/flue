import { DynamicWorkerExecutor } from "@cloudflare/codemode";
import { Agent, routeAgentRequest } from "agents";

type Env = {
  ReproAgent: DurableObjectNamespace<ReproAgent>;
  LOADER: WorkerLoader;
};

type Outcome =
  | { status: "returned"; value: unknown }
  | {
      status: "threw";
      name: string;
      message: string;
      rendered: string;
      stack?: string;
    };

export class ReproAgent extends Agent<Env> {}

async function executeAndCapture(
  executor: DynamicWorkerExecutor,
  code: string,
): Promise<Outcome> {
  try {
    return { status: "returned", value: await executor.execute(code, []) };
  } catch (error) {
    return {
      status: "threw",
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      rendered: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
  }
}

async function runRepro(env: Env): Promise<Response> {
  const executor = new DynamicWorkerExecutor({ loader: env.LOADER });
  const nestedPromiseCode =
    'async () => ({ files: [Promise.resolve("a"), Promise.resolve("b")] })';
  const promiseAllControlCode =
    'async () => ({ files: await Promise.all([Promise.resolve("a"), Promise.resolve("b")]) })';

  const nestedPromise = await executeAndCapture(executor, nestedPromiseCode);
  const promiseAllControl = await executeAndCapture(executor, promiseAllControlCode);

  return Response.json(
    {
      versions: {
        "@flue/runtime": "2.0.2",
        "@cloudflare/shell": "0.4.3",
        "@cloudflare/codemode": "0.5.1",
      },
      input: nestedPromiseCode,
      expected:
        'Deep-resolved { result: { files: ["a", "b"] } }, or a corrective execution error about awaiting nested promises.',
      nestedPromise,
      controlInput: promiseAllControlCode,
      promiseAllControl,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/repro") {
      return runRepro(env);
    }
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
