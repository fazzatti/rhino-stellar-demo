import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';
import { Networks as WalletNetwork } from '@creit.tech/stellar-wallets-kit/types';
import {
  Asset,
  BASE_FEE,
  Horizon,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { createPublicClient, createWalletClient, custom, erc20Abi, parseUnits } from 'viem';
import { optimism } from 'viem/chains';
import type { SdaToken, SmartDepositAddress } from './types.ts';

type EthereumProvider = Parameters<typeof custom>[0];

function ethereumProvider(): EthereumProvider {
  const ethereum = (globalThis as typeof globalThis & { ethereum?: EthereumProvider }).ethereum;
  if (!ethereum) throw new Error('MetaMask was not found in this browser.');
  return ethereum;
}

StellarWalletsKit.init({
  modules: defaultModules(),
  network: WalletNetwork.PUBLIC,
  authModal: { showInstallLabel: true },
});

export async function connectMetaMask(): Promise<`0x${string}`> {
  const client = createWalletClient({ chain: optimism, transport: custom(ethereumProvider()) });
  const [address] = await client.requestAddresses();
  if (!address) throw new Error('MetaMask did not return an account.');
  await ensureOptimism(client);
  return address;
}

async function ensureOptimism(
  client: ReturnType<typeof createWalletClient>,
): Promise<void> {
  const chainId = await client.getChainId();
  if (chainId !== optimism.id) {
    await client.switchChain({ id: optimism.id });
  }
}

export async function connectStellarWallet(): Promise<string> {
  const { address } = await StellarWalletsKit.authModal();
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new Error('This demo currently requires a classic Stellar G account.');
  }
  return address;
}

export async function sendOptimismUsdc(
  sender: `0x${string}`,
  record: SmartDepositAddress,
  token: SdaToken,
  amount: string,
): Promise<string> {
  if (!token.address.startsWith('0x')) throw new Error('Rhino returned an invalid EVM token.');
  if (!record.depositAddress.startsWith('0x')) {
    throw new Error('Rhino returned an invalid Optimism deposit address.');
  }

  const transport = custom(ethereumProvider());
  const walletClient = createWalletClient({ account: sender, chain: optimism, transport });
  const publicClient = createPublicClient({ chain: optimism, transport });
  await ensureOptimism(walletClient);

  const decimals = await publicClient.readContract({
    address: token.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'decimals',
  });
  const hash = await walletClient.writeContract({
    address: token.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [record.depositAddress as `0x${string}`, parseUnits(amount, decimals)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

function parseStellarAsset(token: SdaToken): Asset {
  const separator = token.address.indexOf('-');
  if (separator <= 0) throw new Error('Rhino returned an invalid Stellar asset.');
  const code = token.address.slice(0, separator);
  const issuer = token.address.slice(separator + 1);
  if (!StrKey.isValidEd25519PublicKey(issuer)) {
    throw new Error('Rhino returned an invalid Stellar asset issuer.');
  }
  return new Asset(code, issuer);
}

export async function sendStellarUsdc(
  sender: string,
  record: SmartDepositAddress,
  token: SdaToken,
  amount: string,
): Promise<string> {
  if (!StrKey.isValidEd25519PublicKey(sender)) {
    throw new Error('The Stellar source must be a classic G account.');
  }
  if (!StrKey.isValidMed25519PublicKey(record.depositAddress)) {
    throw new Error('Rhino did not return the expected Stellar muxed deposit address.');
  }

  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const horizonUrl = viteEnv?.VITE_STELLAR_HORIZON_URL ?? 'https://horizon.stellar.org';
  const server = new Horizon.Server(horizonUrl);
  const source = await server.loadAccount(sender);
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(
      Operation.payment({
        destination: record.depositAddress,
        asset: parseStellarAsset(token),
        amount,
      }),
    )
    .setTimeout(180)
    .build();

  const { signedTxXdr } = await StellarWalletsKit.signTransaction(transaction.toXdr(), {
    address: sender,
    networkPassphrase: Networks.PUBLIC,
  });
  const signedTransaction = TransactionBuilder.fromXdr(signedTxXdr, Networks.PUBLIC);
  const result = await server.submitTransaction(signedTransaction);
  return result.hash;
}
