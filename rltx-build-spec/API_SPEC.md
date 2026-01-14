# RLTX API Specification

## RESTful + WebSocket API Design

---

## Base URLs

```
Production:  https://api.rltx.ai/v1
Staging:     https://staging-api.rltx.ai/v1
Development: http://localhost:3000/api/v1
WebSocket:   wss://ws.rltx.ai
```

---

## Authentication

All API requests require authentication via Bearer token (Clerk JWT).

```bash
Authorization: Bearer <clerk_jwt_token>
```

Organization context is required for most endpoints:

```bash
X-Organization-Id: <org_id>
```

---

## REST API Endpoints

### Workflows

#### Create Workflow from Question

```http
POST /v1/workflows/compose
Content-Type: application/json

{
  "question": "Should we acquire TargetCo at $500M?",
  "context": {
    "additionalInfo": "We're focused on European expansion",
    "constraints": ["budget: $600M max"],
    "objectives": ["strategic fit", "synergy potential"]
  }
}
```

**Response:**
```json
{
  "id": "wf_abc123",
  "question": "Should we acquire TargetCo at $500M?",
  "status": "draft",
  "graph": {
    "nodes": [
      {
        "id": "node_1",
        "type": "primitive",
        "primitiveId": "data.crm.salesforce",
        "position": { "x": 100, "y": 100 },
        "config": {}
      },
      {
        "id": "node_2",
        "type": "primitive",
        "primitiveId": "reason.analyze",
        "position": { "x": 300, "y": 100 },
        "config": {
          "prompt": "Analyze strategic fit for European expansion"
        }
      }
    ],
    "edges": [
      {
        "id": "edge_1",
        "source": "node_1",
        "sourceHandle": "output",
        "target": "node_2",
        "targetHandle": "data"
      }
    ]
  },
  "estimates": {
    "timeMs": { "p50": 480000, "p95": 720000 },
    "cost": { "llm": 12.50, "compute": 2.00, "total": 14.50 }
  },
  "createdAt": "2026-01-13T10:00:00Z",
  "createdBy": "user_xyz"
}
```

---

#### Get Workflow

```http
GET /v1/workflows/:id
```

**Response:**
```json
{
  "id": "wf_abc123",
  "question": "Should we acquire TargetCo at $500M?",
  "status": "draft",
  "graph": { ... },
  "estimates": { ... },
  "createdAt": "2026-01-13T10:00:00Z",
  "updatedAt": "2026-01-13T10:05:00Z"
}
```

---

#### Update Workflow

```http
PATCH /v1/workflows/:id
Content-Type: application/json

{
  "graph": {
    "nodes": [...],
    "edges": [...]
  }
}
```

---

#### List Workflows

```http
GET /v1/workflows
Query Parameters:
  - status: draft|ready|running|completed|failed
  - limit: number (default: 20)
  - offset: number (default: 0)
  - sort: createdAt|updatedAt (default: -createdAt)
```

---

### Executions

#### Start Execution

```http
POST /v1/workflows/:id/execute
Content-Type: application/json

{
  "options": {
    "streaming": true,
    "checkpoints": ["node_3", "node_5"]
  }
}
```

**Response:**
```json
{
  "executionId": "exec_xyz789",
  "workflowId": "wf_abc123",
  "status": "running",
  "startedAt": "2026-01-13T10:10:00Z",
  "streamUrl": "wss://ws.rltx.ai/executions/exec_xyz789"
}
```

---

#### Get Execution Status

```http
GET /v1/executions/:id
```

**Response:**
```json
{
  "id": "exec_xyz789",
  "workflowId": "wf_abc123",
  "status": "running",
  "progress": {
    "completedNodes": 5,
    "totalNodes": 12,
    "percentage": 42,
    "currentNode": "node_6"
  },
  "nodeResults": {
    "node_1": {
      "state": "completed",
      "output": { ... },
      "timing": {
        "startedAt": "2026-01-13T10:10:01Z",
        "completedAt": "2026-01-13T10:10:03Z",
        "durationMs": 2100
      }
    },
    "node_2": {
      "state": "completed",
      "output": { ... },
      "timing": { ... }
    }
  },
  "estimates": {
    "remainingMs": 180000,
    "totalMs": 420000
  }
}
```

---

#### Pause/Resume/Cancel Execution

```http
POST /v1/executions/:id/pause
POST /v1/executions/:id/resume
POST /v1/executions/:id/cancel
```

---

