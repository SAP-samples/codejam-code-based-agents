import { RptClient } from "@sap-ai-sdk/rpt";
import type { RPT1Payload } from "./types.js";

export class RPT1Client {
  private client: RptClient;

  constructor(
    modelDeployment: {
      modelName: "sap-rpt-1-small" | "sap-rpt-1-large";
      resourceGroup?: string;
    } = {
      modelName: "sap-rpt-1-large",
      resourceGroup: process.env.RESOURCE_GROUP!,
    },
  ) {
    this.client = new RptClient(modelDeployment);
  }

  async predictWithoutSchema(payload: RPT1Payload): Promise<any> {
    const prediction = await this.client.predictWithoutSchema(payload as any);
    return prediction;
  }
}
