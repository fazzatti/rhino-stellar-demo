export type DemoChain = 'OPTIMISM' | 'STELLAR';

export type SdaToken = {
  symbol: string;
  address: string;
  minDepositLimitUsd: number;
  maxDepositLimitUsd: number;
};

export type StellarChainMetadata = {
  _tag: 'STELLAR';
  baseAddress: string;
  memoId: string;
};

export type SmartDepositAddress = {
  depositChain: DemoChain;
  depositAddress: string;
  destinationChain: DemoChain;
  destinationAddress: string;
  supportedTokens: SdaToken[];
  isActive: boolean;
  isPaused?: boolean;
  tokenOut?: string;
  chainMetadata?: StellarChainMetadata;
};

export type RoutePhase =
  | 'idle'
  | 'creating'
  | 'ready'
  | 'signing'
  | 'confirming'
  | 'settling'
  | 'complete'
  | 'error';
