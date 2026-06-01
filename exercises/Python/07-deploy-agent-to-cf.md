# Deploy Your Agent to Cloud Foundry with A2A

## Overview

Your investigator crew is working great locally. But right now, it only runs on your machine. In this exercise, you'll expose it as a **web service** that anyone (or any other agent) can call remotely, and deploy it to **SAP BTP Cloud Foundry**.

To do that, you'll use the **A2A protocol** (Agent-to-Agent), an open standard that lets AI agents communicate with each other over HTTP — regardless of which framework or platform they were built on.

By the end of this exercise, your investigator crew will be:

- ✅ Running as a persistent HTTP server
- ✅ Reachable via a public URL on SAP BTP
- ✅ Discoverable by other agents through the A2A standard

---

## Understand the A2A Protocol

### What is A2A?

**A2A (Agent-to-Agent)** is an open protocol, [originally developed by Google](https://a2a-protocol.org/latest/), that standardizes how AI agents communicate with each other over HTTP. Think of it as REST for agents.

| Concept | What it is | Example |
|---|---|---|
| **Agent Card** | A JSON document describing what an agent can do | "I can investigate art thefts" |
| **Skill** | A specific capability of an agent | `investigate` skill |
| **Task** | A unit of work sent to the agent | "Find the suspect" |
| **Event Queue** | Stream of status updates while the agent works | `working → completed` |

### Why A2A Matters

Without A2A, each agent framework speaks its own language. With A2A:

| Without A2A | With A2A |
|---|---|
| ❌ Agents are locked into one framework | ✅ Any agent can call any other agent |
| ❌ Custom integration code per tool/agent | ✅ Standard HTTP endpoints, discoverable by URL |
| ❌ No standard way to describe capabilities | ✅ Agent Card at `/.well-known/agent-card.json` |
| ❌ No standard way to report progress | ✅ Event-based task status updates (`working → completed`) |

---

## Create the Server

### Step 1: Create server.py

👉 Create a new file [`/project/Python/starter-project/server.py`](/project/Python/starter-project/server.py).

#### Part 1: Imports

```python
import asyncio
import json
import os

from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.apps.jsonrpc import A2AFastAPIApplication
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import (
    Artifact,
    TaskState,
    TaskStatus,
    TaskStatusUpdateEvent,
    TaskArtifactUpdateEvent,
    TextPart,
    AgentCard,
    AgentCapabilities,
    AgentSkill,
)
from fastapi.middleware.cors import CORSMiddleware

from investigator_crew import InvestigatorCrew
from payload import payload
```

> 💡 **What these imports do:**
>
> - `AgentExecutor` — Abstract base class you must implement. It defines `execute()` and `cancel()`, the two lifecycle methods of a task.
> - `RequestContext` — Carries the incoming task: the message from the caller, the task ID, and the context ID.
> - `EventQueue` — You push events into this queue to report progress back to the caller (`working`, `completed`, `canceled`).
> - `A2AFastAPIApplication` — Wires the A2A protocol on top of FastAPI. Handles routing, JSON-RPC encoding, and the Agent Card endpoint automatically.
> - `InMemoryTaskStore` — Stores task state in memory. Sufficient for a single-instance deployment.
> - `AgentCard`, `AgentSkill`, `AgentCapabilities` — The self-description of your agent, served at `/.well-known/agent-card.json`.

#### Part 2: The Executor

This is the heart of the server — the class that actually runs your crew when a task arrives.

```python
class InvestigatorExecutor(AgentExecutor):
    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        # 1. Tell the caller we've started working
        await event_queue.enqueue_event(
            TaskStatusUpdateEvent(
                task_id=context.task_id,
                context_id=context.context_id,
                status=TaskStatus(state=TaskState.working),
                final=False,
            )
        )

        # 2. Parse the incoming message
        user_input = context.get_user_input()
        try:
            parsed = json.loads(user_input)
            user_request = parsed.get("user_request", user_input)
            suspect_names = parsed.get("suspect_names", user_input)
        except (json.JSONDecodeError, TypeError):
            user_request = user_input
            suspect_names = user_input

        # 3. Run the crew (blocking call, so we offload it to a thread)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: InvestigatorCrew().crew().kickoff(
                inputs={
                    "payload": payload,
                    "user_request": user_request,
                    "suspect_names": suspect_names,
                }
            ),
        )

        # 4. Send the result back as an artifact
        await event_queue.enqueue_event(
            TaskArtifactUpdateEvent(
                task_id=context.task_id,
                context_id=context.context_id,
                artifact=Artifact(
                    artifactId="investigation_result",
                    parts=[TextPart(text=str(result))],
                    name="investigation_result",
                ),
            )
        )

        # 5. Mark the task as completed
        await event_queue.enqueue_event(
            TaskStatusUpdateEvent(
                task_id=context.task_id,
                context_id=context.context_id,
                status=TaskStatus(state=TaskState.completed),
                final=True,
            )
        )

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        await event_queue.enqueue_event(
            TaskStatusUpdateEvent(
                task_id=context.task_id,
                context_id=context.context_id,
                status=TaskStatus(state=TaskState.canceled),
                final=True,
            )
        )
```

> 💡 **Understanding the executor step by step:**
>
> **Step 1 — Signal `working`**
> The first thing you do is tell the caller the task has been received and is in progress. `final=False` means more events will follow.
>
> **Step 2 — Parse the input**
> The caller sends plain text or JSON. We try to parse it as JSON so we can extract structured fields like `suspect_names`. If it's not JSON, we use the raw string.
>
> **Step 3 — Run the crew in a thread**
> `InvestigatorCrew().crew().kickoff()` is a **synchronous, blocking** call — CrewAI is not async-native. Calling it directly inside an `async` function would freeze the entire server. `run_in_executor` moves it to a thread pool, keeping the event loop free to handle other requests.
>
> **Step 4 — Return the result as an artifact**
> An `Artifact` is the A2A way of returning a result. It has an ID, a name, and a list of `parts`. We use `TextPart` since the crew returns a markdown string.
>
> **Step 5 — Signal `completed`**
> `final=True` closes the task. The caller knows it can stop waiting.


#### Part 3: Resolve the App URL

This snippet detects whether the app is running on Cloud Foundry or locally, and sets `app_url` accordingly.

```python
app_url = (
    lambda d: f"https://{d.get('application_uris', [])[0]}"
    if d.get("application_uris")
    else None
)(json.loads(os.environ.get("VCAP_APPLICATION", "{}")))
if not app_url: app_url = "http://localhost:8080"
```

> 💡 **How URL detection works:**
>
> Cloud Foundry injects a `VCAP_APPLICATION` environment variable containing a JSON object with metadata about the running app, including `application_uris` — the list of public routes assigned to it. When that variable is present, the first URI is used to build the `https://` URL. When running locally, `VCAP_APPLICATION` is absent, so `app_url` falls back to `http://localhost:8080`.

#### Part 4: The Agent Card and App Assembly

```python
agent_card = AgentCard(
    name="Investigator Crew",
    description="Multi-agent art theft investigation crew exposed as an A2A server",
    url=app_url,
    version="1.0.0",
    capabilities=AgentCapabilities(streaming=False),
    skills=[
        AgentSkill(
            id="investigate",
            name="Investigate Art Theft",
            description="Investigates art theft cases by appraising losses and analyzing evidence",
            tags=["investigation", "art", "insurance", "theft"],
            inputModes=["text/plain"],
            outputModes=["text/markdown"],
        )
    ],
    defaultInputModes=["text/plain"],
    defaultOutputModes=["text/markdown"],
)

handler = DefaultRequestHandler(
    agent_executor=InvestigatorExecutor(),
    task_store=InMemoryTaskStore(),
)
app = A2AFastAPIApplication(agent_card=agent_card, http_handler=handler).build()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
```

> 💡 **Understanding the Agent Card:**
>
> The `AgentCard` is the agent's public identity. When another agent or client calls `GET /.well-known/agent-card.json` on your server, it receives this document. It describes:
> - **What the agent is** (`name`, `description`, `version`)
> - **Where it lives** (`url` — automatically set from `VCAP_APPLICATION` when deployed to CF, falls back to `localhost` otherwise)
> - **What it can do** (`skills`) — each skill has an ID, description, and declared input/output formats
> - **Whether it streams** (`capabilities.streaming=False`) — we return results all at once, not as a stream
>
> **The `/health` endpoint** is required by Cloud Foundry to verify the app started successfully. CF polls it after deployment — if it doesn't return `200 OK`, the deployment fails.

---

## Update requirements.txt

Your current `requirements.txt` doesn't include the A2A server libraries. You need to add them.

👉 Open [`/project/Python/starter-project/requirements.txt`](/project/Python/starter-project/requirements.txt) and make sure it contains the following:

```
# Core CrewAI agent framework with A2A protocol support
crewai[a2a]
# A2A SDK with HTTP server support
a2a-sdk[http-server]
# LLM interaction with SAP Generative AI Hub
litellm==1.82.6
# Environment configuration
python-dotenv
# Data validation
pydantic
# HTTP client
httpx
# HTTP requests
requests
# YAML configuration files
PyYAML
# SAP AI Core SDK for integration with SAP Generative AI Hub
sap-ai-sdk-base==3.4.0
sap-ai-sdk-core==3.3.0
sap-ai-sdk-gen==6.7.0
```
---

## Create the Deployment Manifest

Cloud Foundry uses a `manifest.yml` file to know how to run your application. Think of it as a recipe: it tells CF how much memory to allocate, which buildpack to use, what command to start the app with, and which services to bind.

### Step 1: Create manifest.yml

👉 Create a new file [`/project/Python/starter-project/manifest.yml`](/project/Python/starter-project/manifest.yml) at the root of your starter project.

> 💡 The `name` field below is a placeholder — the `cf push` command will override it automatically using your BAS login.

```yaml
applications:
  - name: investigator-crew-<YOUR NAME>
    memory: 1024M
    disk_quota: 2048M
    instances: 1
    buildpacks:
      - https://github.com/cloudfoundry/python-buildpack/releases/download/v1.8.43/python-buildpack-cflinuxfs4-v1.8.43.zip
    health-check-type: http
    health-check-http-endpoint: /health
    timeout: 180
    command: python -m uvicorn server:app --host 0.0.0.0 --port $PORT --workers 1
    services:
      - generative-ai-hub
    env:
      LITELLM_PROVIDER: sap
      AICORE_RESOURCE_GROUP: ai-agents-codejam
      RPT1_DEPLOYMENT_URL: <YOUR_RPT1_DEPLOYMENT_URL>
      CREWAI_TRACING_ENABLED: "false"
      BP_PYTHON_VERSION: "3.13.11"
```

> ⚠️ **You must replace the placeholder value:**
> - `RPT1_DEPLOYMENT_URL` — The same deployment URL you used in Exercise 03. Copy it from your local `.env` file.

> 💡 **Understanding each field:**
>
> | Field | Purpose |
> |---|---|
> | `name` | The app name in CF. Your URL will be based on this. |
> | `memory` | RAM allocated per instance. 1GB is enough for uvicorn + CrewAI. |
> | `disk_quota` | Disk space for the app and its dependencies. 2GB covers all Python packages. |
> | `instances` | Number of app instances. Keep at 1 for this exercise. |
> | `buildpacks` | CF uses this to detect Python and install dependencies from `requirements.txt`. We pin a specific version to ensure reproducibility. |
> | `health-check-type: http` | CF checks the `/health` endpoint after startup to confirm the app is ready. |
> | `health-check-http-endpoint` | The path CF polls. Must return `200 OK`. |
> | `timeout` | How many seconds CF waits for the health check to pass before failing the deployment. 180s gives the app time to install packages and load models. |
> | `command` | The startup command. `$PORT` is injected by CF — your app must listen on this port. |
> | `services` | CF service instances to bind. `generative-ai-hub` injects SAP AI Core credentials as environment variables automatically. |> | `env` | Static environment variables. These override or supplement what the service binding provides. The app URL is detected automatically from `VCAP_APPLICATION` at runtime — no need to set it here. |

> 💡 **Why `--workers 1`?**
> CrewAI is CPU and memory intensive — each worker would be capable of running a full crew execution in parallel. With limited memory (1024M), multiple concurrent crew runs would exhaust available RAM. One worker keeps resource usage predictable and safe for this deployment.

### Step 2: Create runtime.txt

CF's Python buildpack reads `runtime.txt` to know which Python version to install.

👉 Create a new file [`/project/Python/starter-project/runtime.txt`](/project/Python/starter-project/runtime.txt) and add the following line to it:

```
python-3.13.x
```

> 💡 **Note**: The `x` is a wildcard — CF picks the latest patch version of Python 3.13.

---

## Protect Secrets with .cfignore

Your local `.env` file contains API keys and credentials. You must not push it to CF — the credentials come from the `generative-ai-hub` service binding instead.

👉 Create a new file [`/project/Python/starter-project/.cfignore`](/project/Python/starter-project/.cfignore):

```
.env
.venv/
__pycache__/
*.pyc
*.pyo
.python-version
```

> ⚠️ **Important**: `.cfignore` works like `.gitignore` but for `cf push`. Files listed here are excluded from the upload to CF. Always include `.env` here to prevent accidentally uploading credentials.

---

## Deploy to Cloud Foundry

### Step 1: Log in to CF

👉 Open a terminal and log in to your SAP BTP CF environment:

```bash
cf login -a https://api.cf.eu10-004.hana.ondemand.com --origin a7rg4vxjp-platform
```
👉 Use the credentials provided in the system access email.
```
Email: cd-agents-###
Password: *******
```

> The `--origin` flag ensures CF redirects you to the correct custom identity provider for this CodeJam.

👉 Select the correct **org** and **space** when prompted.

### Step 2: Push the App

👉 Navigate to your starter-project folder in the terminal:

```bash
cd project/Python/starter-project
```

👉 Push the app with a single command that automatically derives your app name from your BAS login:

```bash
# BAS / macOS / Linux (bash)
cf push "investigator-crew-$(echo "$USER_NAME" | cut -d '@' -f 1 | tr -d '.')"
```

```powershell
# Windows (PowerShell) — if running cf locally without BAS
cf push "investigator-crew-yourname"
```

> 💡 **What this command does:**
>
> `$USER_NAME` is an environment variable automatically set by SAP Business Application Studio to your login email (e.g. `nora.von.thenen@sap.com`). The shell expression strips the domain (`cut -d '@' -f 1`) and removes any dots (`tr -d '.'`), producing a clean app name like `investigator-crew-noravonthenen`. This overrides the `name` field in `manifest.yml` so you don't have to edit the file manually.
>
> On Windows without BAS, `$USER_NAME` is not available — just replace `yourname` with your own identifier.

CF will:
1. Upload your project files (excluding anything in `.cfignore`)
2. Detect Python and install dependencies from `requirements.txt`
3. Start the app with the `command` from `manifest.yml`
4. Poll `/health` until it returns `200 OK`

> ⚠️ **The first push can take a few minutes** — CF is downloading and installing all Python packages. Subsequent pushes are faster.

### Step 3: Get Your App URL

Once the push succeeds, CF prints the app URL:

```
name:              investigator-crew-<YOUR NAME>
requested state:   started
routes:            investigator-crew-<YOUR NAME>-<to be determined>.cfapps.eu10-004.hana.ondemand.com
```

---

## Verify the Deployment

### Check the Agent Card

👉 Open a browser or run:

```bash
curl https://<YOUR_APP_URL>/.well-known/agent-card.json
```

You should see your agent's description:

```json
{
  "name": "Investigator Crew",
  "description": "Multi-agent art theft investigation crew exposed as an A2A server",
  "url": "https://investigator-crew-<YOUR NAME>-<random>.cfapps.eu10-004.hana.ondemand.com",
  "version": "1.0.0",
  "skills": [...]
}
```

> 💡 The Agent Card is served at `/.well-known/agent-card.json`.

### Check the Health Endpoint

```bash
curl https://<YOUR_APP_URL>/health
```

Expected response: `{"status": "ok"}`

### Check your Agent in the A2A Editor
👉 Open the [A2A Editor](https://open-resource-discovery.github.io/a2a-editor/playground/)

👉 Add your agent by pasting the URL: `https://<YOUR_APP_URL>/.well-known/agent-card.json`

👉 Open the Chat and paste: 
```json
{
    "user_request": "Investigate the art theft at the museum",
    "suspect_names": "Sophie Dubois, Marcus Chen, Viktor Petrov"
}
```

### Check the Logs

If something went wrong during startup:

```bash
cf logs investigator-crew-<YOUR NAME> --recent
```

---

## Understanding What Just Happened

### The Full Architecture

You now have a live, publicly reachable multi-agent system:

```mermaid
flowchart TD
    Internet --> CFRouter["CF Router"]
    CFRouter --> App["investigator-crew-YOUR-NAME\nuvicorn / FastAPI"]

    App --> EP1["GET /.well-known/agent-card.json → AgentCard"]
    App --> EP2["GET /.well-known/agent.json → AgentCard (backwards compat)"]
    App --> EP3["GET /health → {status: ok}"]
    App --> EP4["POST / → A2A JSON-RPC handler"]

    EP4 --> Executor["InvestigatorExecutor"]
    Executor --> Crew["InvestigatorCrew"]

    Crew --> A1["Appraiser Agent (RPT-1)"]
    Crew --> A2["Evidence Analyst (Grounding)"]
    Crew --> A3["Lead Detective (GPT-4o)"]
```

### How CF Manages Your App

| CF Feature | What it does for you |
|---|---|
| **Buildpack** | Detects Python, installs `requirements.txt`, sets up the runtime |
| **Service Binding** | Injects `AICORE_*` credentials into the app environment automatically |
| **Health Check** | Restarts the app if `/health` stops responding |
| **Router** | Terminates TLS and routes HTTPS traffic to your app on `$PORT` |
| **Env vars** | Available at runtime via `os.environ.get(...)` — no `.env` file needed |

---

## Key Takeaways

- **A2A** is an open protocol that lets agents communicate over HTTP regardless of framework
- **`AgentExecutor`** is the single class you implement — it bridges A2A tasks to your CrewAI crew
- **`run_in_executor`** is essential: CrewAI is synchronous, so you must offload it to a thread to keep the async server responsive
- **`manifest.yml`** replaces both the Procfile and manual `cf` commands — it's the single source of truth for deployment
- **`.cfignore`** prevents sensitive files (`.env`) from being uploaded to CF
- **`VCAP_APPLICATION`** provides the public URL at runtime — the Agent Card picks it up automatically, no manual `APP_URL` env var needed

---

## Next Steps

1. ✅ [Set up your development space](01-setup-dev-space.md)
2. ✅ [Build a basic agent](02-build-a-basic-agent.md)
3. ✅ [Add custom tools](03-add-your-first-tool.md)
4. ✅ [Build a multi-agent system](04-building-multi-agent-system.md)
5. ✅ [Add the Grounding Service](05-add-the-grounding-service.md)
6. ✅ [Solve the crime](06-solve-the-crime.md)
7. ✅ [Deploy your agent to CF with A2A](07-deploy-agent-to-cf.md) (this exercise)

---

## Troubleshooting

**Issue**: `cf push` fails with `health check failed`

- **Solution**: Check `cf logs investigator-crew-<YOUR NAME> --recent`. Common causes:
  - Missing `requirements.txt` dependency
  - Import error in `server.py` or `investigator_crew.py`
  - Service binding not found — verify the service name matches exactly (`generative-ai-hub`)

**Issue**: `ModuleNotFoundError: No module named 'a2a'`

- **Solution**: Ensure `a2a-sdk[http-server]` is in `requirements.txt`. The square brackets are important — they install optional HTTP server dependencies.

**Issue**: `/.well-known/agent-card.json` returns a wrong URL

- **Solution**: The app URL is detected automatically from `VCAP_APPLICATION` at runtime. If it's wrong, check that the app was pushed successfully and that CF has assigned a route. Run `cf apps` to verify the route, then check `cf logs investigator-crew-<YOUR NAME> --recent` for errors.

**Issue**: App crashes immediately after startup

- **Solution**: You likely have a missing environment variable. Check `cf logs investigator-crew-<YOUR NAME> --recent` for `KeyError` or `AttributeError`. Verify all `env:` values in `manifest.yml` are set, especially `RPT1_DEPLOYMENT_URL`.

**Issue**: `.env` was accidentally uploaded and credentials are exposed

- **Solution**: Add `.env` to `.cfignore`, run `cf push` to overwrite, then rotate your API credentials immediately in SAP BTP.

**Issue**: `Error: relation between task and context not found` when calling the agent

- **Solution**: The app likely restarted and lost its in-memory task state. Ensure `--workers 1` is in your `command` and check `cf logs investigator-crew-<YOUR NAME> --recent` for unexpected restarts.

---

## Resources

- [A2A Protocol Specification](https://a2a-protocol.org/latest/)
- [a2a-sdk Python package](https://pypi.org/project/a2a-sdk/)
- [SAP BTP Cloud Foundry deployment guide](https://help.sap.com/docs/btp/sap-business-technology-platform/deploy-application)
- [CF Python Buildpack releases](https://github.com/cloudfoundry/python-buildpack/releases)
- [CrewAI A2A integration](https://docs.crewai.com/en/guides/advanced/a2a)