#### Get Execution Results

```http
GET /v1/executions/:id/results
```

**Response:**
```json
{
  "executionId": "exec_xyz789",
  "status": "completed",
  "recommendation": {
    "action": "Proceed with acquisition at $425-450M",
    "confidence": 0.73,
    "reasoning": "At this price range, expected 5-year NPV is $42M..."
  },
  "frontier": {
    "points": [
      {
        "id": "p1",
        "price": 400000000,
        "expectedNpv": 58000000,
        "risk": 0.32,
        "probability": 0.68
      },
      {
        "id": "p2",
        "price": 450000000,
        "expectedNpv": 42000000,
        "risk": 0.28,
        "probability": 0.73
      }
    ],
    "recommended": "p2"
  },
  "drivers": [
    { "variable": "market_growth", "impact": 0.38 },
    { "variable": "synergy_capture", "impact": 0.28 }
  ],
  "assumptions": [
    {
      "statement": "Market grows ≥3% annually",
      "probability": 0.89,
      "status": "safe"
    },
    {
      "statement": "Key talent retained through integration",
      "probability": 0.67,
      "status": "moderate_risk"
    }
  ],
  "minorityView": {
    "argument": "Integration timeline is aggressive...",
    "confidence": 0.27
  },
  "evidencePackUrl": "/v1/executions/exec_xyz789/evidence-pack"
}
```

---

### Human Checkpoints

#### List Pending Checkpoints

```http
GET /v1/checkpoints?status=pending
```

---

#### Respond to Checkpoint

```http
POST /v1/checkpoints/:id/respond
Content-Type: application/json

{
  "response": {
    "approved": true,
    "modifications": {
      "market_growth_assumption": 0.04
    },
    "comment": "Adjusted market growth based on recent data"
  }
}
```

---

### Tripwires

#### Create Tripwire

```http
POST /v1/tripwires
Content-Type: application/json

{
  "executionId": "exec_xyz789",
  "condition": {
    "variable": "market_growth",
    "operator": "lt",
    "threshold": 0.03
  },
  "action": "re_evaluate",
  "dataSource": {
    "type": "api",
    "endpoint": "bloomberg/market-data",
    "refreshInterval": "1d"
  },
  "notifications": {
    "channels": ["email", "push"],
    "recipients": ["user_abc", "user_def"]
  }
}
```

---

#### List Tripwires

```http
GET /v1/tripwires?status=active
```

---

#### Tripwire Triggered (webhook callback)

```http
POST /v1/tripwires/:id/triggered
Content-Type: application/json

{
  "currentValue": 0.021,
  "threshold": 0.03,
  "triggeredAt": "2026-02-15T09:00:00Z"
}
```

---

### Primitives

#### List Available Primitives

```http
GET /v1/primitives
Query Parameters:
  - category: data|reason|simulate|optimize|human|output|control
  - search: string
```

**Response:**
```json
{
  "primitives": [
    {
      "id": "data.api.fetch",
      "name": "API Fetch",
      "description": "Fetch data from REST API",
      "category": "data",
      "icon": "🔗",
      "color": "#3b82f6",
      "inputs": [
        { "id": "url", "name": "URL", "type": "string", "required": true }
      ],
      "outputs": [
        { "id": "response", "name": "Response", "type": "object" }
      ],
      "config": {
        "type": "object",
        "properties": {
          "method": { "type": "string", "enum": ["GET", "POST"] },
          "headers": { "type": "object" }
        }
      },
      "estimatedCost": { "dollars": 0.01 },
      "estimatedTime": { "p50": 1000, "p95": 5000 }
    },
    {
      "id": "reason.analyze",
      "name": "Deep Analysis",
      "description": "Use Claude for complex reasoning",
      "category": "reason",
      "icon": "🧠",
      "color": "#8b5cf6",
      "inputs": [
        { "id": "data", "name": "Data", "type": "any", "required": true },
        { "id": "context", "name": "Context", "type": "string", "required": false }
      ],
      "outputs": [
        { "id": "analysis", "name": "Analysis", "type": "object" }
      ],
      "config": {
        "type": "object",
        "properties": {
          "prompt": { "type": "string", "title": "Custom Prompt" },
          "model": { "type": "string", "enum": ["claude-3-opus", "claude-3-sonnet"] }
        }
      },
      "estimatedCost": { "dollars": 2.50 },
      "estimatedTime": { "p50": 15000, "p95": 45000 }
    }
  ]
}
```

