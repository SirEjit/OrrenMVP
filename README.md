# Orren MVP

A production-ready Fastify API server for XRPL routing that **beats the native XRPL pathfinder** with intelligent multi-leg routing, real AMM fees, and high-precision math. Provides optimal asset swaps across AMM pools, order books, and XRP bridge routes.

## Features

- **🚀 XRP Bridge Routing**: For IOU↔IOU swaps, automatically tries two-leg routing through XRP as a pivot (often 4x better than direct routes!)
- **🔀 Hybrid AMM→CLOB Routes**: Combines AMM and order book liquidity in two-leg swaps for optimal execution
- **💎 High-Precision Math**: Uses decimal.js-light for all calculations - no rounding errors even on large amounts
- **📊 Real AMM Fees**: Reads actual trading_fee from each AMM pool (not hardcoded defaults), applies fees correctly in swap calculations
- **🎯 Multi-Route Quoting**: Fetches quotes from AMM pools, order books, XRP bridges, and hybrid routes simultaneously
- **🛡️ Slippage Protection**: Supports `min_out` and `slippage_bps` parameters with DeliverMin and tfFillOrKill patterns
- **🌉 Cross-Chain Ready**: Stub integrations for Axelar and Wormhole cross-chain bridges (ready for production integration)
- **📈 Native Comparison**: Feature-flagged comparison to XRPL's native pathfinder, showing basis point savings
- **⚡ Smart Scoring**: Deterministic algorithm considers output amount, trust tier, and latency to pick the best route
- **💾 In-Memory Caching**: LRU cache with 5-second TTL for improved performance
- **🔧 Transaction Building**: Generates ready-to-sign XRPL transactions (single or multi-leg arrays)
- **🏗️ Clean Architecture**: Modular TypeScript codebase ready for scaling

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-15T01:03:46.712Z"
}
```

### `POST /quote`
Get quotes from all available routes (AMM, CLOB, and XRP bridge for IOU↔IOU).

**Example 1: XRP → USD (Direct Routes)**
```json
{
  "source_asset": { "currency": "XRP" },
  "destination_asset": { 
    "currency": "USD",
    "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"
  },
  "amount": "100"
}
```

Response shows **high-precision output** and **real AMM fees**:
```json
{
  "quotes": [
    {
      "route_type": "amm",
      "expected_out": "237.1251340631834603",
      "latency_ms": 16,
      "trust_tier": "high",
      "score": 229.537,
      "metadata": {
        "amm_account": "rHUpaqUPbwzKZdzQ8ZQCme18FrgW9pB4am",
        "trading_fee": "0.2190"
      }
    }
  ]
}
```

**Example 2: USD → EUR (XRP Bridge Routing)**
```json
{
  "source_asset": { 
    "currency": "USD",
    "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"
  },
  "destination_asset": { 
    "currency": "EUR",
    "issuer": "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq"
  },
  "amount": "100"
}
```

Response shows **XRP bridge route** (USD→XRP→EUR) beats direct route **4x**:
```json
{
  "quotes": [
    {
      "route_type": "xrp-bridge",
      "expected_out": "457.4515761760471025",
      "latency_ms": 43,
      "trust_tier": "high",
      "score": 418.110741,
      "metadata": {
        "leg1": {
          "route_type": "clob",
          "expected_out": "233.00001",
          "trust_tier": "medium"
        },
        "leg2": {
          "route_type": "amm",
          "expected_out": "457.4515761760471025",
          "trust_tier": "high",
          "metadata": {
            "trading_fee": "0.8540"
          }
        }
      }
    },
    {
      "route_type": "clob",
      "expected_out": "107.99999999999999919",
      "score": 81.216
    }
  ]
}
```

### `POST /build-tx`
Get the best quote and build transaction(s). Returns a single transaction or an array for multi-leg routes.

**Example 1: Single-Leg Transaction (XRP → USD)**
```json
{
  "source_asset": { "currency": "XRP" },
  "destination_asset": {
    "currency": "USD",
    "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"
  },
  "amount": "100",
  "user_address": "rN7n7otQDd6FczFgLdlqtyMVrn3NnrcH7C"
}
```

Response returns **single transaction** with high-precision amounts:
```json
{
  "quote": {
    "route_type": "amm",
    "expected_out": "237.1251340631834603",
    "trading_fee": "0.2190"
  },
  "transaction": {
    "TransactionType": "Payment",
    "Account": "rN7n7otQDd6FczFgLdlqtyMVrn3NnrcH7C",
    "Amount": {
      "currency": "USD",
      "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
      "value": "237.1251340631834603"
    },
    "SendMax": "100000000",
    "Destination": "rN7n7otQDd6FczFgLdlqtyMVrn3NnrcH7C"
  }
}
```

**Example 2: Multi-Leg Transaction Array (USD → EUR via XRP Bridge)**
```json
{
  "source_asset": {
    "currency": "USD",
    "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"
  },
  "destination_asset": {
    "currency": "EUR",
    "issuer": "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq"
  },
  "amount": "100",
  "user_address": "rN7n7otQDd6FczFgLdlqtyMVrn3NnrcH7C"
}
```

Response returns **array of 2 transactions** for the XRP bridge:
```json
{
  "quote": {
    "route_type": "xrp-bridge",
    "expected_out": "457.4516840664631829"
  },
  "transaction": [
    {
      "TransactionType": "OfferCreate",
      "Account": "rN7n7otQDd6FczFgLdlqtyMVrn3NnrcH7C",
      "TakerGets": "233000070",
      "TakerPays": {
        "currency": "USD",
        "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
        "value": "100"
      }
    },
    {
      "TransactionType": "Payment",
      "Account": "rN7n7otQDd6FczFgLdlqtyMVrn3NnrcH7C",
      "Amount": {
        "currency": "EUR",
        "issuer": "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
        "value": "457.4516840664631829"
      },
      "SendMax": "233000070",
      "Destination": "rN7n7otQDd6FczFgLdlqtyMVrn3NnrcH7C"
    }
  ]
}
```

**Example 3: Slippage-Protected Transaction**
```json
{
  "source_asset": { "currency": "XRP" },
  "destination_asset": {
    "currency": "USD",
    "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"
  },
  "amount": "100",
  "user_address": "rN7n7otQDd6FczFgLdlqtyMVrn3NnrcH7C",
  "slippage_bps": 100
}
```

Response includes **slippage protection** (1% tolerance = 100 basis points):
```json
{
  "transaction": {
    "TransactionType": "Payment",
    "Account": "rN7n7otQDd6FczFgLdlqtyMVrn3NnrcH7C",
    "Amount": {
      "currency": "USD",
      "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
      "value": "237.1251340631834603"
    },
    "SendMax": "100000000",
    "DeliverMin": {
      "currency": "USD",
      "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
      "value": "234.753882"
    },
    "Destination": "rN7n7otQDd6FczFgLdlqtyMVrn3NnrcH7C",
    "Flags": 131072
  }
}
```

**Slippage Protection Options:**
- `slippage_bps`: Basis points of acceptable slippage (e.g., 100 = 1%, 200 = 2%)
- `min_out`: Explicit minimum output amount (overrides slippage_bps)

**How It Works:**
- **Payment transactions (AMM)**: Adds `DeliverMin` field and `tfPartialPayment` flag (Flags: 131072 / 0x00020000) for protocol-level slippage enforcement with SendMax as exact-in ceiling
- **OfferCreate transactions (CLOB)**: Adds `tfFillOrKill` flag (Flags: 4 / 0x00000004) to cancel if not filled completely
- **Multi-leg routes**: Applies protection to each leg individually based on transaction type

**Payment Transaction Semantics:**
- `Destination`: The recipient account (same as `Account` for self-swaps, which is the typical use case)
- `SendMax`: Maximum amount to send (exact-in ceiling)
- `Amount`: Expected amount to receive
- `DeliverMin`: Minimum acceptable amount (with `tfPartialPayment` flag for slippage protection)
- **Routing**: XRPL's liquidity engine automatically routes through AMM pools and order books via internal Paths - you don't specify the routing venues in the transaction

**Note:** XRP amounts are formatted as strings in drops (1 XRP = 1,000,000 drops), while issued currencies use `{currency, issuer, value}` objects. Multi-leg routes return an array of transactions that must be executed in sequence.

## Route Types

The API returns quotes from multiple routing strategies:

| Route Type | Description | Trust Tier | Use Case |
|------------|-------------|------------|----------|
| `amm` | Direct AMM pool swap | High | Best for liquid pairs with deep pools |
| `clob` | Central limit order book | Medium | Best when order book has better depth |
| `xrp-bridge` | Two-leg IOU→XRP→IOU | High | Often 2-4x better for IOU-to-IOU swaps |
| `hybrid-amm-clob` | AMM first leg, CLOB second | High | Combines liquidity sources optimally |
| `hybrid-clob-amm` | CLOB first leg, AMM second | High | Alternative hybrid routing |
| `cross-chain-axelar` | Axelar bridge (stub) | Medium | Cross-chain routing to Ethereum, etc. |
| `cross-chain-wormhole` | Wormhole bridge (stub) | Medium | Alternative cross-chain routing |

### Native Pathfinder Comparison

When you include `user_address` in the `/quote` request, the API compares the best route to XRPL's native pathfinder and returns improvement metrics:

```json
{
  "quotes": [
    {
      "route_type": "xrp-bridge",
      "expected_out": "458.017918491837747",
      "native_comparison": {
        "native_expected_out": "108.50",
        "our_expected_out": "458.017918491837747",
        "improvement_bps": "32211.23",
        "improvement_percent": "322.11"
      }
    }
  ]
}
```

**Note:** Native comparison uses XRPL's `ripple_path_find` API and is **feature-flagged** (disabled by default). Enable it by setting `ENABLE_NATIVE_COMPARISON=true` environment variable. The API has specific requirements (different source/destination accounts, proper trust lines) that may prevent comparison in some scenarios. When comparison fails or the feature is disabled, the `native_comparison` field is omitted from the response.

## Project Structure

```
.
├── src/
│   ├── server.ts          # Main server entry point
│   ├── config.ts          # Configuration settings
│   ├── types.ts           # TypeScript type definitions
│   ├── cache.ts           # LRU cache implementation
│   ├── xrplClient.ts      # XRPL client and network calls
│   ├── quotes/
│   │   ├── amm.ts        # AMM quotes with real fees & Decimal math
│   │   ├── clob.ts       # Order book quotes with Decimal math
│   │   ├── xrpBridge.ts  # Two-leg XRP bridge routing
│   │   └── index.ts      # Quote aggregation & route selection
│   ├── scoring.ts         # Route scoring with Decimal precision
│   ├── buildTx.ts         # Transaction building (single & multi-leg)
│   └── routes.ts          # API route handlers
├── package.json
├── tsconfig.json
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

