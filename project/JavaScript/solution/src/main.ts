import "dotenv/config";
import { initialize } from "@traceloop/node-server-sdk";
import { InvestigationWorkflow } from "./investigationWorkflow.js";

// Initialize OpenTelemetry tracing before anything else.
// Traces are sent to the OTEL collector at OTEL_EXPORTER_OTLP_ENDPOINT (see .env.example).
initialize({ appName: "codejam-investigation", disableBatch: true });

async function main() {
  const workflow = new InvestigationWorkflow(process.env.MODEL_NAME!);
  const suspectNames = "Sophie Dubois, Marcus Chen, Viktor Petrov";

  const result = await workflow.kickoff({ suspect_names: suspectNames });

  console.log("\n📘 FINAL INVESTIGATION REPORT\n");
  console.log(result);
}

main();
