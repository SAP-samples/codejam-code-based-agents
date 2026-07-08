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


class InvestigatorExecutor(AgentExecutor):
    # Bridges the A2A task lifecycle to the CrewAI multi-agent investigation workflow.
    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        # Signal to the caller that work has started.
        await event_queue.enqueue_event(
            TaskStatusUpdateEvent(
                task_id=context.task_id,
                context_id=context.context_id,
                status=TaskStatus(state=TaskState.working),
                final=False,
            )
        )
        user_input = context.get_user_input()
        # Accept either a JSON object with structured fields or a plain string.
        try:
            parsed = json.loads(user_input)
            user_request = parsed.get("user_request", user_input)
            suspect_names = parsed.get("suspect_names", user_input)
        except (json.JSONDecodeError, TypeError):
            user_request = user_input
            suspect_names = user_input

        # CrewAI's kickoff() is synchronous, so run it in a thread pool to avoid blocking the event loop.
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
        # Publish the crew's final report as a named artifact.
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


# Resolve the public URL from Cloud Foundry's VCAP_APPLICATION env var when deployed; fall back to localhost.
app_url = (
    lambda d: f"https://{d.get('application_uris', [])[0]}"
    if d.get("application_uris")
    else None
)(json.loads(os.environ.get("VCAP_APPLICATION", "{}")))
if not app_url:
    app_url = "http://localhost:8080"

# Declares the agent's identity and capabilities so A2A clients can discover what it can do.
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

# Open CORS for all origins so browser-based A2A clients can reach this server.
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