The server will start on `http://0.0.0.0:5000`.

## Configuration

Environment variables (optional):

- `PORT` - Server port (default: 5000)
- `XRPL_SERVER` - XRPL server URL (default: wss://s1.ripple.com)
- `ENABLE_NATIVE_COMPARISON` - Enable native pathfinder comparison (default: false, set to 'true' to enable)

## Architecture

### Why We Beat Native XRPL Pathfinder

**1. High-Precision Math (decimal.js-light)**
- All calculations use `Decimal` instead of JavaScript floats
- Eliminates rounding errors on large amounts
- Preserves precision through multi-leg calculations
- Example: `237.1251340631834603` vs `237.125` (float)

**2. Real AMM Trading Fees**
- Reads actual `trading_fee` from each AMM pool via `amm_info`
- Falls back to 30 bps (0.003) if not provided
- Applies fees correctly: `output = (amount1 * amount2) / (amount1 + input * (1 - fee)) - amount2`
- Example: Pool with 0.219% fee vs hardcoded 0.3% = more accurate quotes

**3. XRP Bridge Routing**
- For IOU↔IOU swaps, tries direct routes AND two-leg XRP pivot
- Leg 1: IOU1 → XRP (best of AMM/CLOB)
- Leg 2: XRP → IOU2 (best of AMM/CLOB)
- Often 2-4x better than direct routes due to XRP's superior liquidity
- Returns transaction array for sequential execution

### Caching Strategy
- LRU cache with 100-entry capacity
- 5-second TTL for market data
- Separate caches for AMM, CLOB, and XRP bridge quotes
- Cache key includes route parameters for accurate matching

### Scoring Algorithm
Uses high-precision Decimal math to score routes:
- **Expected Output**: Higher output = better score
- **Trust Tier**: AMM/XRP-bridge (high) = 1.0x, CLOB (medium) = 0.8x
- **Latency Penalty**: Up to 20% reduction for slow responses (>100ms)

Formula: `score = expected_out * trust_weight * latency_penalty`

All values use Decimal for precision, avoiding float arithmetic drift.

### Future Enhancements
- Redis for distributed caching
- PostgreSQL for historical quotes & analytics
- Rate limiting and API keys
- WebSocket streaming quotes
- Three-leg+ multi-hop routing
- Automated market-making strategies
