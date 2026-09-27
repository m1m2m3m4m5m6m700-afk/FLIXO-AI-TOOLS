type AssetsBinding = {
  fetch(request: Request): Promise<Response>;
};

type Env = {
  ASSETS: AssetsBinding;
  FLIXO_DEPLOYMENT_SHA: string;
};

const SHA_PATTERN = /^[a-f0-9]{40}$/u;

function identityResponse(sha: string): Response {
  return new Response(sha + "\n", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-flixo-deployment-sha": sha,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const configuredSha = env.FLIXO_DEPLOYMENT_SHA?.trim().toLowerCase() ?? "";

    if (url.pathname.startsWith("/__flixo-identity-") || url.pathname.startsWith("/__flixo/identity/")) {
      if (!SHA_PATTERN.test(configuredSha)) {
        return new Response("Deployment identity is unavailable.\n", {
          status: 500,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      }

      const versionedAssetPath = "/__flixo-identity-" + configuredSha + ".txt";
      const directoryIdentityPath = "/__flixo/identity/" + configuredSha + "/index.txt";

      if (url.pathname === versionedAssetPath || url.pathname === directoryIdentityPath) {
        return identityResponse(configuredSha);
      }

      return new Response("Not Found\n", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