---

### Templates

#### List Templates

```http
GET /v1/templates
Query Parameters:
  - category: m-and-a|pricing|market-entry|hiring|capital
  - search: string
```

---

#### Create Template from Workflow

```http
POST /v1/templates
Content-Type: application/json

{
  "workflowId": "wf_abc123",
  "name": "M&A Evaluation - European Focus",
  "description": "Full M&A analysis with European market emphasis",
  "category": "m-and-a",
  "tags": ["acquisition", "europe", "strategic-fit"]
}
```

---

### Chat / Composer

#### Send Chat Message

```http
POST /v1/chat
Content-Type: application/json

{
  "workflowId": "wf_abc123",  // optional, for existing workflow
  "message": "Also consider regulatory risk in the EU",
  "conversationId": "conv_123"
}
```

**Response (streaming):**
```json
{
  "type": "text",
  "content": "I'll add a regulatory risk analysis node..."
}

{
  "type": "workflow_update",
  "changes": {
    "addNodes": [
      {
        "id": "node_new",
        "primitiveId": "reason.analyze",
        "config": { "prompt": "Analyze EU regulatory risk..." }
      }
    ],
    "addEdges": [...]
  }
}

{
  "type": "complete",
  "estimates": { "timeMs": { "p50": 520000 }, "cost": { "total": 16.00 } }
}
```

---

### Ontology

#### Query Ontology

```http
POST /v1/ontology/query
Content-Type: application/json

{
  "query": "MATCH (c:Company {name: 'TargetCo'})-[r]->(related) RETURN c, r, related",
  "parameters": {}
}
```

---

#### Sync Data Source

```http
POST /v1/ontology/sync
Content-Type: application/json

{
  "connector": "salesforce",
  "config": {
    "objects": ["Account", "Opportunity"],
    "filters": { "CreatedDate": { "gte": "2024-01-01" } }
  }
}
```

---

### Calibration / Learning

#### Get Calibration Data

```http
GET /v1/calibration
```

**Response:**
```json
{
  "calibrationCurve": {
    "0.6": 0.58,
    "0.7": 0.72,
    "0.8": 0.79,
    "0.9": 0.91
  },
  "decisionCount": 47,
  "accuracy": {
    "overall": 0.74,
    "byType": {
      "m-and-a": 0.71,
      "pricing": 0.82,
      "hiring": 0.68
    }
  },
  "note": "When RLTX says 73% confident, we're historically right 74% of the time"
}
```

---

#### Record Outcome

```http
POST /v1/outcomes
Content-Type: application/json

{
  "executionId": "exec_xyz789",
  "outcomes": {
    "npv": {
      "actual": 38000000,
      "predicted": { "mean": 42000000, "ci95": [28000000, 56000000] }
    }
  },
  "assumptions": [
    {
      "statement": "Market grows ≥3% annually",
      "held": true
    }
  ]
}
```

---

## WebSocket Events

### Connection

```javascript
const socket = io('wss://ws.rltx.ai', {
  auth: { token: '<clerk_jwt>' },
  query: { orgId: '<org_id>' }
});
```

### Client → Server Events

```typescript
// Join workflow room
socket.emit('workflow:join', { workflowId: string });

// Leave workflow room
socket.emit('workflow:leave', { workflowId: string });

// Canvas updates (real-time collaboration)
socket.emit('canvas:update', {
  workflowId: string;
  changes: CanvasChange[];
});

// Cursor position (collaboration)
socket.emit('canvas:cursor', {
  workflowId: string;
  cursor: { x: number; y: number };
});

// Start execution
socket.emit('execution:start', { workflowId: string });

// Human checkpoint response
socket.emit('checkpoint:respond', {
  checkpointId: string;
  response: any;
});
```

### Server → Client Events

