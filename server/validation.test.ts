import { assertEquals, assertThrows } from 'jsr:@std/assert@1.0.19';
import { Keypair } from '@stellar/stellar-sdk';
import { parseCreateSdaRequest } from './validation.ts';

const STELLAR_ADDRESS = Keypair.fromRawEd25519Seed(new Uint8Array(32)).publicKey();
const EVM_ADDRESS = '0x1111111111111111111111111111111111111111';

Deno.test('accepts Optimism to Stellar', () => {
  assertEquals(
    parseCreateSdaRequest({
      depositChain: 'OPTIMISM',
      destinationChain: 'STELLAR',
      sourceAddress: EVM_ADDRESS,
      destinationAddress: STELLAR_ADDRESS,
    }),
    {
      depositChain: 'OPTIMISM',
      destinationChain: 'STELLAR',
      sourceAddress: EVM_ADDRESS,
      destinationAddress: STELLAR_ADDRESS,
    },
  );
});

Deno.test('accepts Stellar to Optimism', () => {
  assertEquals(
    parseCreateSdaRequest({
      depositChain: 'STELLAR',
      destinationChain: 'OPTIMISM',
      sourceAddress: STELLAR_ADDRESS,
      destinationAddress: EVM_ADDRESS,
    }),
    {
      depositChain: 'STELLAR',
      destinationChain: 'OPTIMISM',
      sourceAddress: STELLAR_ADDRESS,
      destinationAddress: EVM_ADDRESS,
    },
  );
});

Deno.test('rejects same-chain routes', () => {
  assertThrows(
    () =>
      parseCreateSdaRequest({
        depositChain: 'STELLAR',
        destinationChain: 'STELLAR',
        sourceAddress: STELLAR_ADDRESS,
        destinationAddress: STELLAR_ADDRESS,
      }),
    Error,
    'different',
  );
});

Deno.test('rejects malformed destination addresses', () => {
  assertThrows(
    () =>
      parseCreateSdaRequest({
        depositChain: 'OPTIMISM',
        destinationChain: 'STELLAR',
        sourceAddress: EVM_ADDRESS,
        destinationAddress: 'not-stellar',
      }),
    Error,
    'valid G address',
  );
});

Deno.test('rejects a source address from the wrong chain', () => {
  assertThrows(
    () =>
      parseCreateSdaRequest({
        depositChain: 'STELLAR',
        destinationChain: 'OPTIMISM',
        sourceAddress: EVM_ADDRESS,
        destinationAddress: EVM_ADDRESS,
      }),
    Error,
    'valid G address',
  );
});
