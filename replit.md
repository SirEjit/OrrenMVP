# Orren MVP - XRPL Routing API

## Overview

Orren MVP is a production-ready Fastify-based API server that provides intelligent routing for XRP Ledger (XRPL) transactions. The system fetches real-time quotes from multiple liquidity sources (AMM pools and Central Limit Order Books), scores them using a deterministic algorithm, and builds ready-to-sign transactions for optimal trade execution.

The application serves as a routing aggregator that helps users find the best exchange rates across different XRPL trading mechanisms by comparing prices, trust levels, and execution speed.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### October 15, 2025 - Complete Scaffold Implementation
- **Created full project structure** with TypeScript + Fastify + XRPL integration
- **Implemented core modules**: config, types, cache, xrplClient, quotes (AMM/CLOB), scoring, buildTx, routes, server
- **Fixed critical XRP handling bug**: buildTransaction now correctly formats XRP amounts as drop strings instead of invalid currency objects
- **Deployed and tested**: All endpoints (/health, /quote, /build-tx) working with live XRPL mainnet data
- **Dependencies installed**: fastify, @fastify/cors, xrpl, tsx, typescript
- **Workflow configured**: Server running on port 5000 with npm start command

## System Architecture

### Backend Architecture

**Framework**: Fastify (Node.js)
- **Rationale**: Fastify provides high performance, built-in TypeScript support, and a robust plugin ecosystem
- **Key Features**: Schema validation, logging, and graceful shutdown handling
- **Pros**: Fast, lightweight, excellent TypeScript integration
- **Cons**: Smaller ecosystem compared to Express

**Language**: TypeScript with ES2022 modules
- **Rationale**: Type safety for financial calculations and API contracts
- **Configuration**: Strict mode enabled, ES modules for modern JavaScript features

### Data Flow & Caching

**LRU Cache Implementation** (`src/cache.ts`)
- **Problem**: Reduce latency for repeated quote requests
- **Solution**: Custom in-memory LRU cache with 5-second TTL
- **Configuration**: 100 item max size, automatic eviction of stale entries
- **Rationale**: Balance between freshness and performance for financial data

**Quote Aggregation** (`src/quotes/index.ts`)
- **Problem**: Fetch quotes from multiple sources efficiently
- **Solution**: Parallel promise execution for AMM and CLOB quotes
- **Scoring**: Deterministic algorithm considering output amount, trust tier, and latency

### Routing & Scoring Algorithm

**Multi-Source Quote System**
- **AMM Quotes** (`src/quotes/amm.ts`): Constant product formula (x*y=k) for automated market makers
- **CLOB Quotes** (`src/quotes/clob.ts`): Order book depth analysis for central limit order books
- **Trust Tiers**: High (AMM), Medium (CLOB), Low (future expansion)

**Scoring Algorithm** (`src/scoring.ts`)
- **Factors**: Expected output amount × trust weight × latency penalty
- **Trust Weights**: High=1.0, Medium=0.8, Low=0.5
- **Latency Penalty**: Max 20% reduction for queries over 100ms
- **Purpose**: Deterministic, reproducible route selection

### Transaction Building

**Transaction Blueprint System** (`src/buildTx.ts`)
- **Problem**: Generate XRPL-compliant transaction objects
- **Solution**: Type-safe transaction builders with currency normalization
- **XRP Handling**: Converts to drops (1 XRP = 1,000,000 drops)
- **Issued Currencies**: Maintains issuer information for trust lines

### API Design

**REST Endpoints** (`src/routes.ts`)
1. `GET /health` - Service health check
2. `POST /quote` - Fetch all available quotes with scores
3. `POST /build-tx` - Generate ready-to-sign transaction for best route

**Request/Response Models** (`src/types.ts`)
- Strongly typed request/response interfaces
- Support for both XRP and issued currencies
- Metadata preservation for route debugging

### Configuration Management

**Environment-Based Config** (`src/config.ts`)
- Server host/port configuration
- XRPL network endpoint (defaults to mainnet)
- Cache parameters (size, TTL)
- **Rationale**: Externalized configuration for different deployment environments

## External Dependencies

### XRPL Integration

**xrpl Library** (v3.1.0)
- **Purpose**: Official XRP Ledger JavaScript library
- **Usage**: 
  - WebSocket client for real-time ledger connection
  - AMM info requests (`amm_info` command)
  - Order book requests (`book_offers` command)
- **Connection Management**: Singleton client with auto-reconnect logic (`src/xrplClient.ts`)
- **Network**: Defaults to `wss://s1.ripple.com` (Ripple's mainnet)

### Web Framework

**Fastify** (v4.29.1)
- **Purpose**: HTTP server and routing
- **Plugins Used**:
  - `@fastify/cors` (v9.0.1): Cross-origin resource sharing support

### Development Tools

**TypeScript Toolchain**
- `typescript` (v5.9.3): Type checking and compilation
- `tsx` (v4.20.6): TypeScript execution and hot reload
- `@types/node` (v20.11.19): Node.js type definitions

### Network Protocol

**WebSocket Connection**
- **Purpose**: Real-time bidirectional communication with XRPL
- **Implementation**: Managed through xrpl library's Client class
- **Lifecycle**: Connection pooling with graceful shutdown on SIGINT/SIGTERM

### Currency Support

**Asset Types**
- Native XRP (no issuer required)
- Issued Currencies (requires issuer address)
- **Format Handling**: Automatic conversion between drops and XRP decimals