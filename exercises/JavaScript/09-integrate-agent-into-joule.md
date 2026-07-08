# Integrate Your Agent into SAP Joule

## Overview

Your investigator graph is deployed to Cloud Foundry and speaks A2A. But right now, only developers who know the A2A protocol can talk to it. In this exercise, you'll connect your agent to **SAP Joule** — SAP's AI copilot — so that any business user can interact with it through natural language in the Joule chat interface.

To do that, you'll create a **Joule capability**: a set of YAML files that tell Joule what your agent can do, how to reach it, and how to display its responses.

By the end of this exercise, your investigator graph will be:

- ✅ Discoverable by Joule through a scenario description
- ✅ Callable from the Joule chat via the A2A protocol
- ✅ Deployed as a Joule capability using the Joule Studio CLI

---

## Understand Joule Capabilities

### What is a Capability?

A **capability** is a package of skills that you add to Joule. It's defined entirely in YAML — no JavaScript or Python needed. Joule uses these YAML files to understand what your agent can do and how to call it.

| Concept | What it is | Example |
|---|---|---|
| **Capability** | A group of skills packaged together | `investigator_capability` |
| **Scenario** | A user-facing skill description — Joule matches user questions against it | "Investigate an art theft" |
| **Function** | The executable logic a scenario triggers | Calls the A2A agent endpoint |
| **System Alias** | A named reference to a BTP Destination | `INVESTIGATOR_AGENT` |
| **Digital Assistant** | The top-level config that assembles capabilities | `da.sapdas.yaml` |

### How the Pieces Fit Together

```text
User asks: "Investigate the art theft"
  │
  ▼
SAP Joule
  │
  ├── 1. Scenario Matching
  │      Joule reads all scenario descriptions and picks the best match
  │
  ├── 2. Function Execution
  │      The matched scenario triggers a function
  │
  ├── 3. agent-request Action
  │      The function calls your A2A agent via a BTP Destination
  │
  ├── 4. BTP Destination → Cloud Foundry
  │      Routes the request to your deployed app
  │
  ├── 5. InvestigationWorkflow runs
  │      Your LangGraph nodes do the investigation
  │
  └── 6. Response displayed in Joule chat
         The function extracts the result and shows it to the user
```

> 💡 **Key insight:** Joule doesn't need to know that your agent uses LangGraph, TypeScript, or any specific framework. It only speaks A2A — the same protocol you set up in Exercise 08. The capability YAML is just the bridge between Joule's chat UI and your A2A endpoint.

---

## Install the Joule Studio CLI

The **Joule Studio CLI** is the command-line tool for building, deploying, and testing Joule capabilities.

### Step 1: Check Your Node.js Version

The CLI requires **Node.js v20.12.0 – v24**.

👉 Check your installed version:

```bash
node -v
```

