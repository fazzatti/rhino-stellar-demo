import { StrKey } from '@stellar/stellar-sdk';

export type DemoChain = 'OPTIMISM' | 'STELLAR';

export type CreateSdaRequest = {
  depositChain: DemoChain;
  destinationChain: DemoChain;
  sourceAddress: string;
  destinationAddress: string;
};

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export function parseCreateSdaRequest(value: unknown): CreateSdaRequest {
  if (!value || typeof value !== 'object') {
    throw new Error('Expected a JSON object.');
  }

  const body = value as Record<string, unknown>;
  const depositChain = body.depositChain;
  const destinationChain = body.destinationChain;
  const sourceAddress = body.sourceAddress;
  const destinationAddress = body.destinationAddress;

  if (
    (depositChain !== 'OPTIMISM' && depositChain !== 'STELLAR') ||
    (destinationChain !== 'OPTIMISM' && destinationChain !== 'STELLAR')
  ) {
    throw new Error('Only Optimism and Stellar are supported by this demo.');
  }

  if (depositChain === destinationChain) {
    throw new Error('The source and destination chains must be different.');
  }

  if (typeof sourceAddress !== 'string' || typeof destinationAddress !== 'string') {
    throw new Error('Source and destination addresses are required.');
  }

  if (depositChain === 'STELLAR' && !StrKey.isValidEd25519PublicKey(sourceAddress)) {
    throw new Error('The Stellar source must be a valid G address.');
  }

  if (depositChain === 'OPTIMISM' && !EVM_ADDRESS_PATTERN.test(sourceAddress)) {
    throw new Error('The Optimism source must be a valid 0x address.');
  }

  if (
    destinationChain === 'STELLAR' &&
    !StrKey.isValidEd25519PublicKey(destinationAddress)
  ) {
    throw new Error('The Stellar destination must be a valid G address.');
  }

  if (destinationChain === 'OPTIMISM' && !EVM_ADDRESS_PATTERN.test(destinationAddress)) {
    throw new Error('The Optimism destination must be a valid 0x address.');
  }

  return { depositChain, destinationChain, sourceAddress, destinationAddress };
}

export function parseSdaLookup(url: URL): { depositChain: DemoChain; depositAddress: string } {
  const depositChain = url.searchParams.get('depositChain');
  const depositAddress = url.searchParams.get('depositAddress');

  if (depositChain !== 'OPTIMISM' && depositChain !== 'STELLAR') {
    throw new Error('A supported depositChain is required.');
  }

  if (!depositAddress) {
    throw new Error('A depositAddress is required.');
  }

  return { depositChain, depositAddress };
}
