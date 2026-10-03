type AssetsBinding = { fetch(request: Request): Promise<Response> };
type Env = { ASSETS: AssetsBinding; FLIXO_DEPLOYMENT_SHA?: string };
const SHA_PATTERN = /^[a-f0-9]{40}$/u;
const VERSIONED_IDENTITY_PATTERN = /^\/__flixo-identity-([a-f0-9]{40})\.txt$/u;
const DIRECTORY_IDENTITY_PATTERN = /^\/__flixo\/identity\/([a-f0-9]{40})\/index\.txt$/u;
const EMBEDDED_DEPLOYMENT_SHA = '__FLIXO_DEPLOYMENT_SHA__';
export function resolveDeploymentIdentity(requestedSha:string, deploymentSha:string):string|null {
  if(!SHA_PATTERN.test(requestedSha) || !SHA_PATTERN.test(deploymentSha) || requestedSha !== deploymentSha) return null;
  return requestedSha;
}
const SECURITY_HEADERS: Record<string, string> = Object.freeze({
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; manifest-src 'self'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()', 'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
});
function secure(response: Response): Response { const headers = new Headers(response.headers); for (const [k,v] of Object.entries(SECURITY_HEADERS)) headers.set(k,v); return new Response(response.body,{status:response.status,statusText:response.statusText,headers}); }
function apiNotFound(): Response { return secure(new Response(JSON.stringify({error:'API_NOT_EXPOSED_ON_STATIC_PRODUCTION_WORKER'})+'\n',{status:404,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, max-age=0'}})); }
function identityResponse(sha:string): Response { return secure(new Response(sha+'\n',{status:200,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store, max-age=0','x-flixo-deployment-sha':sha}})); }
function identity404():Response { return secure(new Response('Not Found\n',{status:404,headers:{'content-type':'text/plain','cache-control':'no-store'}})); }
function verifyIdentity(requestedSha:string,deploymentSha:string):Response {
  const verifiedSha = resolveDeploymentIdentity(requestedSha, deploymentSha);
  return verifiedSha ? identityResponse(verifiedSha) : identity404();
}
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')) return apiNotFound();
  const versioned=url.pathname.match(VERSIONED_IDENTITY_PATTERN);
  if(versioned) return verifyIdentity(versioned[1], EMBEDDED_DEPLOYMENT_SHA);
  const directory=url.pathname.match(DIRECTORY_IDENTITY_PATTERN);
  if(directory) return verifyIdentity(directory[1], EMBEDDED_DEPLOYMENT_SHA);
  if(url.pathname.startsWith('/__flixo-identity-')||url.pathname.startsWith('/__flixo/identity/')) return secure(new Response('Not Found\n',{status:404}));
  return secure(await env.ASSETS.fetch(request));
 },
};