```typescript
// Canvas synchronized
socket.on('canvas:sync', (data: {
  workflowId: string;
  canvas: Canvas;
}) => void);

// Canvas update from another user
socket.on('canvas:update', (data: {
  workflowId: string;
  userId: string;
  changes: CanvasChange[];
}) => void);

// Collaborator cursor moved
socket.on('canvas:cursor', (data: {
  workflowId: string;
  userId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number };
}) => void);

// Collaborator joined/left
socket.on('collaborator:joined', (data: Collaborator) => void);
socket.on('collaborator:left', (data: { userId: string }) => void);

// Execution events
socket.on('execution:started', (data: {
  executionId: string;
  workflowId: string;
}) => void);

socket.on('execution:node:started', (data: {
  executionId: string;
  nodeId: string;
}) => void);

socket.on('execution:node:progress', (data: {
  executionId: string;
  nodeId: string;
  progress: number;
  message?: string;
}) => void);

socket.on('execution:node:output', (data: {
  executionId: string;
  nodeId: string;
  output: any;
  partial?: boolean;  // For streaming outputs
}) => void);

socket.on('execution:node:completed', (data: {
  executionId: string;
  nodeId: string;
  output: any;
  timing: { startedAt: string; completedAt: string; durationMs: number };
}) => void);

socket.on('execution:node:failed', (data: {
  executionId: string;
  nodeId: string;
  error: string;
}) => void);

socket.on('execution:completed', (data: {
  executionId: string;
  results: ExecutionResults;
}) => void);

// Human checkpoint required
socket.on('checkpoint:required', (data: {
  checkpointId: string;
  nodeId: string;
  request: HumanRequest;
  context: any;
}) => void);

// Tripwire triggered
socket.on('tripwire:triggered', (data: {
  tripwireId: string;
  executionId: string;
  condition: string;
  currentValue: any;
  threshold: any;
}) => void);
```

---

## Types

```typescript
// Canvas types
interface Canvas {
  id: string;
  workflowId: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  groups: CanvasGroup[];
  viewport: { x: number; y: number; zoom: number };
}

interface CanvasNode {
  id: string;
  type: 'primitive' | 'group' | 'annotation';
  primitiveId?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: Record<string, any>;
  state: 'idle' | 'pending' | 'running' | 'completed' | 'failed';
  output?: any;
  timing?: Timing;
}

interface CanvasEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  transform?: string;
}

interface CanvasChange {
  type: 'node:add' | 'node:update' | 'node:delete' |
        'edge:add' | 'edge:delete' | 'viewport:change';
  data: any;
}

// Execution types
interface ExecutionResults {
  recommendation: Recommendation;
  frontier?: ParetoFrontier;
  drivers: Driver[];
  assumptions: Assumption[];
  minorityView?: MinorityView;
  tripwires: Tripwire[];
}

interface Recommendation {
  action: string;
  confidence: number;
  reasoning: string;
  calibrationNote?: string;
}

interface ParetoFrontier {
  points: ParetoPoint[];
  recommended: string;
  axes: { x: string; y: string; z?: string };
}

interface Driver {
  variable: string;
  impact: number;
  direction: 'positive' | 'negative';
  sensitivity: { low: number; high: number; impact: number };
}

interface Assumption {
  statement: string;
  probability: number;
  status: 'safe' | 'moderate_risk' | 'at_risk';
  tripwireCandidate: boolean;
}

// Human checkpoint types
interface HumanRequest {
  type: 'input' | 'review' | 'approve' | 'override';
  title: string;
  description: string;
  fields: HumanField[];
  timeout: { duration: number; action: string };
}

interface HumanField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'slider' | 'boolean';
  required: boolean;
  default?: any;
  options?: any[];
  min?: number;
  max?: number;
}

// Tripwire types
interface Tripwire {
  id: string;
  executionId: string;
  condition: TripwireCondition;
  status: 'active' | 'triggered' | 'resolved' | 'expired';
  action: 're_evaluate' | 'alert' | 'pause';
}

interface TripwireCondition {
  variable: string;
  operator: 'lt' | 'gt' | 'eq' | 'change_by';
  threshold: number | string;
  currentValue?: number | string;
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "WORKFLOW_NOT_FOUND",
    "message": "Workflow with ID wf_abc123 not found",
    "details": { ... }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing auth token |
| `FORBIDDEN` | 403 | User lacks permission |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `RATE_LIMITED` | 429 | Too many requests |
| `EXECUTION_FAILED` | 500 | Workflow execution error |
| `EXTERNAL_API_ERROR` | 502 | External API (Claude, etc.) failed |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `POST /v1/workflows/compose` | 10/min |
| `POST /v1/workflows/:id/execute` | 5/min |
| `POST /v1/chat` | 30/min |
| `GET /*` | 100/min |
| WebSocket messages | 60/min |

---

## Pagination

List endpoints support cursor-based pagination:

```http
GET /v1/workflows?limit=20&cursor=eyJpZCI6...
```

Response includes:

```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "hasMore": true,
    "nextCursor": "eyJpZCI6..."
  }
}
```
