import * as vscode from "vscode";
import { SynapseManagementClient } from "@azure/arm-synapse";
import { DefaultAzureCredential, useIdentityPlugin } from "@azure/identity";
import { vsCodePlugin } from "@azure/identity-vscode";
import { SparkBatchJobOptions, SparkClient } from "@azure/synapse-spark";

useIdentityPlugin(vsCodePlugin);

export const listPools = async (
  subscriptionId: string,
  resourceGroupName: string,
  workspaceName: string
) => {
  const client = new SynapseManagementClient(
    new DefaultAzureCredential(),
    subscriptionId
  );

  let pools = [];
  for await (let page of client.bigDataPools
    .listByWorkspace(resourceGroupName, workspaceName)
    .byPage({ maxPageSize: 10 })) {
    for (const pool of page) {
      pools.push(pool);
    }
  }
  return pools;
};

export const submitBatchJob = async (
  subscriptionId: string,
  resourceGroupName: string,
  workspaceName: string,
  sparkPoolName: string,
  batchJobOptions: SparkBatchJobOptions
) => {
  const client = new SparkClient(
    new DefaultAzureCredential(),
    `https://${workspaceName}.dev.azuresynapse.net`,
    sparkPoolName
  );
  let job = await client.sparkBatch.createSparkBatchJob(batchJobOptions);

  if (!!job) {
    let consoleOutput = vscode.window.createOutputChannel("Synapse Spark");

    consoleOutput.show();
    consoleOutput.appendLine("Job started");
    consoleOutput.appendLine(`Livy Job ID: ${job.id}`);

    const url = `https://web.azuresynapse.net/en/monitoring/sparkapplication/${batchJobOptions.name}?workspace=%2Fsubscriptions%2F${subscriptionId}%2FresourceGroups%2F${resourceGroupName}%2Fproviders%2FMicrosoft.Synapse%2Fworkspaces%2F${workspaceName}&livyId=${job.id}&sparkPoolName=${sparkPoolName}`;
    consoleOutput.appendLine(`Job: ${url}`);
  }
};
