import type { DemoChain, SmartDepositAddress } from './types.ts';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) {
    throw new Error(body.message ?? `Request failed with ${response.status}.`);
  }
  return body as T;
}

export function getHealth(): Promise<{ configured: boolean; network: string }> {
  return api('/api/health');
}

export async function createSda(
  depositChain: DemoChain,
  destinationChain: DemoChain,
  sourceAddress: string,
  destinationAddress: string,
): Promise<SmartDepositAddress> {
  const records = await api<SmartDepositAddress[]>('/api/sda', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ depositChain, destinationChain, sourceAddress, destinationAddress }),
  });
  const record = records.find((candidate) => candidate.depositChain === depositChain);
  if (!record) throw new Error(`Rhino did not return a ${depositChain} deposit address.`);
  return record;
}

export function getSdaHistory(record: SmartDepositAddress): Promise<unknown> {
  const params = new URLSearchParams({
    depositChain: record.depositChain,
    depositAddress: record.depositAddress,
  });
  return api(`/api/sda/history?${params}`);
}
