// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { DefaultAzureCredential, useIdentityPlugin } from "@azure/identity";
import { StorageManagementClient } from "@azure/arm-storage";
import { SubscriptionClient } from "@azure/arm-subscriptions";
import { vsCodePlugin } from "@azure/identity-vscode";
import {
  SynapseManagementClient,
  BigDataPoolResourceInfo,
} from "@azure/arm-synapse";
import { DataLakeServiceClient } from "@azure/storage-file-datalake";
import { listPools, submitBatchJob } from "./synapse";
import {
  uploadFileToTempLocation,
  uploadLocalFilesToTempLocation,
} from "./storage";
var path = require("path");

useIdentityPlugin(vsCodePlugin);

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("synapse-spark");

  // retrieve values
  const subscriptionId = String(config.get("subscriptionId"));
  const resourceGroupName = String(config.get("resourceGroupName"));
  const workspaceName = String(config.get("workspace"));
  const cluster = String(config.get("cluster"));
  // const pyFiles = config.get("pyFiles"));

  let selectPool = vscode.commands.registerCommand(
    "synapse-spark.selectPool",
    async () => {
      const pools = await listPools(
        subscriptionId,
        resourceGroupName,
        workspaceName
      );
      showPoolsSelection(context, pools);
    }
  );

  let submitBatch = vscode.commands.registerCommand(
    "synapse-spark.submitBatch",
    async () => {
      const config = vscode.workspace.getConfiguration("synapse-spark");
      const options = JSON.parse(JSON.stringify(config.get("batchJobOptions")));
      const resourceGroup = String(config.get("resourceGroupName"));
      const adlsTempAccount = String(config.get("adlsTempAccount"));
      const adlsTempContainer = String(config.get("adlsTempContainer"));
      const adlsTempPath = String(config.get("adlsTempPath"));

      const fileName = path.basename(
        vscode.window.activeTextEditor?.document.fileName!
      );
      const fileContents = vscode.window.activeTextEditor?.document.getText()!;
      const now = new Date();
      var strDateTime = [
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
      ].join("");

      await uploadFileToTempLocation(
        adlsTempAccount,
        adlsTempContainer,
        adlsTempPath,
        fileName,
        fileContents
      );

      options.file = `abfss://${adlsTempContainer}@${adlsTempAccount}.dfs.core.windows.net/${adlsTempPath}${fileName}`;
      options.name = `SparkBatch-${strDateTime}`;

      submitBatchJob(
        subscriptionId,
        resourceGroup,
        workspaceName,
        cluster,
        options
      );
    }
  );

  let configureAzureSubscription = vscode.commands.registerCommand(
    "synapse-spark.configureAzureSubscription",
    async () => {
      await showSubscriptionsSelection();
    }
  );

  let configureSynapseWorkspace = vscode.commands.registerCommand(
    "synapse-spark.configureSynapseWorkspace",
    async () => {
      const config = vscode.workspace.getConfiguration("synapse-spark");
      const subscriptionId = String(config.get("subscriptionId"));
      await showSynapseWorkspaceSelection(subscriptionId);
    }
  );

  let configureTempAdlsAccount = vscode.commands.registerCommand(
    "synapse-spark.configureTempAdlsAccount",
    async () => {
      const config = vscode.workspace.getConfiguration("synapse-spark");
      const subscriptionId = String(config.get("subscriptionId"));
      await showAdlsAccountSelection(subscriptionId);
    }
  );

  let configureTempAdlsContainer = vscode.commands.registerCommand(
    "synapse-spark.configureTempAdlsContainer",
    async () => {
      const config = vscode.workspace.getConfiguration("synapse-spark");
      const account = String(config.get("adlsTempAccount"));
      await showAdlsContainerSelection(account);
    }
  );

  let configureTempAdlsPath = vscode.commands.registerCommand(
    "synapse-spark.configureTempAdlsPath",
    async () => {
      const config = vscode.workspace.getConfiguration("synapse-spark");
      const container = String(config.get("adlsTempContainer"));
      await showAdlsPathInput(container);
    }
  );

  let configureAll = vscode.commands.registerCommand(
    "synapse-spark.configureAll",
    async () => {
      let subscriptionId: string | undefined;
      let adlsTempAccount: string | undefined;
      let adlsTempContainer: string | undefined;

      subscriptionId = await showSubscriptionsSelection();

      if (!!subscriptionId) {
        await showSynapseWorkspaceSelection(subscriptionId);
      }

      if (!!subscriptionId) {
        adlsTempAccount = await showAdlsAccountSelection(subscriptionId);
      }

      if (!!adlsTempAccount) {
        adlsTempContainer = await showAdlsContainerSelection(adlsTempAccount);
      }

      if (!!adlsTempContainer) {
        await showAdlsPathInput(adlsTempContainer);
      }
    }
  );

  context.subscriptions.push(selectPool);
  context.subscriptions.push(submitBatch);
  context.subscriptions.push(configureAzureSubscription);
  context.subscriptions.push(configureSynapseWorkspace);
  context.subscriptions.push(configureTempAdlsAccount);
  context.subscriptions.push(configureTempAdlsContainer);
  context.subscriptions.push(configureTempAdlsPath);
  context.subscriptions.push(configureAll);
}

// This method is called when your extension is deactivated
export function deactivate() {}

