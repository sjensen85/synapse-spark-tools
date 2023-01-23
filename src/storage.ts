import { DefaultAzureCredential, useIdentityPlugin } from "@azure/identity";
import { DataLakeServiceClient } from "@azure/storage-file-datalake";
import { vsCodePlugin } from "@azure/identity-vscode";
import path = require("path");

useIdentityPlugin(vsCodePlugin);

export const uploadFileToTempLocation = async (account: string, fileSystemName: string, path: string, fileName: string, content: string) => {
  const datalakeServiceClient = new DataLakeServiceClient(
    `https://${account}.dfs.core.windows.net`,
    new DefaultAzureCredential()
  );
  const fileSystemClient = datalakeServiceClient.getFileSystemClient(fileSystemName);
  const fullPath = path + fileName;
  const fileClient = fileSystemClient.getFileClient(fullPath);
  await fileClient.create();
  await fileClient.append(content, 0, content.length);
  await fileClient.flush(content.length);
};

export const uploadLocalFilesToTempLocation = async (filePaths: string[], account: string, fileSystemName: string, adlsPath: string) => {
  const datalakeServiceClient = new DataLakeServiceClient(
    `https://${account}.dfs.core.windows.net`,
    new DefaultAzureCredential()
  );
  const fileSystemClient = datalakeServiceClient.getFileSystemClient(fileSystemName);

  for (let filePath in filePaths) {
    const fileName = path.basename(filePath);
    const fullPath = adlsPath + fileName;
    const fileClient = fileSystemClient.getFileClient(fullPath);
    await fileClient.uploadFile(filePath);
  }
};
