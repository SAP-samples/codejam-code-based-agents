import "dotenv/config";
import { InvestigationWorkflow } from "./investigationWorkflow.js";
import { payload } from "./payload.js";

async function main() {
  const workflow = new InvestigationWorkflow(process.env.MODEL_NAME!);
  const suspectNames = "Sophie Dubois, Marcus Chen, Viktor Petrov";

  const result = await workflow.kickoff({
    payload,
    suspect_names: suspectNames,
  });

  console.log("\n📘 FINAL INVESTIGATION REPORT\n");
  console.log(result);
}

main();
