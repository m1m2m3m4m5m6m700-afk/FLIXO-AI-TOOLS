type AssetsBinding = {
  fetch(request: Request): Promise<Response>;
};

type Env = {
  ASSETS: AssetsBinding;
  FLIXO_DEPLOYMENT_SHA?: string;
};

const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const VERSIONED_IDENTITY_PATTERN = /^\/__flixo-identity-([a-f0-9]{40})\.txt$/u;
const DIRECTORY_IDENTITY_PATTERN = /^\/__flixo\/identity\/([a-f0-9]{40})\/index\.txt$/u;

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

async function verifyIdentityAsset(
  request: Request,
  env: Env,
  requestedSha: string,
  assetPath: string,
): Promise<Response> {
  const configuredSha = env.FLIXO_DEPLOYMENT_SHA?.trim().toLowerCase();

  if (configuredSha && (!SHA_PATTERN.test(configuredSha) || configuredSha !== requestedSha)) {
    return new Response("Not Found\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const assetResponse = await env.ASSETS.fetch(
    new Request(new URL(assetPath, request.url), request),
  );

  if (!assetResponse.ok) {
    return new Response("Not Found\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const body = (await assetResponse.text()).trim();
  if (body !== requestedSha) {
    return new Response("Not Found\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return identityResponse(requestedSha);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const versionedMatch = url.pathname.match(VERSIONED_IDENTITY_PATTERN);
    if (versionedMatch) {
      return verifyIdentityAsset(
        request,
        env,
        versionedMatch[1],
        "/__flixo-identity-" + versionedMatch[1] + ".txt",
      );
    }

    const directoryMatch = url.pathname.match(DIRECTORY_IDENTITY_PATTERN);
    if (directoryMatch) {
      return verifyIdentityAsset(
        request,
        env,
        directoryMatch[1],
        "/__flixo/identity/" + directoryMatch[1] + "/index.txt",
      );
    }

    if (
      url.pathname.startsWith("/__flixo-identity-")
      || url.pathname.startsWith("/__flixo/identity/")
    ) {
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
