# Add Your First Tool to the Agent

In the previous exercise, you built a basic agent that could reason and respond using an LLM. Now you'll extend it with a **tool**: a function the agent node can call to access external services, and work with real structured data by accessing databases.

---

## Overview

In this exercise, you will create the payload data for the stolen items, build a client for the SAP-RPT-1 model, and call it directly from your agent node.

> **SAP-RPT-1** — [SAP's Relational Pretrained Transformer model](https://www.sap.com/products/artificial-intelligence/sap-rpt.html) is a foundation model trained on structured data. It is available in Generative AI Hub to gain predictive insights from enterprise data. The model works by uploading example data rows as JSON and can do classification and regression predictions on your dataset.

---

## Check Out SAP-RPT-1

👉 Open the [SAP-RPT-1 Playground](https://rpt.cloud.sap/). Use one of the example files from the playground to understand how the model works.

---

## Create the Payload Data File

Your agent needs real data to work with. Instead of hardcoding it in the agent file, you'll keep it in a separate file for clarity. This data is being mocked for reasons of simplification. This data would, under productive circumstances, be fetched from a service or a database.

### Step 1: Create the Payload File

👉 Create a new file [`/project/JavaScript/starter-project/src/payload.ts`](/project/JavaScript/starter-project/src/payload.ts)

👉 Add the payload data:

```typescript
import type { RPT1Payload } from "./types.js";

export const payload: RPT1Payload = {
  prediction_config: {
    target_columns: [
      {
        name: "INSURANCE_VALUE",
        prediction_placeholder: "'[PREDICT]'",
        task_type: "regression",
      },
      {
        name: "ITEM_CATEGORY",
        prediction_placeholder: "'[PREDICT]'",
        task_type: "classification",
      },
    ],
  },
  index_column: "ITEM_ID",
  rows: [
    {
      ITEM_ID: "ART_001",
      ITEM_NAME: "Water Lilies - Series 1",
      ARTIST: "Claude Monet",
      ACQUISITION_DATE: "1987-03-15",
      INSURANCE_VALUE: 45000000,
      ITEM_CATEGORY: "Painting",
      DIMENSIONS: "200x180cm",
      CONDITION_SCORE: 9,
      RARITY_SCORE: 9,
      PROVENANCE_CLARITY: 8,
    },
    {
      ITEM_ID: "ART_002",
      ITEM_NAME: "Japanese Bridge at Giverny",
      ARTIST: "Claude Monet",
      ACQUISITION_DATE: "1995-06-22",
      INSURANCE_VALUE: 42000000,
      ITEM_CATEGORY: "Painting",
      DIMENSIONS: "92x73cm",
      CONDITION_SCORE: 8,
      RARITY_SCORE: 8,
      PROVENANCE_CLARITY: 9,
    },
    {
      ITEM_ID: "ART_003",
      ITEM_NAME: "Irises",
      ARTIST: "Vincent van Gogh",
      ACQUISITION_DATE: "2001-11-08",
      INSURANCE_VALUE: "'[PREDICT]'",
      ITEM_CATEGORY: "Painting",
      DIMENSIONS: "71x93cm",
      CONDITION_SCORE: 7,
      RARITY_SCORE: 9,
      PROVENANCE_CLARITY: 8,
    },
    {
      ITEM_ID: "ART_004",
      ITEM_NAME: "Starry Night Over the Rhone",
      ARTIST: "Vincent van Gogh",
      ACQUISITION_DATE: "1998-09-14",
      INSURANCE_VALUE: 48000000,
      ITEM_CATEGORY: "Painting",
      DIMENSIONS: "73x92cm",
      CONDITION_SCORE: 8,
      RARITY_SCORE: 9,
      PROVENANCE_CLARITY: 9,
    },
    {
      ITEM_ID: "ART_005",
      ITEM_NAME: "The Birth of Venus",
      ARTIST: "Sandro Botticelli",
      ACQUISITION_DATE: "1992-04-30",
      INSURANCE_VALUE: 55000000,
      ITEM_CATEGORY: "Painting",
      DIMENSIONS: "172x278cm",
      CONDITION_SCORE: 6,
      RARITY_SCORE: 10,
      PROVENANCE_CLARITY: 10,
    },
    {
      ITEM_ID: "ART_006",
      ITEM_NAME: "Primavera",
      ARTIST: "Sandro Botticelli",
      ACQUISITION_DATE: "1989-02-19",
      INSURANCE_VALUE: 52000000,
      ITEM_CATEGORY: "Painting",
      DIMENSIONS: "203x314cm",
      CONDITION_SCORE: 7,
      RARITY_SCORE: 10,
      PROVENANCE_CLARITY: 10,
    },
    {
      ITEM_ID: "ART_007",
      ITEM_NAME: "Girl with a Pearl Earring",
      ARTIST: "Johannes Vermeer",
      ACQUISITION_DATE: "2003-07-11",
      INSURANCE_VALUE: "'[PREDICT]'",
      ITEM_CATEGORY: "Painting",
      DIMENSIONS: "44x39cm",
      CONDITION_SCORE: 8,
      RARITY_SCORE: 10,
      PROVENANCE_CLARITY: 9,
    },
    {
      ITEM_ID: "ART_008",
      ITEM_NAME: "The Music Lesson",
      ARTIST: "Johannes Vermeer",
      ACQUISITION_DATE: "1994-05-20",
      INSURANCE_VALUE: 38000000,
      ITEM_CATEGORY: "Painting",
      DIMENSIONS: "64x73cm",
      CONDITION_SCORE: 8,
      RARITY_SCORE: 9,
      PROVENANCE_CLARITY: 9,
    },
    {
      ITEM_ID: "ART_009",
      ITEM_NAME: "The Persistence of Memory",
      ARTIST: "Salvador Dalí",
      ACQUISITION_DATE: "2005-03-10",
      INSURANCE_VALUE: 35000000,
      ITEM_CATEGORY: "'[PREDICT]'",
      DIMENSIONS: "24x33cm",
      CONDITION_SCORE: 9,
      RARITY_SCORE: 9,
      PROVENANCE_CLARITY: 10,
    },
    {
      ITEM_ID: "ART_010",
      ITEM_NAME: "Metamorphosis of Narcissus",
      ARTIST: "Salvador Dalí",
      ACQUISITION_DATE: "1996-08-12",
      INSURANCE_VALUE: 32000000,
      ITEM_CATEGORY: "Painting",
      DIMENSIONS: "51x78cm",
      CONDITION_SCORE: 8,
      RARITY_SCORE: 8,
      PROVENANCE_CLARITY: 8,
    },
    {
      ITEM_ID: "ART_011",
      ITEM_NAME: "The Bronze Dancer",
      ARTIST: "Auguste Rodin",
      ACQUISITION_DATE: "1991-07-22",
      INSURANCE_VALUE: 8500000,
      ITEM_CATEGORY: "Sculpture",
      DIMENSIONS: "Height: 1.8m",
      CONDITION_SCORE: 9,
      RARITY_SCORE: 7,
      PROVENANCE_CLARITY: 8,
    },
    {
      ITEM_ID: "ART_012",
      ITEM_NAME: "The Thinker",
      ARTIST: "Auguste Rodin",
      ACQUISITION_DATE: "2000-11-05",
      INSURANCE_VALUE: "'[PREDICT]'",
      ITEM_CATEGORY: "Sculpture",
      DIMENSIONS: "Height: 1.9m",
      CONDITION_SCORE: 9,
      RARITY_SCORE: 7,
      PROVENANCE_CLARITY: 9,
    },
    {
      ITEM_ID: "ART_013",
      ITEM_NAME: "Hope Diamond Replica - Royal Cut",
      ARTIST: "Unknown Jeweler",
      ACQUISITION_DATE: "1988-02-19",
      INSURANCE_VALUE: 12000000,
      ITEM_CATEGORY: "Jewelry",
      DIMENSIONS: "Width: 15cm",
      CONDITION_SCORE: 10,
      RARITY_SCORE: 10,
      PROVENANCE_CLARITY: 7,
    },
    {
      ITEM_ID: "ART_014",
      ITEM_NAME: "Cartier Ruby Necklace - 1920s",
      ARTIST: "Cartier",
      ACQUISITION_DATE: "2002-09-11",
      INSURANCE_VALUE: 9500000,
      ITEM_CATEGORY: "Jewelry",
      DIMENSIONS: "Length: 45cm",
      CONDITION_SCORE: 9,
      RARITY_SCORE: 8,
      PROVENANCE_CLARITY: 9,
    },
  ],
};
```

### Step 2: Add Types for the Payload

👉 Open [`/project/JavaScript/starter-project/src/types.ts`](/project/JavaScript/starter-project/src/types.ts)

👉 Add the type definitions for the payload structure at the end of the file:

```typescript
export interface PredictionTargetColumn {
  name: string;
  prediction_placeholder: string;
  task_type: "regression" | "classification";
}

export interface PredictionConfig {
  target_columns: PredictionTargetColumn[];
}

export interface StolenItem {
  ITEM_ID: string;
  ITEM_NAME: string;
  ARTIST: string;
  ACQUISITION_DATE: string;
  INSURANCE_VALUE: number | string;
  ITEM_CATEGORY: string;
  DIMENSIONS: string;
  CONDITION_SCORE: number;
  RARITY_SCORE: number;
  PROVENANCE_CLARITY: number;
}

export interface RPT1Payload {
  prediction_config: PredictionConfig;
  index_column: string;
  rows: StolenItem[];
}
```

> 💡 **Why define types for the payload?**
>
> You could skip this and just pass a plain object (`{}`) directly to the API call. It would work. But defining these interfaces gives you three concrete benefits in this project:
>
> **1. The compiler catches shape mismatches before they reach the API.**
>
> The RPT-1 API is strict about its input structure. If you accidentally write `predictionConfig` instead of `prediction_config`, or pass a string where a number is expected the API would return an error; a plain object gives you no warning. With typed interfaces, TypeScript flags the mistake immediately in your editor, before you ever run the code.
>
> **2. Each interface maps to one layer of the JSON structure.**
>
> Rather than one large flat type, the types mirror how the payload is actually nested:
>
> - `RPT1Payload` is the root object sent to the API
> - `PredictionConfig` describes what to predict
> - `PredictionTargetColumn` describes a single prediction target
> - `StolenItem` describes one row of data
>
> This makes it easy to understand where each field lives and which part of the payload you are working with at any point in the code.
>
> **3. Union types document the allowed values explicitly.**
>
> Two fields use union types to express constraints directly in the type:
>
> - `task_type: "regression" | "classification"`, a **string literal union**. TypeScript will reject any other string at compile time. This documents the two valid RPT-1 task types and prevents typos like `"Regression"` or `"classify"` from reaching the API.
> - `INSURANCE_VALUE: number | string`, a **value union**. Most items have a known numeric value such as `45000000`. Items with a missing value use the string placeholder `"'[PREDICT]'"`. The union type captures this reality: the field can legitimately be either type depending on whether the value is known or needs to be predicted.
>
> Without these union types you would need to remember these constraints yourself and hope you never make a mistake. With them, the compiler enforces the contract automatically.
>
> **A note on architecture: these types expose the API contract**
>
> The types above mirror the RPT-1 API's JSON structure directly, including the uppercase field names (`INSURANCE_VALUE`, `ITEM_ID`) that are characteristic of an external API or database schema. This means the rest of the application is coupled to how RPT-1 expects its input. If the API changes its field names or structure, that change propagates to every file that constructs or reads these types.
>
> In production code you would typically hide this by introducing an **Anti-Corruption Layer**: define a domain model in the language of your application (e.g. `StolenArtwork` with camelCase fields like `itemId`, `insuranceValue`), keep the API-shaped types private inside `rptClient.ts`, and have the client translate between the two formats internally. The rest of the application would never see `RPT1Payload` at all.
>
> For this workshop we keep the API types public to reduce complexity. Introducing a mapping layer before you have run your first tool call would obscure the concepts being taught. Just be aware that in a production agent application, this boundary is worth enforcing.

---

## Build the SAP-RPT-1 Client

### Create the RptClient Wrapper

The `@sap-ai-sdk/rpt` package is included in the SDK and provides a typed client for the SAP-RPT-1 model.

👉 Create a new file [`/project/JavaScript/starter-project/src/rptClient.ts`](/project/JavaScript/starter-project/src/rptClient.ts)

👉 Add the following code:

```typescript
import { RptClient } from "@sap-ai-sdk/rpt";
import type { RPT1Payload } from "./types.js";

export class RPT1Client {
  private client: RptClient;

  constructor() {
    this.client = new RptClient({
      modelName: "sap-rpt-1-large",
      resourceGroup: process.env.RESOURCE_GROUP!,
    });
  }

  async predictWithoutSchema(payload: RPT1Payload): Promise<any> {
    const prediction = await this.client.predictWithoutSchema(payload as any);
    return prediction;
  }
}
```

> 💡 **Understanding the wrapper class:**
>
> - `RptClient` from `@sap-ai-sdk/rpt` handles authentication and the API call automatically: no OAuth token fetching needed.
> - **`modelDeployment` parameter**: the constructor accepts a `{ modelName, resourceGroup }` object matching the SDK's `ModelDeployment` type. The default uses `sap-rpt-1-large` and reads `RESOURCE_GROUP` from your `.env`. If multiple RPT-1 models are deployed in different resource groups, you can override both fields when instantiating `RPT1Client`.
> - `payload as any`: the `RPT1Payload` type we defined and the SDK's internal `PredictionData` type describe the same JSON structure, but TypeScript does not know that. They are two separate type definitions written independently (one by us, one by the SDK authors) so TypeScript treats them as incompatible and refuses to accept one where the other is expected. The `as any` cast tells TypeScript to stop checking the type for this one call. The JSON that reaches the API at runtime is identical either way; this is purely a compile-time compatibility issue between two type definitions.
> - `Promise<any>`: the return type is `any` because the SDK's `PredictResponsePayload` type is complex and we don't need to type it precisely here.

---

## Add the Tool to Your Agent

### Step 1: Create the Tool Function

In LangGraph, **tools are just regular TypeScript functions**: no decorators, no schema wrappers required. Your agent node calls them directly. This is different from CrewAI's `@tool` decorator pattern: because you control exactly when and how the tool is called, you don't need the framework to discover or invoke it.

👉 Create a new file [`/project/JavaScript/starter-project/src/tools.ts`](/project/JavaScript/starter-project/src/tools.ts)

👉 Add the RPT-1 tool function:

```typescript
import { RPT1Client } from "./rptClient.js";
import type { RPT1Payload } from "./types.js";

const rpt1Client = new RPT1Client();

export async function callRPT1Tool(payload: RPT1Payload): Promise<string> {
  try {
    const response = await rpt1Client.predictWithoutSchema(payload);
    return JSON.stringify(response, null, 2);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ RPT-1 call failed:", errorMessage);
    return `Error calling RPT-1: ${errorMessage}`;
  }
}
```

> 💡 **Why define the client at module level?**
>
> The `RPT1Client` is created once when the module loads, not on every call. This avoids redundant initialization and prevents SDK warning messages from appearing multiple times.

### Step 2: Update the Appraiser Node

Now update your `basicAgent.ts` to import the payload and tool, then call the tool from the appraiser node.

👉 Update `basicAgent.ts` to call the RPT-1 tool:

```typescript
import "dotenv/config";
import { StateGraph, END, START } from "@langchain/langgraph";
import { callRPT1Tool } from "./tools.js";
import { payload } from "./payload.js";
import type { AgentStateType } from "./types.js";
import { AgentState } from "./types.js";

async function appraiserNode(
  state: AgentStateType,
): Promise<Partial<AgentStateType>> {
  console.log("\n🔍 Appraiser Agent starting...");

  const result = await callRPT1Tool(payload);

  const appraisalResult = `Insurance Appraisal Complete: ${result}
  Summary: Successfully predicted missing insurance values and item categories for the stolen artworks.`;

  console.log("✅ Appraisal complete");

  return {
    appraisal_result: appraisalResult,
    messages: [
      ...state.messages,
      { role: "assistant", content: appraisalResult },
    ],
  };
}
```

### Step 3: Update the Initial State

👉 Update the `app.invoke()` call in `basicAgent.ts` to pass the initial state directly:

```typescript
const result = await app.invoke({
  suspect_names: "Sophie Dubois, Marcus Chen, Viktor Petrov",
  messages: [],
});
```

### Step 4: Run Your Agent with the RPT-1 Tool

👉 Run your agent to test the tool:

```bash
npx tsx src/basicAgent.ts
```

You should see the RPT-1 model predicting the missing insurance values and item categories for the stolen artworks.

> SAP-RPT-1 not only predicts missing values marked with `[PREDICT]` but also returns a confidence score for classification tasks, indicating how confident the model is in its predictions.

---

## Understanding Tools in LangGraph

### What Just Happened?

You extended your agent with:

1. **A payload file** with real data about stolen artworks, including items with missing values marked `[PREDICT]`
2. **An RPT-1 client** that wraps the `@sap-ai-sdk/rpt` SDK
3. **A tool function** that the agent node calls directly to get real predictions

### The Tool Flow

```mermaid
flowchart LR
    A[Agent Node] --> B[callRPT1Tool]
    B --> C[RPT1Client]
    C --> D[SAP AI Core]
    D --> E[Prediction Response]
    E --> F[State Update]
```

### Why This Matters

Tools are essential for agents to:

- **Access External APIs** and services (like the RPT-1 model)
- **Perform Real Actions** beyond text generation
- **Provide Grounded Responses** based on actual data and computations
- **Enable Autonomous Operation** by expanding the agent's capabilities

### Tools in LangGraph vs CrewAI

In CrewAI, tools are Python functions decorated with `@tool()` and the framework uses them as "callable skills" the LLM can choose to invoke. The LLM decides when to call a tool based on the task description.

In LangGraph, **you decide when a tool is called**: it's a regular function call inside your node. This gives you more control and makes the code easier to understand and debug. There is no ambiguity about whether the tool gets invoked.

```typescript
// LangGraph: explicit tool call in your node
async function appraiserNode(state: AgentStateType) {
    const result = await callRPT1Tool(payload) // you call it directly
    ...
}
```

For more complex scenarios (LLM-driven tool selection), LangGraph also supports tool-calling with `bind_tools()`, but for this workshop, direct calls keep things simple and reliable. Using `bind_tools()` allows for providing a set of tools to an agent whereas if you only have one tool calling it directly makes the code easier to understand.

---

## Key Takeaways

- **Tools are plain functions** in LangGraph: no decorators or wrappers needed
- **`@sap-ai-sdk/rpt`** provides a ready-to-use typed client for SAP-RPT-1
- **`as any` cast** bridges the gap between your custom types and SDK internal types
- **Module-level client initialization** avoids repeated setup and SDK warnings
- **You control tool invocation** in LangGraph: the node explicitly calls the tool function

---

## Next Steps

In the following exercises, you will:

1. ✅ [Understand Generative AI Hub](00-understanding-genAI-hub.md)
2. ✅ [Set up your development space](01-setup-dev-space.md)
3. ✅ [Build a basic agent](02-build-a-basic-agent.md)
4. ✅ Add custom tools to your agents so they can access external data (this exercise)
5. 📌 [Build a multi-agent workflow](04-building-multi-agent-system.md) with LangGraph
6. 📌 [Integrate the Grounding Service](05-add-the-grounding-service.md) for evidence analysis
7. 📌 [Solve the museum art theft mystery](06-solve-the-crime.md) using your fully-featured agent team

---

## Troubleshooting

**Issue**: `Error calling RPT-1: 401 Unauthorized`

- **Solution**: Verify that your `RESOURCE_GROUP` environment variable is set to `ai-agents-codejam` and your SAP AI Core credentials are correct in `.env`.

**Issue**: `TypeError: Cannot read properties of undefined` when calling `predictWithoutSchema`

- **Solution**: Ensure `RptClient` is initialized after `dotenv/config` is imported. Check that `process.env.RESOURCE_GROUP` is not `undefined`.

**Issue**: `ModuleNotFoundError: Cannot find module './rptClient.js'`

- **Solution**: Note the `.js` extension in the import path. This is required for TypeScript ESM modules even when the source file is `.ts`. This is a TypeScript/Node.js ESM convention.

**Issue**: RPT-1 returns a `400` or `422` error

- **Solution**: Check that your payload structure matches the expected format. The `prediction_placeholder` must be exactly `"'[PREDICT]'"` (with inner single quotes).

---

## Resources

- [SAP-RPT-1 Playground](https://rpt.cloud.sap/)
- [SAP Cloud SDK for AI — RPT Package](https://github.com/SAP/ai-sdk-js/tree/main/packages/rpt)
- [LangGraph.js Documentation](https://langchain-ai.github.io/langgraphjs/)
- [SAP Generative AI Hub](https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/generative-ai-hub-in-sap-ai-core-7db524ee75e74bf8b50c167951fe34a5)

[Next exercise](04-building-multi-agent-system.md)