const showPoolsSelection = (
  context: vscode.ExtensionContext,
  pools: Array<BigDataPoolResourceInfo>
) => {
  let items: vscode.QuickPickItem[] = [];
  for (let index = 0; index < pools.length; index++) {
    let item = pools[index];
    items.push({
      label: item.name!,
      description: item.id,
    });
  }

  vscode.window
    .showQuickPick(items, { title: "Select Synapse Spark Pool" })
    .then(async (selection) => {
      // the user canceled the selection
      if (!selection) {
        return;
      }

      const config = vscode.workspace.getConfiguration("synapse-spark");
      await config.update(
        "cluster",
        selection.label,
        vscode.ConfigurationTarget.Workspace
      );
    });
};

const showSubscriptionsSelection = async () => {
  const credential = new DefaultAzureCredential();
  const subClient = new SubscriptionClient(credential);
  let subscriptions = [];

  for await (let item of subClient.subscriptions.list()) {
    subscriptions.push(item);
  }

  let items: vscode.QuickPickItem[] = [];

  for (let index = 0; index < subscriptions.length; index++) {
    let item = subscriptions[index];
    items.push({
      label: item.displayName!,
      description: item.subscriptionId,
    });
  }

  return vscode.window
    .showQuickPick(items, { title: "Select Azure Subscription" })
    .then(async (selection) => {
      // the user canceled the selection
      if (!selection) {
        return "";
      }

      const config = vscode.workspace.getConfiguration("synapse-spark");
      await config.update(
        "subscriptionId",
        selection.description,
        vscode.ConfigurationTarget.Workspace
      );
      return !!selection.description ? selection.description : "";
    });
};

const showSynapseWorkspaceSelection = async (subscriptionId: string) => {
  const credential = new DefaultAzureCredential();
  const synapseClient = new SynapseManagementClient(credential, subscriptionId);
  const workspaces = [];

  for await (let item of synapseClient.workspaces.list()) {
    workspaces.push(item);
  }

  let items: vscode.QuickPickItem[] = [];

  for (let index = 0; index < workspaces.length; index++) {
    let item = workspaces[index];
    let substring = item.id?.slice(item.id?.indexOf("resourceGroups/") + 15);
    let resourceGroup = substring?.slice(0, substring.indexOf("/"));

    items.push({
      label: item.name!,
      description: resourceGroup,
    });
  }

  return vscode.window
    .showQuickPick(items, { title: "Select Synapse Workspace" })
    .then(async (selection) => {
      // the user canceled the selection
      if (!selection) {
        return;
      }

      const config = vscode.workspace.getConfiguration("synapse-spark");
      await config.update(
        "workspace",
        selection.label,
        vscode.ConfigurationTarget.Workspace
      );
      await config.update(
        "resourceGroupName",
        selection.description,
        vscode.ConfigurationTarget.Workspace
      );
      return !!selection.label ? selection.label : "";
    });
};

const showAdlsAccountSelection = async (subscriptionId: string) => {
  const credential = new DefaultAzureCredential();
  const stgClient = new StorageManagementClient(credential, subscriptionId);
  const accounts = [];

  for await (let item of stgClient.storageAccounts.list()) {
    accounts.push(item);
  }

  let items: vscode.QuickPickItem[] = [];

  for (let index = 0; index < accounts.length; index++) {
    let item = accounts[index];
    items.push({
      label: item.name!,
      description: `${item.location}, ${item.kind}`,
    });
  }

  return vscode.window
    .showQuickPick(items, { title: "Select ADLS Account" })
    .then(async (selection) => {
      // the user canceled the selection
      if (!selection) {
        return;
      }

      const config = vscode.workspace.getConfiguration("synapse-spark");
      await config.update(
        "adlsTempAccount",
        selection.label,
        vscode.ConfigurationTarget.Workspace
      );
      return !!selection.label ? selection.label : "";
    });
};

const showAdlsContainerSelection = async (account: string) => {
  const credential = new DefaultAzureCredential();
  const datalakeServiceClient = new DataLakeServiceClient(
    `https://${account}.dfs.core.windows.net`,
    credential
  );

  let fileSystems = new Array();
  for await (let fileSystem of datalakeServiceClient.listFileSystems()) {
    fileSystems.push(fileSystem);
  }

  let items: vscode.QuickPickItem[] = [];

  for (let index = 0; index < fileSystems.length; index++) {
    let item = fileSystems[index];
    items.push({
      label: item.name!,
      description: item.versionId,
    });
  }

  return vscode.window
    .showQuickPick(items, { title: "Select ADLS Container" })
    .then(async (selection) => {
      // the user canceled the selection
      if (!selection) {
        return;
      }

      const config = vscode.workspace.getConfiguration("synapse-spark");
      await config.update(
        "adlsTempContainer",
        selection.label,
        vscode.ConfigurationTarget.Workspace
      );
      return !!selection.label ? selection.label : "";
    });
};

const showAdlsPathInput = async (container: string) => {
  await vscode.window.showInputBox({
    title: "Enter ADLS Path",
    value: "",
    valueSelection: [2, 4],
    placeHolder: `Path to temp location inside ${container} container, e.g. path/to/temp/location`,
    validateInput: (text) => {
      let result: string = "";

      if (!!text) {
        result = text.endsWith("/") ? text : text + "/";
      }

      const config = vscode.workspace.getConfiguration("synapse-spark");
      config.update(
        "adlsTempPath",
        result,
        vscode.ConfigurationTarget.Workspace
      );
      return null;
    },
  });
};
