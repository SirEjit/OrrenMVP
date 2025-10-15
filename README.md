# Orren MVP

A production-ready Fastify API server for XRPL routing with AMM (Automated Market Maker) and CLOB (Central Limit Order Book) integration. The server provides real-time quotes and transaction building for optimal asset swaps on the XRP Ledger.

## Features

- **Real-time XRPL Integration**: Connects to the XRP Ledger to fetch live market data
- **Multi-Route Quoting**: Fetches quotes from both AMM pools and order books
- **Smart Routing**: Deterministic scoring algorithm to find the best execution path
- **In-Memory Caching**: LRU cache for improved performance (5-second TTL)
- **Transaction Building**: Generates ready-to-sign XRPL transactions
- **Clean Architecture**: Modular TypeScript codebase ready for scaling

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
Get quotes from all available routes (AMM and CLOB).

**Request Body:**
```json
{
  "source_asset": {
    "currency": "XRP"
  },
  "destination_asset": {
    "currency": "USD",
    "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"
  },
  "amount": "100"
}
```

**Response:**
```json
{
  "quotes": [
    {
      "route_type": "amm",
      "expected_out": "237.608931",
      "latency_ms": 221,
      "trust_tier": "high",
      "score": 132.585783,
      "metadata": {
        "amm_account": "rHUpaqUPbwzKZdzQ8ZQCme18FrgW9pB4am"
      }
    },
    {
      "route_type": "clob",
      "expected_out": "39.386373",
      "latency_ms": 223,
      "trust_tier": "medium",
      "score": 17.456041,
      "metadata": {
        "taker_gets": "200",
        "taker_pays": "507.7898440507801",
        "quality": "0.000002538949220253901"
      }
    }
  ]
}
```

### `POST /build-tx`
Get the best quote and build a transaction.

**Request Body:**
```json
{
  "source_asset": {
    "currency": "XRP"
  },
  "destination_asset": {
    "currency": "USD",
    "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"
  },
  "amount": "100",
  "user_address": "rN7n7otQDd6FczFgLdlqtyMVrn3NnrcH7C"
}
```

**Response:**
```json
{
  "quote": {
    "route_type": "amm",
    "expected_out": "237.608931",
    "latency_ms": 15,
    "trust_tier": "high",
    "score": 230.480663,
    "metadata": {
      "amm_account": "rHUpaqUPbwzKZdzQ8ZQCme18FrgW9pB4am"
    }
  },
  "transaction": {
    "TransactionType": "Payment",
    "Account": "rN7n7otQDd6FczFgLdlqtyMVrn3NnrcH7C",
    "Amount": {
      "currency": "USD",
      "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
      "value": "237.608931"
    },
    "SendMax": "100000000",
    "Destination": "rHUpaqUPbwzKZdzQ8ZQCme18FrgW9pB4am"
  }
}
```

**Note:** XRP amounts are formatted as strings in drops (1 XRP = 1,000,000 drops), while issued currencies use `{currency, issuer, value}` objects.

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
│   │   ├── amm.ts        # AMM quote logic
│   │   ├── clob.ts       # Order book quote logic
│   │   └── index.ts      # Quote aggregation
│   ├── scoring.ts         # Route scoring algorithm
│   ├── buildTx.ts         # Transaction building
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

## Architecture

### Caching Strategy
- LRU cache with 100-entry capacity
- 5-second TTL for market data
- Separate caches for AMM and CLOB quotes

### Scoring Algorithm
The scoring algorithm considers:
- **Expected Output**: Higher output = better score
- **Trust Tier**: AMM (high) = 1.0x, CLOB (medium) = 0.8x
- **Latency**: Penalty increases with response time

Formula: `score = expected_out * trust_weight * latency_penalty`

### Future Enhancements
- Redis for distributed caching
- PostgreSQL for historical data
- Rate limiting and API keys
- WebSocket streaming quotes
- Multi-hop routing