> ⚠️ **If your version is below 20.12.0 or above 24**, download a compatible version from [https://nodejs.org/en/download/releases/](https://nodejs.org/en/download/releases/).

### Step 2: Install the CLI

👉 Run the following command to install the Joule Studio CLI globally:

```bash
npm install -g @sap/joule-studio-cli
```

👉 Verify the installation:

```bash
joule -V
```

You should see a version number printed (e.g., `1.0.90`).

> 💡 **What does the CLI do?** It handles the full lifecycle of Joule capabilities: linting YAML files for errors, compiling them into deployable archives (`.daar` files), deploying to your Joule instance, and launching a test client. Think of it as `cf push` but for Joule.

---

## Log In to Joule

Before you can deploy anything, the CLI needs to authenticate against your Joule instance.

> 💡 **For this CodeJam**, your instructor will provide the login credentials. You do **not** need to set up IAS applications or client secrets yourself.

### Step 1: Get Your Credentials

👉 Your instructor will provide the following values:

| Field | Description | Example |
|---|---|---|
| **Authentication URL** | Your IAS tenant URL | `https://<tenant-id>.accounts.ondemand.com` |
| **API URL** | The Joule API endpoint | `https://<subdomain>.<region>.sapdas.cloud.sap` |
| **Client ID** | OAuth client identifier | `abc123-...` |
| **Client Secret** | OAuth client secret | (provided by instructor) |
| **Username** | Your BTP user email | `your.email@example.com` |
| **Password** | Your BTP user password | (your password) |

### Step 2: Log In

👉 Run the login command and enter the values when prompted:

```bash
joule login
```

The CLI will prompt you interactively:

```text
✔ Authentication URL: https://<tenant-id>.accounts.ondemand.com
✔ API URL: https://<subdomain>.<region>.sapdas.cloud.sap
✔ Instance Client ID: <client-id>
✔ Instance Client Secret: <client-secret>
✔ Username: your.email@example.com
✔ Password: ********

API URL: https://<subdomain>.<region>.sapdas.cloud.sap
You are logged in as your.email@example.com
```

### Step 3: Verify

👉 Confirm your session is active:

```bash
joule status
```

> 💡 **Tip:** Your login session will expire after some time. If a later command fails with an authentication error, simply run `joule login` again.

---

## Create the BTP Destination

The `agent-request` action in your Joule function doesn't call your CF app directly. Instead, it goes through a **BTP Destination** — a named HTTP endpoint registered in the SAP BTP cockpit. This decouples your capability YAML from the physical URL of your agent.

### Step 1: Open the BTP Cockpit

👉 Navigate to your **BTP Subaccount** → **Connectivity** → **Destinations**.

### Step 2: Create a New Destination

👉 Click **New Destination** and fill in the following values:

| Field | Value |
|---|---|
| **Name** | `INVESTIGATOR_AGENT_XX` |
| **Type** | HTTP |
| **URL** | `https://investigator-graph-ts-<your-app-route>.cfapps.eu10-004.hana.ondemand.com` |
| **Proxy Type** | Internet |
| **Authentication** | NoAuthentication |

> ⚠️ **Replace `XX` with your participant number** (e.g., `INVESTIGATOR_AGENT_01`, `INVESTIGATOR_AGENT_02`). This ensures each participant has a unique destination. You'll use this exact name in all YAML files below.

> ⚠️ **Replace `<your-app-route>`** with the actual route of your CF app from Exercise 08. You can find it by running `cf apps` or by checking the URL you noted at the end of Exercise 08.

👉 Click **Save**.

> 💡 **How does Joule use this destination?**
>
> When Joule triggers an `agent-request`, it:
> 1. Looks up the **system alias** in your capability YAML
> 2. Resolves it to the **BTP Destination** name
> 3. Uses the destination's URL to call `GET /.well-known/agent.json` on your agent
> 4. Reads the Agent Card to discover the communication endpoint and protocol
> 5. Sends an A2A `message/send` request with the user's message
>
> This is the same discovery flow you tested manually with `curl` in Exercise 08 — now Joule does it automatically.

---

## Create the Joule Capability

Now you'll create the YAML files that define your Joule capability. These files tell Joule:
- **What** your agent can do (scenario)
- **How** to call it (function with `agent-request`)
- **Where** to find it (system alias → BTP Destination)

### Project Structure

The complete directory structure you'll create:

```text
/project/JavaScript/starter-project/joule/
├── investigator_capability/
│   ├── functions/
│   │   └── investigate_function.yaml
│   ├── scenarios/
│   │   └── investigate_scenario.yaml
│   └── capability.sapdas.yaml
└── da.sapdas.yaml
```

### Step 1: Create the Directory Structure

👉 From your terminal, create the directories:

```bash
# macOS / Linux
mkdir -p project/JavaScript/starter-project/joule/investigator_capability/functions
mkdir -p project/JavaScript/starter-project/joule/investigator_capability/scenarios
```

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Path project\JavaScript\starter-project\joule\investigator_capability\functions -Force
New-Item -ItemType Directory -Path project\JavaScript\starter-project\joule\investigator_capability\scenarios -Force
```

> 💡 **In Business Application Studio (BAS):** You can create the folders visually instead. Right-click the `starter-project` folder in the Explorer panel and choose **New Folder**. Create `joule`, then inside it `investigator_capability`, and inside that `functions` and `scenarios`.

### Step 2: Create capability.sapdas.yaml

This is the root configuration file for your capability. It defines metadata, the schema version, and the system aliases that map to BTP Destinations.

👉 Create a new file [`/project/JavaScript/starter-project/joule/investigator_capability/capability.sapdas.yaml`](/project/JavaScript/starter-project/joule/investigator_capability/capability.sapdas.yaml):

```yaml
schema_version: 3.28.0

metadata:
  namespace: joule.ext
  name: investigator_capability
  version: 1.0.0
  display_name: Investigator_Capability
  description: Capability containing the investigator graph agent for art theft investigation

system_aliases:
  INVESTIGATOR_AGENT:
    destination: INVESTIGATOR_AGENT_XX
```

> ⚠️ **Replace `XX`** in `destination` only with your participant number (e.g., `INVESTIGATOR_AGENT_01`). This must match the BTP Destination name you created in the previous section. The system alias key (`INVESTIGATOR_AGENT`) stays the same for everyone — only the destination name is unique per participant.

> 💡 **Understanding each field:**
>
> | Field | Purpose |
> |---|---|
> | `schema_version: 3.28.0` | Minimum schema version that supports code-based agents via `agent-request`. Using a lower version will cause a compile error. |
> | `namespace: joule.ext` | **Required** for all custom capabilities. Any other namespace is treated as an SAP-internal namespace and will fail deployment. |
> | `name` | Internal identifier for the capability. Must be unique within your Joule instance. |
> | `display_name` | Human-readable name shown in Joule Studio. Alphanumeric + underscore + hyphen only. |
> | `description` | Short description of what this capability does (max 512 chars). |
> | `system_aliases` | Maps a logical name (used in function YAMLs) to a BTP Destination name. The key (`INVESTIGATOR_AGENT`) is referenced by the `system_alias` field in the function. |

### Step 3: Create the Scenario

The scenario is what Joule uses to match user requests to your capability. When a user types a question, Joule compares it against all scenario descriptions and picks the best match.

👉 Create a new file [`/project/JavaScript/starter-project/joule/investigator_capability/scenarios/investigate_scenario.yaml`](/project/JavaScript/starter-project/joule/investigator_capability/scenarios/investigate_scenario.yaml):

```yaml
description: >-
  This skill investigates art theft cases by appraising the value of stolen
  items, analyzing evidence from security logs, bank records, phone records,
  and criminal histories, and identifying the most likely suspect based on
  available evidence. It coordinates multiple specialist agents to deliver
  a comprehensive investigation report.
target:
  name: investigate_function
  type: function
```

> 💡 **Understanding the scenario:**
>
> | Field | Purpose |
> |---|---|
> | `description` | The text Joule uses for intent matching. Write it like you're explaining the skill to a colleague — specific, clear, keyword-rich. Joule's language model evaluates this against the user's message to decide whether to activate this scenario. |
> | `target.name` | References the function YAML file name (without `.yaml`). When this scenario is triggered, Joule runs this function. |
> | `target.type: function` | Currently the only supported target type. Tells Joule to execute a dialog function. |
>
> **Writing good descriptions matters.** If the description is too vague ("helps with investigations"), Joule may not match it reliably. If it's too narrow ("only for the Grand Museum heist"), it won't match variations. The description above includes multiple keywords: "art theft", "stolen items", "evidence", "security logs", "suspect", "investigation report".

> ⚠️ **The `investigate_function` does not exist yet** — you'll create it in the next step. If you run `joule lint` now, it will report that the target function is missing. That is expected. Continue to Step 4 to resolve it.

### Step 4: Create the Function

The function is where the action happens. It defines the `agent-request` action that calls your A2A agent and a `message` action that displays the result.

> 💡 **In Business Application Studio (BAS):** Right-click the `functions` folder in the Explorer panel and choose **New File** to create the file below.

👉 Create a new file [`/project/JavaScript/starter-project/joule/investigator_capability/functions/investigate_function.yaml`](/project/JavaScript/starter-project/joule/investigator_capability/functions/investigate_function.yaml):

```yaml
action_groups:
  - actions:
      - type: agent-request
        system_alias: INVESTIGATOR_AGENT
        agent_type: remote
        result_variable: "apiResponse"
      - type: message
        message:
          type: text
          markdown: true
          content: "<? apiResponse.body.artifacts[0].parts[0].text ?>"
```

> 💡 **Understanding the `agent-request` action:**
>
> | Field | Purpose |
> |---|---|
> | `type: agent-request` | Tells Joule to call an external agent using the A2A protocol (available since DTA schema v3.28.0). |
> | `system_alias: INVESTIGATOR_AGENT` | References the system alias from `capability.sapdas.yaml`, which maps to your participant-specific BTP Destination. |
> | `agent_type: remote` | Specifies this is a **code-based** (Bring Your Own Agent) agent hosted outside of Joule. Use `local` for content-based agents built inside the Joule framework. |
> | `result_variable: "apiResponse"` | Stores the full A2A response in a variable. You access it in subsequent actions using SpEL expressions. |

> 💡 **Understanding the `message` action:**
>
> | Field | Purpose |
> |---|---|
> | `type: message` | Sends a message back to the user in the Joule chat. |
> | `type: text` | The message format. Joule also supports `card`, `list`, `carousel`, and other rich formats. |
> | `markdown: true` | Tells Joule to render the response as formatted markdown. Without this, Joule displays the raw text including all the `#`, `**`, and `-` characters. With it, headers, bullet points, and bold text are rendered properly — making the investigation report significantly more readable in the chat. |
> | `content` | The message text. The `<? ... ?>` delimiters indicate a **SpEL expression** — Joule's scripting language for extracting values from variables. |

### Understanding the A2A Response

When the `agent-request` action calls your CF app, it sends the user's message via the A2A protocol and receives a response. The response is stored in `apiResponse` and has this structure:

```json
{
  "headers": {},
  "body": {
    "kind": "task",
    "contextId": "abc-123-def-456",
    "history": [
      {
        "role": "user",
        "kind": "message",
        "parts": [{ "kind": "text", "text": "Investigate the art theft..." }]
      }
    ],
    "artifacts": [
      {
        "name": "investigation_result",
        "parts": [
          {
            "kind": "text",
            "text": "Based on the investigation, the primary suspect is..."
          }
        ],
        "artifactId": "investigation_result"
      }
    ],
    "status": {
      "state": "completed"
    }
  }
}
```

The expression `apiResponse.body.artifacts[0].parts[0].text` walks this JSON path:

| Path segment | What it accesses |
|---|---|
| `apiResponse` | The full response variable |
| `.body` | The A2A task response body |
| `.artifacts[0]` | The first artifact — your `investigation_result` from `src/server.ts` |
| `.parts[0]` | The first part of that artifact |
| `.text` | The actual text content of the investigation result |

> 💡 **This maps directly to what you built in Exercise 08.** In `src/server.ts`, your `InvestigatorExecutor` emits a `TaskArtifactUpdateEvent` with `artifactId: "investigation_result"` and `parts: [{ kind: "text", text: result }]` — the output of `new InvestigationWorkflow(...).kickoff(...)`. That's exactly what Joule reads here through `artifacts[0].parts[0].text`.

### Step 5: Create the Digital Assistant Descriptor

The `da.sapdas.yaml` file is the top-level manifest. It tells the Joule CLI which capabilities to include when compiling and deploying.

👉 Create a new file [`/project/JavaScript/starter-project/joule/da.sapdas.yaml`](/project/JavaScript/starter-project/joule/da.sapdas.yaml):

```yaml
schema_version: 1.4.0

name: investigator_assistant

capabilities:
  - type: local
    folder: ./investigator_capability
```

> 💡 **Understanding the DA file:**
>
> | Field | Purpose |
> |---|---|
> | `schema_version: 1.4.0` | Version of the Digital Assistant schema (separate from the capability schema). |
> | `name` | The name of the assistant. Used when deploying with `joule deploy -n`. |
> | `capabilities` | List of capabilities to include. `type: local` means the capability is in a local folder (as opposed to a remote reference). |
> | `folder` | Path to the capability directory, relative to this file. |

---

## Deploy the Capability

With all YAML files in place, you can now compile and deploy the capability to your Joule instance.

### Step 1: Navigate to the Joule Directory

👉 Change to the directory containing your `da.sapdas.yaml`:

```bash
cd project/JavaScript/starter-project/joule
```

### Step 2: Compile and Deploy

👉 Run the following command to compile the YAML files and deploy them as a test assistant:

```bash
joule deploy -c -n "investigator_assistant_XX"
```

> ⚠️ **Replace `XX`** with your participant number (e.g., `investigator_assistant_01`).

> 💡 **Understanding the flags:**
>
> | Flag | Purpose |
> |---|---|
> | `-c` | Compile before deploying. This validates your YAML files against the schema, checks for errors, and packages them into a `.daar` archive (Design-time Artifact Archive). |
> | `-n "investigator_assistant_XX"` | Name of the test assistant to create. Using `-n` creates a standalone assistant for testing — it doesn't affect the production Joule instance. |

You should see output similar to:

```text
✔ Building designtime artifact (investigator_capability)
✔ Trigger compilation
✔ Compiled

Detailed logs:
WARNINGS:
Message:             DTA did not define an optional i18n folder
Path:
Category:            I18N
Severity:            LOW

✔ Downloaded runtime artifact (joule.ext_investigator_capability_1.0.0.daar)
✔ Building runtime artifact
  > joule.ext_investigator_capability_1.0.0.daar added to the RTA
✔ Triggering deployment (investigator_assistant_XX)
✔ Your digital assistant (investigator_assistant_XX) deployed successfully
```

> 💡 **The i18n warning is expected** — it just means you haven't added localization files, which are optional for this exercise.

### Step 3: Verify Deployment

👉 List your deployed assistants to confirm:

```bash
joule list
```

You should see `investigator_assistant_XX` in the list.

---

## Test in Joule

### Step 1: Launch the Test Client

👉 Open the Joule web client for your test assistant:

```bash
joule launch "investigator_assistant_XX"
```

This opens a browser tab with the Joule chat interface connected to your test assistant.

### Step 2: Send a Test Message

👉 In the Joule chat, type:

```text
Investigate the art theft at the museum. The suspects are Sophie Dubois, Marcus Chen, and Viktor Petrov.
```

> ⚠️ **The investigation takes 1–2 minutes** because the full LangGraph pipeline runs on Cloud Foundry: the Appraiser calls RPT-1, the Evidence Analyst queries the Grounding Service, and the Lead Detective synthesizes the findings. Joule's synchronous timeout is 60 seconds — if your graph takes longer, you may see a timeout error. If this happens, try a simpler request or check the troubleshooting section below.

### Step 3: Review the Response

If everything is connected correctly, Joule displays the investigation result directly in the chat — the same markdown report your graph generates, now accessible through a conversational interface.

> 💡 **What just happened behind the scenes:**
> 1. You typed a question in Joule
> 2. Joule matched your question to `investigate_scenario` based on the description
> 3. The scenario triggered `investigate_function`
> 4. The function's `agent-request` action called your BTP Destination
> 5. The destination routed to your CF app's A2A endpoint
> 6. Your `InvestigatorExecutor` ran `new InvestigationWorkflow(...).kickoff(...)` — the full LangGraph pipeline
> 7. The result came back as an A2A artifact
> 8. The function's `message` action extracted the text and displayed it in Joule

---

## Understanding What Just Happened

### The Full Architecture

You now have a complete end-to-end pipeline from Joule's chat UI to your LangGraph system:

```text
User
  │
  ▼
SAP Joule (Chat UI)
  │
  ├── Scenario Match → investigate_scenario
  │                         │
  │                         ▼
  │                    investigate_function
  │                         │
  │                         ├── agent-request (A2A over HTTPS)
  │                         │         │
  │                         │         ▼
  │                         │    BTP Destination: INVESTIGATOR_AGENT_XX
  │                         │         │
  │                         │         ▼
  │                         │    CF App: investigator-graph-ts-<YOUR NAME>
  │                         │         │
  │                         │         ▼
  │                         │    InvestigatorExecutor → InvestigationWorkflow.kickoff(...)
  │                         │         ├── Appraiser Node (RPT-1)
  │                         │         ├── Evidence Analyst Node (Grounding)
  │                         │         └── Lead Detective Node (GPT-4o)
  │                         │         │
  │                         │         ▼
  │                         │    A2A Response (artifacts[0].parts[0].text)
  │                         │
  │                         ├── message → Displays result to user
  │                         │
  ▼                         ▼
User sees investigation result in Joule chat
```

### How Each Layer Communicates

| Step | Component | Protocol | What happens |
|---|---|---|---|
| 1 | User → Joule | Chat UI | User types a question in natural language |
| 2 | Joule → Scenario | Internal | Joule matches the question to the best scenario description |
| 3 | Scenario → Function | Internal | The matched scenario triggers the linked function |
| 4 | Function → Destination | HTTP | The `agent-request` action resolves the system alias to a BTP Destination |
| 5 | Destination → CF App | HTTPS | The destination routes to your Cloud Foundry app URL |
| 6 | CF App → LangGraph | Internal | The `InvestigatorExecutor` runs `new InvestigationWorkflow(...).kickoff(...)` |
| 7 | LangGraph → Response | A2A JSON-RPC | The result is returned as an A2A `TaskArtifactUpdateEvent` |
| 8 | Function → User | Chat UI | The `message` action extracts the text and shows it in Joule |

---

## Key Takeaways

- **Joule capabilities** are YAML-based packages that extend Joule with custom skills — no runtime code needed on the Joule side
- **`agent-request`** is the action type that bridges Joule to external agents via the A2A protocol
- **`agent_type: remote`** distinguishes code-based agents (your CF app) from content-based agents built inside Joule
- **System aliases** decouple the capability from the physical URL — the BTP Destination handles routing, so you can change the URL without redeploying the capability
- **`schema_version: 3.28.0`** is the minimum DTA version required for code-based agent support
- **The Joule Studio CLI** provides a complete workflow: `login` → `deploy` → `launch` → `update`
- **The A2A protocol** enables framework-agnostic integration — Joule doesn't care whether your agent uses LangGraph, Python, or any other framework

---

## Next Steps

1. ✅ [Set up your development space](01-setup-dev-space.md)
2. ✅ [Build a basic agent](02-build-a-basic-agent.md)
3. ✅ [Add custom tools](03-add-your-first-tool.md)
4. ✅ [Build a multi-agent system](04-building-multi-agent-system.md)
5. ✅ [Add the Grounding Service](05-add-the-grounding-service.md)
6. ✅ [Discover Connected Crimes](06-discover-connected-crimes.md)
7. ✅ [Solve the crime](07-solve-the-crime.md)
8. ✅ [Deploy your agent to CF with A2A](08-deploy-agent-to-cf-ts.md)
9. ✅ [Integrate your agent into SAP Joule](09-integrate-agent-into-joule.md) (this exercise)

🎉 **Congratulations!** You've completed the full CodeJam. You built a multi-agent AI system from scratch using LangGraph (TypeScript), deployed it to Cloud Foundry as an A2A server, and integrated it into SAP Joule — making it accessible to business users through natural language.

---

## Troubleshooting

**Issue**: `joule: command not found` after installing

- **Solution**: The global npm bin directory may not be in your PATH. Run `npm config get prefix` — the result + `/bin` should be in your PATH. On macOS/Linux, add it to your shell profile (e.g., `export PATH="$(npm config get prefix)/bin:$PATH"`).

**Issue**: `joule login` fails with an authentication error

- **Solution**: Double-check all credentials with your instructor. Common mistakes:
  - Trailing spaces in the Auth URL or API URL
  - Wrong Client ID / Client Secret pair
  - Password with special characters that need escaping (`$` → `\$`)
  - Expired or incorrect IAS credentials

**Issue**: `joule deploy` fails with a schema version error

- **Solution**: Ensure `schema_version: 3.28.0` in `capability.sapdas.yaml`. The `agent-request` action type requires this minimum version. Lower versions like `3.26.0` will not recognize the action.

**Issue**: `joule deploy` fails with "User is not authorized to deploy sap capabilities"

- **Solution**: Your `namespace` must be `joule.ext`. Any other namespace (e.g., `joule.custom`, `my.namespace`) is treated as an SAP-internal namespace and requires special permissions.

**Issue**: Deployment fails with "destination not found" or agent-request returns an error

- **Solution**: Verify that:
  1. The BTP Destination name (`INVESTIGATOR_AGENT_XX`) matches **exactly** the `destination` value in `capability.sapdas.yaml`'s `system_aliases` block
  2. The system alias key is `INVESTIGATOR_AGENT` (no XX) in both `capability.sapdas.yaml` and `investigate_function.yaml`
  3. The destination exists in the BTP cockpit under Connectivity → Destinations
  4. The destination URL is correct and your CF app is running (`cf apps`)

**Issue**: Joule responds with an empty message or an error

- **Solution**: Your CF app may have crashed or returned an unexpected response. Check:
  - App status: `cf apps`
  - App logs: `cf logs investigator-graph-ts-<YOUR NAME> --recent`
  - Health endpoint: `curl https://<your-app-url>/health`
  - Ensure the Agent Card is accessible: `curl https://<your-app-url>/.well-known/agent.json`

**Issue**: "Scenario not matched" — Joule doesn't recognize your question

- **Solution**: Joule's intent matching depends on the scenario description. Try rephrasing your question to include keywords from the description: "investigate", "art theft", "stolen items", "suspects", "evidence". If testing with a standalone assistant, ensure the capability was deployed successfully with `joule list`.

**Issue**: Timeout error — the agent takes too long to respond

- **Solution**: Joule expects a synchronous response within **60 seconds**. The full LangGraph pipeline may take longer. Options:
  - Try a simpler request that requires less processing
  - Check `cf logs investigator-graph-ts-<YOUR NAME> --recent` to see where time is spent
  - Ensure your CF app has enough memory (512M in `manifest.yml`)
  - Consider reducing the number of grounding service queries in the Evidence Analyst node

**Issue**: YAML indentation or compile errors

- **Solution**: YAML is whitespace-sensitive — use **2 spaces** for indentation, never tabs. Common mistakes:
  - Mixed tabs and spaces
  - Missing space after `:` in key-value pairs
  - Incorrect nesting of `actions` under `action_groups`
  - Run `joule lint` to check for errors before deploying

---

## Resources

- [Joule Development Guide](https://help.sap.com/docs/joule/joule-development-guide-ba88d1ec6a1b442098863d577c19b0c0/joule-development)
- [Code-Based Agents (Bring Your Own Agent)](https://help.sap.com/docs/joule/joule-development-guide-ba88d1ec6a1b442098863d577c19b0c0/code-based-agents-bring-your-own-agent)
- [Install and Update the Joule Studio CLI](https://help.sap.com/docs/joule/joule-development-guide-ba88d1ec6a1b442098863d577c19b0c0/install-and-update-joule-studio-cli)
- [A2A Protocol Specification](https://a2a-protocol.org/latest/)
- [SAP BTP Destinations Documentation](https://help.sap.com/docs/connectivity/sap-btp-connectivity-cf/create-http-destinations)
- [Blog: Joule A2A — Connect Code-Based Agents into Joule](https://community.sap.com/t5/technology-blog-posts-by-sap/joule-a2a-connect-code-based-agents-into-joule/ba-p/14329279)
