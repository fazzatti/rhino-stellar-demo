import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createSda, getHealth, getSdaHistory } from './api.ts';
import type { DemoChain, RoutePhase, SdaToken, SmartDepositAddress } from './types.ts';
import {
  connectMetaMask,
  connectStellarWallet,
  sendOptimismUsdc,
  sendStellarUsdc,
} from './wallets.ts';

type WalletState = {
  evm?: `0x${string}`;
  stellar?: string;
};

type RouteState = {
  record?: SmartDepositAddress;
  amount: string;
  phase: RoutePhase;
  error?: string;
  sourceTx?: string;
  history?: unknown;
};

const INITIAL_ROUTE: RouteState = { amount: '', phase: 'idle' };

function shortAddress(address?: string): string {
  if (!address) return 'Not connected';
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

function usdcToken(record?: SmartDepositAddress): SdaToken | undefined {
  return record?.supportedTokens.find((token) => token.symbol.toUpperCase() === 'USDC');
}

function routeStatusLabel(phase: RoutePhase): string {
  const labels: Record<RoutePhase, string> = {
    idle: 'Not prepared',
    creating: 'Creating deposit address',
    ready: 'Ready to fund',
    signing: 'Waiting for wallet',
    confirming: 'Confirming source transaction',
    settling: 'Waiting for Rhino settlement',
    complete: 'Rhino activity detected',
    error: 'Needs attention',
  };
  return labels[phase];
}

function historyHasEntries(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some((entry) => Array.isArray(entry) && entry.length > 0);
}

function routeExplorer(chain: DemoChain, hash: string): string {
  return chain === 'OPTIMISM'
    ? `https://optimistic.etherscan.io/tx/${hash}`
    : `https://stellar.expert/explorer/public/tx/${hash}`;
}

type RouteCardProps = {
  source: DemoChain;
  state: RouteState;
  sourceAddress?: string;
  destinationAddress?: string;
  onCreate: () => Promise<void>;
  onAmount: (amount: string) => void;
  onSend: () => Promise<void>;
  onRefresh: () => Promise<void>;
};

function RouteCard(props: RouteCardProps) {
  const token = usdcToken(props.state.record);
  const amount = Number(props.state.amount);
  const outsideLimits = token && props.state.amount
    ? amount < token.minDepositLimitUsd || amount > token.maxDepositLimitUsd
    : false;
  const busy = ['creating', 'signing', 'confirming'].includes(props.state.phase);

  return (
    <article className={`route-card route-card--${props.source.toLowerCase()}`}>
      <div className='route-card__header'>
        <div>
          <span className='eyebrow'>{props.source} source</span>
          <h2>{props.source === 'OPTIMISM' ? 'Optimism → Stellar' : 'Stellar → Optimism'}</h2>
        </div>
        <span className={`status status--${props.state.phase}`}>
          <i /> {routeStatusLabel(props.state.phase)}
        </span>
      </div>

      <div className='route-line'>
        <div>
          <span>From</span>
          <strong>{shortAddress(props.sourceAddress)}</strong>
        </div>
        <b aria-hidden='true'>→</b>
        <div>
          <span>To</span>
          <strong>{shortAddress(props.destinationAddress)}</strong>
        </div>
      </div>

      {!props.state.record
        ? (
          <button
            type='button'
            className='button button--secondary'
            disabled={!props.destinationAddress || busy}
            onClick={props.onCreate}
          >
            {props.state.phase === 'creating' ? <Spinner /> : null}
            Create deposit address
          </button>
        )
        : (
          <div className='route-details'>
            <div className='address-block'>
              <span>Rhino deposit address</span>
              <code>{props.state.record.depositAddress}</code>
              {props.state.record.chainMetadata
                ? (
                  <small>
                    Base {shortAddress(props.state.record.chainMetadata.baseAddress)} · muxed ID
                    {' '}
                    {props.state.record.chainMetadata.memoId}
                  </small>
                )
                : null}
            </div>

            {!props.state.record.isActive
              ? <p className='alert alert--error'>Rhino returned an inactive deposit address.</p>
              : null}

            {token
              ? (
                <div className='limit-strip'>
                  <span>
                    Accepted asset <strong>USDC</strong>
                  </span>
                  <span>
                    Minimum <strong>${token.minDepositLimitUsd}</strong>
                  </span>
                  <span>
                    Maximum <strong>${token.maxDepositLimitUsd.toLocaleString()}</strong>
                  </span>
                </div>
              )
              : <p className='alert alert--error'>Rhino did not list USDC for this route.</p>}

            <label className='amount-field'>
              <span>Amount to send</span>
              <div>
                <input
                  inputMode='decimal'
                  min={token?.minDepositLimitUsd}
                  max={token?.maxDepositLimitUsd}
                  placeholder={token ? String(token.minDepositLimitUsd) : '0.00'}
                  value={props.state.amount}
                  onChange={(event) => props.onAmount(event.target.value)}
                />
                <b>USDC</b>
              </div>
              {outsideLimits
                ? (
                  <small className='field-error'>
                    Use an amount inside Rhino’s returned limits.
                  </small>
                )
                : null}
            </label>

            <div className='route-actions'>
              <button
                type='button'
                className='button button--primary'
                disabled={!props.state.record.isActive || !token || !props.sourceAddress ||
                  !props.state.amount || outsideLimits || busy}
                onClick={props.onSend}
              >
                {busy ? <Spinner /> : null}
                Send from {props.source === 'OPTIMISM' ? 'MetaMask' : 'Stellar wallet'}
              </button>
              <button type='button' className='button button--ghost' onClick={props.onRefresh}>
                Refresh status
              </button>
            </div>
          </div>
        )}

      {props.state.sourceTx
        ? (
          <a
            className='transaction-link'
            href={routeExplorer(props.source, props.state.sourceTx)}
            target='_blank'
            rel='noreferrer'
          >
            Source transaction ↗
          </a>
        )
        : null}
      {props.state.error ? <p className='alert alert--error'>{props.state.error}</p> : null}
      {props.state.history
        ? (
          <details className='history'>
            <summary>Latest Rhino history response</summary>
            <pre>{JSON.stringify(props.state.history, null, 2)}</pre>
          </details>
        )
        : null}
    </article>
  );
}

function Spinner() {
  return <span className='spinner' aria-hidden='true' />;
}

export default function App() {
  const [wallets, setWallets] = useState<WalletState>({});
  const [inbound, setInbound] = useState<RouteState>(INITIAL_ROUTE);
  const [outbound, setOutbound] = useState<RouteState>(INITIAL_ROUTE);
  const [serverReady, setServerReady] = useState<boolean>();
  const [walletError, setWalletError] = useState<string>();

  useEffect(() => {
    getHealth().then((health) => setServerReady(health.configured)).catch(() =>
      setServerReady(false)
    );
  }, []);

  const bothConnected = Boolean(wallets.evm && wallets.stellar);

  const connectEvm = useCallback(async () => {
    try {
      setWalletError(undefined);
      const evm = await connectMetaMask();
      setWallets((current) => ({ ...current, evm }));
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : 'Could not connect MetaMask.');
    }
  }, []);

  const connectStellar = useCallback(async () => {
    try {
      setWalletError(undefined);
      const stellar = await connectStellarWallet();
      setWallets((current) => ({ ...current, stellar }));
    } catch (error) {
      setWalletError(
        error instanceof Error ? error.message : 'Could not connect the Stellar wallet.',
      );
    }
  }, []);

  const prepareInbound = useCallback(async () => {
    if (!wallets.evm || !wallets.stellar) return;
    setInbound((current) => ({ ...current, phase: 'creating', error: undefined }));
    try {
      const record = await createSda('OPTIMISM', 'STELLAR', wallets.evm, wallets.stellar);
      const token = usdcToken(record);
      setInbound({
        record,
        amount: token ? String(token.minDepositLimitUsd) : '',
        phase: 'ready',
      });
    } catch (error) {
      setInbound((current) => ({
        ...current,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Could not create route.',
      }));
    }
  }, [wallets.evm, wallets.stellar]);

  const prepareOutbound = useCallback(async () => {
    if (!wallets.evm || !wallets.stellar) return;
    setOutbound((current) => ({ ...current, phase: 'creating', error: undefined }));
    try {
      const record = await createSda('STELLAR', 'OPTIMISM', wallets.stellar, wallets.evm);
      const token = usdcToken(record);
      setOutbound({
        record,
        amount: token ? String(token.minDepositLimitUsd) : '',
        phase: 'ready',
      });
    } catch (error) {
      setOutbound((current) => ({
        ...current,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Could not create route.',
      }));
    }
  }, [wallets.evm, wallets.stellar]);

  const prepareBoth = useCallback(async () => {
    await Promise.all([prepareInbound(), prepareOutbound()]);
  }, [prepareInbound, prepareOutbound]);

  const refreshRoute = useCallback(async (
    state: RouteState,
    update: Dispatch<SetStateAction<RouteState>>,
  ) => {
    if (!state.record) return;
    try {
      const history = await getSdaHistory(state.record);
      update((current) => ({
        ...current,
        history,
        phase: historyHasEntries(history)
          ? 'complete'
          : current.sourceTx
          ? 'settling'
          : current.phase,
        error: undefined,
      }));
    } catch (error) {
      update((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Could not refresh route.',
      }));
    }
  }, []);

  const sendInbound = useCallback(async () => {
    const token = usdcToken(inbound.record);
    if (!wallets.evm || !inbound.record || !token) return;
    setInbound((current) => ({ ...current, phase: 'signing', error: undefined }));
    try {
      const sourceTx = await sendOptimismUsdc(wallets.evm, inbound.record, token, inbound.amount);
      setInbound((current) => ({ ...current, sourceTx, phase: 'settling' }));
    } catch (error) {
      setInbound((current) => ({
        ...current,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Optimism transfer failed.',
      }));
    }
  }, [inbound, wallets.evm]);

  const sendOutbound = useCallback(async () => {
    const token = usdcToken(outbound.record);
    if (!wallets.stellar || !outbound.record || !token) return;
    setOutbound((current) => ({ ...current, phase: 'signing', error: undefined }));
    try {
      const sourceTx = await sendStellarUsdc(
        wallets.stellar,
        outbound.record,
        token,
        outbound.amount,
      );
      setOutbound((current) => ({ ...current, sourceTx, phase: 'settling' }));
    } catch (error) {
      setOutbound((current) => ({
        ...current,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Stellar transfer failed.',
      }));
    }
  }, [outbound, wallets.stellar]);

  useEffect(() => {
    const active = [inbound, outbound].some((route) => route.phase === 'settling');
    if (!active) return;
    const timer = globalThis.setInterval(() => {
      if (inbound.phase === 'settling') void refreshRoute(inbound, setInbound);
      if (outbound.phase === 'settling') void refreshRoute(outbound, setOutbound);
    }, 10_000);
    return () => globalThis.clearInterval(timer);
  }, [inbound, outbound, refreshRoute]);

  const readiness = useMemo(() => {
    if (serverReady === false) return 'Add RHINO_API_KEY to the server .env file.';
    if (!bothConnected) return 'Connect both wallets to prepare the two directions.';
    return 'Wallets and server are ready.';
  }, [bothConnected, serverReady]);

  return (
    <main>
      <header className='masthead'>
        <div className='brand-mark' aria-hidden='true'>
          <span>R</span>
          <i />
        </div>
        <div>
          <span className='eyebrow'>Mainnet settlement test</span>
          <h1>Rhino × Stellar route desk</h1>
          <p>
            Generate, fund, and observe USDC deposit corridors without exposing the Rhino project
            key.
          </p>
        </div>
        <div className='network-chip'>
          <i /> Production networks
        </div>
      </header>

      <section className='warning-band'>
        <strong>Real funds</strong>
        <span>{readiness}</span>
        <span>Use the returned minimum. A $1 transfer may not be processed.</span>
      </section>

      <section className='wallet-dock' aria-label='Connected wallets'>
        <div className='wallet-item wallet-item--optimism'>
          <div>
            <span>Optimism</span>
            <strong>{shortAddress(wallets.evm)}</strong>
          </div>
          <button type='button' onClick={connectEvm}>
            {wallets.evm ? 'Reconnect MetaMask' : 'Connect MetaMask'}
          </button>
        </div>
        <div className='corridor-switch'>
          <span>OPT</span>
          <b>↔</b>
          <span>XLM</span>
          <button
            type='button'
            disabled={!bothConnected || serverReady !== true}
            onClick={prepareBoth}
          >
            Prepare both routes
          </button>
        </div>
        <div className='wallet-item wallet-item--stellar'>
          <div>
            <span>Stellar</span>
            <strong>{shortAddress(wallets.stellar)}</strong>
          </div>
          <button type='button' onClick={connectStellar}>
            {wallets.stellar ? 'Change Stellar wallet' : 'Connect Stellar wallet'}
          </button>
        </div>
      </section>

      {walletError ? <p className='alert alert--error alert--global'>{walletError}</p> : null}

      <section className='routes'>
        <RouteCard
          source='OPTIMISM'
          state={inbound}
          sourceAddress={wallets.evm}
          destinationAddress={wallets.stellar}
          onCreate={prepareInbound}
          onAmount={(amount) => setInbound((current) => ({ ...current, amount }))}
          onSend={sendInbound}
          onRefresh={() => refreshRoute(inbound, setInbound)}
        />
        <RouteCard
          source='STELLAR'
          state={outbound}
          sourceAddress={wallets.stellar}
          destinationAddress={wallets.evm}
          onCreate={prepareOutbound}
          onAmount={(amount) => setOutbound((current) => ({ ...current, amount }))}
          onSend={sendOutbound}
          onRefresh={() => refreshRoute(outbound, setOutbound)}
        />
      </section>

      <footer>
        <span>Rhino Smart Deposit Addresses</span>
        <span>MetaMask + Stellar Wallets Kit</span>
        <span>USDC only</span>
      </footer>
    </main>
  );
}
