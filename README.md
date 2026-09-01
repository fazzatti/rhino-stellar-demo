# Rhino Stellar Demo

> [!WARNING]
> **Demo application only. Not intended for production use.**
>
> This application can submit transactions using real funds on Mainnet. Use it at your own
> discretion, verify every address and amount before signing, and only use funds you are prepared to
> risk while testing.

Minimal Deno web application for testing Rhino.fi Smart Deposit Address routes between Optimism and
Stellar Mainnet.

The application supports both directions:

- Optimism USDC to Stellar USDC, funded from MetaMask
- Stellar USDC to Optimism USDC, funded through Stellar Wallets Kit

The Rhino secret API key is used only by the Deno server. It is never bundled into the browser
application.

## Prerequisites

- Deno 2.6 or newer
- A Rhino project configured for the Optimism and Stellar routes
- A Rhino secret API key
- MetaMask connected to Optimism Mainnet
- A Stellar Mainnet wallet supported by Stellar Wallets Kit
- USDC and enough native gas on the source network

This demo uses production networks and real funds. Rhino rejects deposits below the minimum or above
the maximum returned for the generated address. Always use the limits shown by the application
rather than assuming a one-dollar transfer will be accepted.

## Setup

```bash
cp .env.example .env
```

Add the Rhino secret API key to `.env`:

```dotenv
RHINO_API_KEY=SECRET_your_key_here
```

Install dependencies and start both the Deno API and Vite frontend:

```bash
deno install
deno task dev
```

Open `http://localhost:5173`.

## Test Flow

1. Connect MetaMask and Stellar Wallets Kit.
2. Select **Prepare both routes**.
3. Review the generated deposit address, supported USDC contract or asset, and the minimum and
   maximum deposit values for each direction.
4. Enter an amount within the returned limits.
5. Fund one route from its source wallet.
6. Keep the page open while the application checks Rhino history for settlement.
7. Use **Refresh status** to query the route manually.

For Stellar-origin deposits, Rhino returns a muxed `M...` deposit address. The demo sends a classic
USDC payment directly to that muxed address. The muxed ID lets Rhino attribute the payment without a
separate transaction memo.

The demo creates a fresh Rhino deposit address for each prepared route so an older deposit cannot be
mistaken for the current test.

Each route also sends its connected source wallet to Rhino as the refund address. This keeps any
route-specific refund tied to the wallet that funded the test.

## Freighter Connection

Freighter may initially block this local frontend because it has not yet been trusted. If the wallet
connection is rejected, open Freighter settings and explicitly allow the application or local site
before reconnecting from the demo.

## Commands

```bash
deno task dev
deno task check
deno task test
deno task build
deno task start
```

## Security Boundary

This is a local integration demo. Do not deploy it publicly without adding authentication and
authorization around the server API. Although the browser never receives the Rhino key, an
unprotected public server could let third parties consume the project API and generate deposit
addresses.
