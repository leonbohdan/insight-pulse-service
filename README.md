# 📊 InsightPulse — Reporting Engine (`insight-pulse-service`)

A high-performance analytical reporting microservice built with **NestJS** (v12, ESM), **MongoDB 7.0**, **Mongoose ODM**, and **GraphQL (Apollo Server)**. This project is designed for hands-on mastery of high-load data processing: advanced **MongoDB Aggregation Pipelines** (`$lookup`, `$unwind`, `$facet`), **GraphQL Code-First Architecture**, query optimization and N+1 problem elimination via **DataLoader**, and multi-layer **DoS Security** (Depth Limiting, Query Complexity, and Rate Limiting).

---

## 🚀 Key Objectives & Architecture

- **Containerized NoSQL Infrastructure**: Isolated environment with **MongoDB 7.0** and **Mongo Express** running on a custom Docker bridge network.
- **Complex Aggregation Pipelines**: Multi-stage pipelines for revenue reporting, relational lookups across collections (`$lookup`), array deconstruction (`$unwind`), and single-query multidimensional dashboards (`$facet`).
- **Compound Indexing Strategy**: ESR-aligned indexes (e.g. `{ status: 1, orderedAt: -1 }`) ensuring sub-millisecond index scans (**IXSCAN**) across 10,000+ records.
- **GraphQL Code-First API**: Auto-generated SDL schema (`src/schema.gql`), strictly typed models (`@ObjectType`), and validated input DTOs (`@InputType`).
- **N+1 Optimization via DataLoader**: Request-scoped batching and memoization caching to resolve parent-child relationship queries in $1 + 1$ operations instead of $1 + N$.
- **Multi-layer GraphQL DoS Protection**:
  - **Query Depth Limiting** (`graphql-depth-limit`): Prevents nested recursive/cyclical graph attacks (max depth: 5).
  - **Query Complexity Analysis** (`graphql-query-complexity`): Static AST analysis preventing horizontal field-spam attacks (max complexity: 100).
  - **Rate Limiting** (`@nestjs/throttler`): Custom `GqlThrottlerGuard` enforcing request thresholds per client IP (30 req/min).

---

## 🛠️ Tech Stack

