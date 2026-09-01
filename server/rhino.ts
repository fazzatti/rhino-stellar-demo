type CachedToken = {
  value: string;
  expiresAt: number;
};

let cachedToken: CachedToken | undefined;

function getApiBaseUrl(): string {
  return (Deno.env.get('RHINO_API_BASE_URL') ?? 'https://api.rhino.fi').replace(/\/$/, '');
}

function decodeJwtExpiration(jwt: string): number {
  try {
    const encodedPayload = jwt.split('.')[1];
    if (!encodedPayload) return Date.now() + 50 * 60 * 1000;
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized)) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : Date.now() + 50 * 60 * 1000;
  } catch {
    return Date.now() + 50 * 60 * 1000;
  }
}

async function authenticate(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const apiKey = Deno.env.get('RHINO_API_KEY');
  if (!apiKey) {
    throw new Error('RHINO_API_KEY is not configured on the server.');
  }

  const response = await fetch(`${getApiBaseUrl()}/authentication/auth/apiKey`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });

  const body = await response.json().catch(() => ({})) as { jwt?: string; message?: string };
  if (!response.ok || !body.jwt) {
    throw new Error(body.message ?? `Rhino authentication failed with ${response.status}.`);
  }

  cachedToken = {
    value: body.jwt,
    expiresAt: decodeJwtExpiration(body.jwt),
  };

  return body.jwt;
}

export async function rhinoRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  let jwt = await authenticate();

  const execute = () =>
    fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        authorization: `Bearer ${jwt}`,
      },
    });

  let response = await execute();
  if (response.status === 401) {
    jwt = await authenticate(true);
    response = await execute();
  }

  const body = await response.json().catch(() => ({
    message: 'Rhino returned a non-JSON response.',
  }));
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? String(body.message)
      : `Rhino request failed with ${response.status}.`;
    throw new Error(message);
  }

  return body;
}

export function isRhinoConfigured(): boolean {
  return Boolean(Deno.env.get('RHINO_API_KEY'));
}
