import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import {
  A2AExpressApp,
  AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  RequestContext,
  ExecutionEventBus,
} from "@a2a-js/sdk/server";
import type {
  AgentCard,
  Task,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
} from "@a2a-js/sdk";
import { InvestigationWorkflow } from "./investigationWorkflow.js";
import { payload } from "./payload.js";

const InputSchema = z.object({
  suspect_names: z.string(),
});

class InvestigatorExecutor implements AgentExecutor {
  async execute(
    context: RequestContext,
    eventBus: ExecutionEventBus,
  ): Promise<void> {
    // 1. Register the task so the SDK can track it
    const task: Task = {
      kind: "task",
      id: context.taskId,
      contextId: context.contextId,
      status: { state: "submitted", timestamp: new Date().toISOString() },
      history: [],
    };
    eventBus.publish(task);

    // 2. Signal working
    const working: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: context.taskId,
      contextId: context.contextId,
      status: { state: "working", timestamp: new Date().toISOString() },
      final: false,
    };
    eventBus.publish(working);

    try {
      // 2. Parse the incoming message
      const rawText =
        context.userMessage?.parts
          ?.filter(
            (p): p is { kind: "text"; text: string } => p.kind === "text",
          )
          .map((p) => p.text)
          .join("") ?? "";

      let suspectNames: string;
      try {
        const json = JSON.parse(rawText);
        const parsed = InputSchema.parse(json);
        suspectNames = parsed.suspect_names;
      } catch (error) {
        if (error instanceof SyntaxError) {
          console.warn("Input is not JSON, using raw text as suspect names");
        } else {
          console.warn("Input JSON is missing suspect_names, using raw text");
        }
        suspectNames = rawText;
      }

      // 3. Run the LangGraph workflow (async-native, no thread pool needed)
      const workflow = new InvestigationWorkflow(process.env.MODEL_NAME!);
      const result = await workflow.kickoff({
        payload,
        suspect_names: suspectNames,
      });

      // 4. Send result as an artifact
      const artifact: TaskArtifactUpdateEvent = {
        kind: "artifact-update",
        taskId: context.taskId,
        contextId: context.contextId,
        artifact: {
          artifactId: "investigation_result",
          name: "investigation_result",
          parts: [{ kind: "text", text: String(result) }],
        },
      };
      eventBus.publish(artifact);

      // 5. Signal completed
      const completed: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: context.taskId,
        contextId: context.contextId,
        status: { state: "completed", timestamp: new Date().toISOString() },
        final: true,
      };
      eventBus.publish(completed);
    } catch (error) {
      // 6. Signal failure so the caller is not left waiting
      eventBus.publish({
        kind: "status-update",
        taskId: context.taskId,
        contextId: context.contextId,
        status: { state: "failed", timestamp: new Date().toISOString() },
        final: true,
      });
    }
    eventBus.finished();
  }

  async cancelTask(taskId: string): Promise<void> {
    console.log(`Task ${taskId} cancellation requested`);
  }
}

function resolveAppUrl(): string {
  const vcap = process.env.VCAP_APPLICATION;
  if (vcap) {
    const { application_uris } = JSON.parse(vcap);
    if (application_uris?.[0]) return `https://${application_uris[0]}`;
  }
  return `http://localhost:${process.env.PORT ?? "8080"}`;
}

const APP_URL = process.env.APP_URL ?? resolveAppUrl();

const agentCard = {
  name: "Investigator Graph",
  description:
    "Multi-agent art theft investigation graph exposed as an A2A server",
  url: APP_URL,
  version: "1.0.0",
  protocolVersion: "0.3.0",
  capabilities: { streaming: false, pushNotifications: false },
  skills: [
    {
      id: "investigate",
      name: "Investigate Art Theft",
      description:
        "Investigates art theft cases by appraising losses and analyzing evidence",
      tags: ["investigation", "art", "insurance", "theft"],
      inputModes: ["text/plain"],
      outputModes: ["text/plain"],
    },
  ],
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
};

const requestHandler = new DefaultRequestHandler(
  agentCard,
  new InMemoryTaskStore(),
  new InvestigatorExecutor(),
);

const app = express();
app.use(cors());
app.use(express.json());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
new A2AExpressApp(requestHandler).setupRoutes(app as any);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = parseInt(process.env.PORT ?? "8080", 10);
app.listen(port, "0.0.0.0", () => {
  console.log(`Investigator A2A server running on port ${port}`);
  console.log(`Agent card: ${APP_URL}/.well-known/agent.json`);
});