| Area | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend Framework** | [NestJS](https://nestjs.com/) (v12, ES Modules) | Modular architecture, Dependency Injection, Guards |
| **Language & Runtime** | [Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/) | Type-safe server implementation |
| **Database** | [MongoDB 7.0](https://www.mongodb.com/) | Document-oriented NoSQL database |
| **ODM** | [Mongoose](https://mongoosejs.com/) (`@nestjs/mongoose`) | Schema modeling, compound indexes, aggregation builder |
| **GraphQL Engine** | [Apollo Server](https://www.apollographql.com/) (`@nestjs/apollo`, `@nestjs/graphql`) | Code-First GraphQL server, schema generation, execution |
| **Query Optimization** | [DataLoader](https://github.com/graphql/dataloader) | Batching and per-request memoization to eliminate N+1 |
| **API Security** | `graphql-depth-limit`, `graphql-query-complexity`, `@nestjs/throttler` | DoS protection: depth limits, complexity budget, IP rate limiting |
| **Infrastructure** | [Docker](https://www.docker.com/) & Docker Compose | Containerized database and web management tools |
| **Admin UI** | [Mongo Express](https://github.com/mongo-express/mongo-express) | Web dashboard for inspecting collections and indexes |
| **Testing & Tooling** | [Vitest](https://vitest.dev/) & [Oxlint](https://oxc.rs/) | Sub-second unit/integration testing and fast linting |

---

## 📁 Project Structure

```text
insight-pulse-service/
├── .agents/                    # Assistant instructions and educational rules
├── docs/                       # Specifications, summaries, and learning roadmaps
│   ├── task_1.md               # Day 6: Docker Environment & Basic Aggregation Pipeline
│   ├── task_1_summary.md       # Day 6 Summary & MongoDB Architecture Q&A
│   ├── task_2.md               # Day 7: Advanced Aggregations ($lookup, $unwind, $facet)
│   ├── task_2_summary.md       # Day 7 Summary & Multi-faceted Analytics Q&A
│   ├── task_3.md               # Day 8: GraphQL API with Apollo Server (Code-First)
│   ├── task_3_summary.md       # Day 8 Summary & GraphQL vs REST Q&A
│   ├── task_4.md               # Day 9: DataLoader (N+1) & GraphQL DoS Protection
│   ├── task_4_summary.md       # Day 9 Summary & Performance/Security Q&A
│   └── postman/                # Postman v2.1 collections for API testing
├── src/                        # Application source code
│   ├── analytics/              # Analytics business domain
│   │   ├── dto/                # REST DTOs and GraphQL InputTypes
│   │   │   ├── date-range.dto.ts
│   │   │   ├── date-range.input.ts
│   │   │   └── executive-dashboard-response.dto.ts
│   │   ├── guards/             # Security guards
│   │   │   └── gql-throttler.guard.ts   # Custom GraphQL Throttler guard
│   │   ├── loaders/            # DataLoader factories
│   │   │   └── customer.loader.ts       # Request-scoped Customer batch loader
│   │   ├── models/             # GraphQL ObjectTypes (Code-First schema)
│   │   │   ├── category-report.model.ts
│   │   │   └── customer.model.ts
│   │   ├── schemas/            # Mongoose schemas
│   │   │   ├── customer.schema.ts
│   │   │   ├── order-analytics.schema.ts
│   │   │   └── product.schema.ts
│   │   ├── analytics.controller.spec.ts
│   │   ├── analytics.controller.ts      # REST API endpoints
│   │   ├── analytics.module.ts
│   │   ├── analytics.resolver.ts        # GraphQL Resolver & @ResolveField
│   │   ├── analytics.service.spec.ts
│   │   └── analytics.service.ts         # Aggregation pipeline implementations
│   ├── app.controller.spec.ts
│   ├── app.controller.ts
│   ├── app.module.ts           # Root module (GraphQL, Mongoose, Throttler config)
│   ├── app.service.ts
│   ├── main.ts                 # Bootstrap entrypoint (Pipes, Mongoose debug)
│   └── schema.gql              # Auto-generated GraphQL SDL Schema
├── docker-compose.yml          # Container definitions (mongo_db + mongo_express)
├── package.json                # Dependencies, scripts, and overrides
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## 📄 Data Models & Schema Design

The domain models denormalized analytical records along with normalized reference entities:

### 1. `OrderAnalytics` Collection
```typescript
{
  orderId: string;       // Unique order UUID (unique index)
  customerId: string;    // Customer reference ID (indexed)
  category: string;      // Category: 'Tech' | 'Home' | 'Fashion' | 'Auto' (indexed)
  totalPrice: number;    // Order monetary amount
  itemsCount: number;    // Number of items in order
  status: OrderStatus;   // 'COMPLETED' | 'CANCELLED' | 'REFUNDED'
  orderedAt: Date;       // Timestamp (indexed)
  items: Array<{ productId: string; quantity: number; price: number }>;
}
```
- **Compound Index**: `{ status: 1, orderedAt: -1 }` guarantees optimal execution of `$match` stages in time-bounded reporting.

### 2. `Customer` Collection
```typescript
{
  _id: string;           // Customer UUID (unique)
  name: string;          // Full customer name (indexed)
  email: string;         // Unique email with regex format validation
  tier: TierStatus;      // 'BRONZE' | 'SILVER' | 'GOLD'
}
```

### 3. `Product` Collection
```typescript
{
  _id: string;           // Product UUID (unique)
  sku: string;           // Unique SKU (e.g. 'SKU-TECH-1001')
  title: string;         // Product title
  costPrice: number;     // Wholesale cost price
}
```

---

## 🌐 API Endpoints & Specifications

### 1. GraphQL API (`/graphql`)

GraphQL Sandbox / Playground is accessible at [http://localhost:3000/graphql](http://localhost:3000/graphql).

#### Query Category Revenue Reports (with DataLoader & Rate Limiting)
```graphql
query GetCategoryReports {
  categoryReports(filter: { startDate: "2026-07-01T00:00:00Z" }) {
    id
    category
    metrics {
      totalRevenue
      totalOrders
      averageOrderValue
    }
    topCustomerId
    topPerformerCustomer {
      id
      name
      email
      tier
    }
    formattedSummary
  }
}
```

---

### 2. REST API Specification

#### A. Category Revenue Report
```http
GET /analytics/categories?startDate=2026-07-01T00:00:00.000Z&endDate=2026-09-08T23:59:59.999Z
```
Returns revenue, orders count, items count, and average order value grouped by category.

#### B. Executive Dashboard (Multi-faceted Analytics)
```http
GET /analytics/dashboard
```
Executes a single `$facet` pipeline returning overall KPI metrics, top-5 revenue products via `$unwind`, and order price tier distribution via `$bucket`.

#### C. Top Margin Orders (Relational Lookups)
```http
GET /analytics/orders/top-margin?limit=10
```
Performs `$lookup` with product cost calculation to find highest-profit orders.

#### D. Seed Test Dataset
```http
POST /analytics/seed?count=10000
```
Generates 100 customers, 50 products, and 10,000 realistic orders distributed over the last 60 days.

#### E. Clear Analytics Data
```http
DELETE /analytics/delete
```
Clears order records for fresh benchmarking.

---

## 🛡️ GraphQL Performance & Security Features

### 1. Resolving the N+1 Problem with DataLoader
- **Problem**: When querying 20 categories with an embedded `topPerformerCustomer` field, a naive `@ResolveField` calls `findById()` per record, causing $1 + 20 = 21$ MongoDB queries.
- **Solution**: `CustomerLoaderFactory` collects customer IDs across a single Event Loop tick and executes **exactly 1** batch query:
  ```javascript
  this.customerModel.find({ _id: { $in: customerIds } });
  ```
- **Lifecycle Scoping**: Created per-request in the GraphQL `context` callback to ensure cache isolation and prevent cross-user data/memory leaks.

### 2. Query Depth Limiting
- Configured via `validationRules: [depthLimit(5)]` in Apollo Server.
- Rejects recursive and circular queries exceeding 5 levels of object nesting at the AST parse stage before any database resolver runs.

### 3. Query Complexity Budgeting
- Integrated via a custom Apollo Server plugin utilizing `graphql-query-complexity`.
- Assigns complexity points to every selected field (`simpleEstimator` + `fieldExtensionsEstimator`).
- Rejects queries whose complexity exceeds the threshold of `100` points, defending against horizontal field-duplication attacks.

### 4. IP-based Rate Limiting
- Protected by `@nestjs/throttler` with a custom `GqlThrottlerGuard` resolving HTTP request context from `GqlExecutionContext`.
- Enforces a rate limit of **30 requests per minute** per client IP.

---

## ⚡ Quick Start Guide

### 1. Configure Environment
```bash
cp .env.example .env
```

### 2. Start Docker Containers
```bash
docker compose up -d
```
- MongoDB: `localhost:27017`
- Mongo Express Web UI: [http://localhost:8081](http://localhost:8081)

### 3. Install Dependencies
```bash
npm install
```

### 4. Seed Analytical Dataset
```bash
# Seed 10,000 orders, 100 customers, 50 products
curl -X POST http://localhost:3000/analytics/seed?count=10000
```

### 5. Run the Application
```bash
# Development mode with hot-reload & Mongoose debug logging
npm run start:dev

# Production build & start
npm run build
npm run start:prod
```

### 6. Run Test Suites & Linter
```bash
# Unit & integration tests (Vitest)
npm run test

# End-to-end tests
npm run test:e2e

# Fast code analysis (Oxlint)
npm run lint
```

---

## 📚 Educational Roadmap & Summaries

The project contains complete day-by-day learning logs, benchmark comparisons, and interview guides:

- [docs/task_1.md](docs/task_1.md) & [docs/task_1_summary.md](docs/task_1_summary.md):
  - Docker architecture, Mongoose schemas, compound indexes (`ESR` rule), and basic aggregation pipelines.
- [docs/task_2.md](docs/task_2.md) & [docs/task_2_summary.md](docs/task_2_summary.md):
  - Complex pipelines: `$lookup` joins, array deconstruction (`$unwind`), multi-faceted dashboards (`$facet`), and bucket grouping (`$bucket`).
- [docs/task_3.md](docs/task_3.md) & [docs/task_3_summary.md](docs/task_3_summary.md):
  - GraphQL Apollo Server integration (NestJS Code-First approach), `@ObjectType`, `@InputType`, dynamic `@ResolveField`, and automatic SDL generation.
- [docs/task_4.md](docs/task_4.md) & [docs/task_4_summary.md](docs/task_4_summary.md):
  - Overcoming N+1 with request-scoped `DataLoader`, and three-layer GraphQL DoS protection (Depth Limit, Query Complexity, and Rate Limiting).
