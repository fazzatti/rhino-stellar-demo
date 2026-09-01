import { isRhinoConfigured, rhinoRequest } from './rhino.ts';
import { parseCreateSdaRequest, parseSdaLookup } from './validation.ts';

const PORT = Number(Deno.env.get('PORT') ?? '8000');
const DIST_ROOT = new URL('../dist/', import.meta.url);

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

async function apiResponse(request: Request, url: URL): Promise<Response | undefined> {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json({ configured: isRhinoConfigured(), network: 'mainnet' });
  }

  if (request.method === 'POST' && url.pathname === '/api/sda') {
    const route = parseCreateSdaRequest(await request.json());
    const result = await rhinoRequest('/sda/deposit-addresses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        depositChains: [route.depositChain],
        destinationChain: route.destinationChain,
        destinationAddress: route.destinationAddress,
        refundAddress: route.sourceAddress,
        tokenOut: 'USDC',
        reusePolicy: 'create-new',
        addressNote: `rhino-stellar-demo:${route.depositChain.toLowerCase()}`,
      }),
    });
    return json(result);
  }

  if (request.method === 'GET' && url.pathname === '/api/sda/status') {
    const lookup = parseSdaLookup(url);
    return json(
      await rhinoRequest(
        `/sda/deposit-addresses/${
          encodeURIComponent(lookup.depositAddress)
        }/${lookup.depositChain}`,
      ),
    );
  }

  if (request.method === 'GET' && url.pathname === '/api/sda/history') {
    const lookup = parseSdaLookup(url);
    return json(
      await rhinoRequest(
        `/sda/deposit-addresses/${
          encodeURIComponent(lookup.depositAddress)
        }/${lookup.depositChain}/history`,
      ),
    );
  }

  return undefined;
}

function contentType(pathname: string): string {
  if (pathname.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  if (pathname.endsWith('.json')) return 'application/json; charset=utf-8';
  if (pathname.endsWith('.ico')) return 'image/x-icon';
  return 'text/html; charset=utf-8';
}

async function staticResponse(url: URL): Promise<Response> {
  const requestedPath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const fileUrl = new URL(requestedPath, DIST_ROOT);
  if (!fileUrl.pathname.startsWith(DIST_ROOT.pathname)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const data = await Deno.readFile(fileUrl);
    return new Response(data, { headers: { 'content-type': contentType(fileUrl.pathname) } });
  } catch {
    const data = await Deno.readFile(new URL('index.html', DIST_ROOT));
    return new Response(data, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
}

Deno.serve({ hostname: '127.0.0.1', port: PORT }, async (request) => {
  const url = new URL(request.url);

  try {
    const api = await apiResponse(request, url);
    if (api) return api;
    if (url.pathname.startsWith('/api/')) return json({ message: 'Not found.' }, 404);
    return await staticResponse(url);
  } catch (error) {
    return json(
      { message: error instanceof Error ? error.message : 'Unexpected server error.' },
      400,
    );
  }
});
