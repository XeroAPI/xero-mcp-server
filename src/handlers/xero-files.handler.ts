import axios from "axios";
import FormData from "form-data";

import { xeroClient } from "../clients/xero-client.js";
import { formatBinaryContent } from "../helpers/format-binary-content.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { resolveStagedFileInput } from "../helpers/staged-file-upload.js";
import { loadConfig } from "../lib/config.js";
import { XeroClientResponse } from "../types/tool-response.js";

type FileSortField = "Name" | "Size" | "CreatedDateUTC";
type SortDirection = "ASC" | "DESC";
type CreateFolderPayload = Parameters<
  typeof xeroClient.filesApi.createFolder
>[1];
type UpdateFilePayload = Parameters<typeof xeroClient.filesApi.updateFile>[2];
type UpdateFolderPayload = Parameters<
  typeof xeroClient.filesApi.updateFolder
>[2];
type CreateFileAssociationPayload = Parameters<
  typeof xeroClient.filesApi.createFileAssociation
>[2];

export interface XeroFile {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  createdDateUtc?: string;
  updatedDateUtc?: string;
  folderId?: string;
  user?: {
    id?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
}

export interface XeroFileFolder {
  id?: string;
  name?: string;
  fileCount?: number;
  email?: string;
  isInbox?: boolean;
}

export interface XeroFilesListResult {
  files: XeroFile[];
  totalCount?: number;
  page?: number;
  perPage?: number;
  folderId?: string;
}

export interface XeroFileDocument {
  file: XeroFile;
  contentBase64: string;
  contentText?: string;
}

export interface XeroFileAssociation {
  fileId?: string;
  objectId?: string;
  objectGroup?: string;
  objectType?: string;
  sendWithObject?: boolean;
  name?: string;
  size?: number;
}

interface XeroFilesUploadApiResponse {
  Id?: string;
  Name?: string;
  MimeType?: string;
  Size?: number;
  CreatedDateUtc?: string;
  UpdatedDateUtc?: string;
  FolderId?: string;
  User?: {
    Id?: string;
    Name?: string;
    FirstName?: string;
    LastName?: string;
    FullName?: string;
  };
}

function mapXeroFile(file: {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  createdDateUtc?: string;
  updatedDateUtc?: string;
  folderId?: string;
  user?: {
    id?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
  };
}): XeroFile {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    createdDateUtc: file.createdDateUtc,
    updatedDateUtc: file.updatedDateUtc,
    folderId: file.folderId,
    user: file.user
      ? {
          id: file.user.id,
          name: file.user.name,
          firstName: file.user.firstName,
          lastName: file.user.lastName,
          fullName: file.user.fullName,
        }
      : undefined,
  };
}

function mapXeroFolder(folder: {
  id?: string;
  name?: string;
  fileCount?: number;
  email?: string;
  isInbox?: boolean;
}): XeroFileFolder {
  return {
    id: folder.id,
    name: folder.name,
    fileCount: folder.fileCount,
    email: folder.email,
    isInbox: folder.isInbox,
  };
}

function mapXeroFileAssociation(association: {
  fileId?: string;
  objectId?: string;
  objectGroup?: { toString(): string } | string;
  objectType?: { toString(): string } | string;
  sendWithObject?: boolean;
  name?: string;
  size?: number;
}): XeroFileAssociation {
  return {
    fileId: association.fileId,
    objectId: association.objectId,
    objectGroup: association.objectGroup?.toString(),
    objectType: association.objectType?.toString(),
    sendWithObject: association.sendWithObject,
    name: association.name,
    size: association.size,
  };
}

function resolveUploadName(fileName: string, name?: string): string {
  if (!name) {
    return fileName;
  }

  const hasExtension = /\.[A-Za-z0-9]+$/.test(name);

  return hasExtension ? name : fileName;
}

async function assertUploadFolderIsSupported(folderId?: string): Promise<void> {
  if (!folderId) {
    return;
  }

  const inboxResponse = await xeroClient.filesApi.getInbox(
    xeroClient.tenantId,
    getClientHeaders(),
  );
  const inbox = mapXeroFolder(inboxResponse.body);

  if (!inbox.id) {
    return;
  }

  if (folderId === inbox.id) {
    throw new Error(
      "Direct uploads to the Xero Files Inbox are not supported. Omit folderId to use Xero's default upload destination, which appears in Archive in the Xero UI, or provide a non-Inbox folder ID such as an Invoices folder.",
    );
  }
}

async function uploadFileToXero(
  fileName: string,
  stagedFileId: string,
  name?: string,
  folderId?: string,
): Promise<XeroFile> {
  await xeroClient.authenticate();

  const resolvedFile = await resolveStagedFileInput(
    loadConfig().uploads,
    stagedFileId,
  );

  try {
    const body = resolvedFile.body;
    const uploadName = resolveUploadName(fileName, name);
    const accessToken = xeroClient.readTokenSet().access_token;

    if (!accessToken) {
      throw new Error(
        "Failed to retrieve a Xero access token for file upload.",
      );
    }

    const formData = new FormData();
    // Xero's Files API expects the binary part name to be the uploaded file name.
    formData.append(uploadName, body, {
      filename: fileName,
      contentType: resolvedFile.contentType,
      knownLength: body.byteLength,
    });
    formData.append("name", uploadName);
    formData.append("filename", fileName);
    formData.append("mimeType", resolvedFile.contentType);

    const contentLength = await new Promise<number>((resolve, reject) => {
      formData.getLength((error, length) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(length);
      });
    });
    await assertUploadFolderIsSupported(folderId);
    const uploadPath = folderId
      ? `${xeroClient.filesApi.basePath}/Files/${encodeURIComponent(folderId)}`
      : `${xeroClient.filesApi.basePath}/Files`;
    const response = await axios.post<XeroFilesUploadApiResponse>(
      uploadPath,
      formData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "xero-tenant-id": xeroClient.tenantId,
          Accept: "application/json",
          "Content-Length": contentLength.toString(),
          ...getClientHeaders().headers,
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      },
    );

    return mapXeroFile({
      id: response.data.Id,
      name: response.data.Name,
      mimeType: response.data.MimeType,
      size: response.data.Size,
      createdDateUtc: response.data.CreatedDateUtc,
      updatedDateUtc: response.data.UpdatedDateUtc,
      folderId: response.data.FolderId,
      user: response.data.User
        ? {
            id: response.data.User.Id,
            name: response.data.User.Name,
            firstName: response.data.User.FirstName,
            lastName: response.data.User.LastName,
            fullName: response.data.User.FullName,
          }
        : undefined,
    });
  } finally {
    await resolvedFile.cleanup().catch(() => undefined);
  }
}

async function createXeroFolderInFiles(name: string): Promise<XeroFileFolder> {
  await xeroClient.authenticate();

  const folder: CreateFolderPayload = {
    name,
  };
  const response = await xeroClient.filesApi.createFolder(
    xeroClient.tenantId,
    folder,
    undefined,
    getClientHeaders(),
  );

  return mapXeroFolder(response.body);
}

async function updateXeroFileInFiles(
  fileId: string,
  name?: string,
  folderId?: string,
): Promise<XeroFile> {
  await xeroClient.authenticate();

  if (!name && !folderId) {
    throw new Error("At least one of name or folderId is required.");
  }

  const file: UpdateFilePayload = {
    ...(name ? { name } : {}),
    ...(folderId ? { folderId } : {}),
  };
  const response = await xeroClient.filesApi.updateFile(
    xeroClient.tenantId,
    fileId,
    file,
    undefined,
    getClientHeaders(),
  );

  return mapXeroFile(response.body);
}

async function getXeroFiles(
  pageSize?: number,
  page?: number,
  sort?: FileSortField,
  direction?: SortDirection,
  folderId?: string,
): Promise<XeroFilesListResult> {
  await xeroClient.authenticate();

  const response = await xeroClient.filesApi.getFiles(
    xeroClient.tenantId,
    pageSize,
    page,
    sort,
    direction,
    getClientHeaders(),
  );

  const files = (response.body.items ?? []).map(mapXeroFile);
  const filteredFiles = folderId
    ? files.filter((file) => file.folderId === folderId)
    : files;

  return {
    files: filteredFiles,
    totalCount: response.body.totalCount,
    page: response.body.page,
    perPage: response.body.perPage,
    folderId,
  };
}

async function getXeroFolders(sort?: FileSortField): Promise<XeroFileFolder[]> {
  await xeroClient.authenticate();

  const [foldersResponse, inboxResponse] = await Promise.all([
    xeroClient.filesApi.getFolders(
      xeroClient.tenantId,
      sort,
      getClientHeaders(),
    ),
    xeroClient.filesApi.getInbox(xeroClient.tenantId, getClientHeaders()),
  ]);

  const folders = foldersResponse.body.map(mapXeroFolder);
  const inbox = mapXeroFolder(inboxResponse.body);

  if (!inbox.id) {
    return folders;
  }

  const existingInboxIndex = folders.findIndex(
    (folder) => folder.id === inbox.id,
  );

  if (existingInboxIndex >= 0) {
    folders[existingInboxIndex] = {
      ...folders[existingInboxIndex],
      ...inbox,
    };
    return folders;
  }

  return [inbox, ...folders];
}

async function getXeroFolderById(folderId: string): Promise<XeroFileFolder> {
  await xeroClient.authenticate();

  const response = await xeroClient.filesApi.getFolder(
    xeroClient.tenantId,
    folderId,
    getClientHeaders(),
  );

  return mapXeroFolder(response.body);
}

async function updateXeroFolderInFiles(
  folderId: string,
  name: string,
): Promise<XeroFileFolder> {
  const folder = await getXeroFolderById(folderId);

  if (folder.isInbox) {
    throw new Error("The Xero Files inbox folder cannot be renamed.");
  }

  const payload: UpdateFolderPayload = {
    name,
  };
  const response = await xeroClient.filesApi.updateFolder(
    xeroClient.tenantId,
    folderId,
    payload,
    undefined,
    getClientHeaders(),
  );

  return mapXeroFolder(response.body);
}

async function deleteXeroFileInFiles(fileId: string): Promise<void> {
  await xeroClient.authenticate();

  await xeroClient.filesApi.deleteFile(
    xeroClient.tenantId,
    fileId,
    getClientHeaders(),
  );
}

async function deleteXeroFolderInFiles(folderId: string): Promise<void> {
  const folder = await getXeroFolderById(folderId);

  if (folder.isInbox) {
    throw new Error("The Xero Files inbox folder cannot be deleted.");
  }

  await xeroClient.filesApi.deleteFolder(
    xeroClient.tenantId,
    folderId,
    getClientHeaders(),
  );
}

async function createXeroFileAssociationInFiles(
  fileId: string,
  objectId: string,
  objectGroup?: string,
  objectType?: string,
  sendWithObject?: boolean,
): Promise<XeroFileAssociation> {
  await xeroClient.authenticate();

  const association: CreateFileAssociationPayload = {
    objectId,
    sendWithObject,
    objectGroup: objectGroup as
      | CreateFileAssociationPayload["objectGroup"]
      | undefined,
    objectType: objectType as
      | CreateFileAssociationPayload["objectType"]
      | undefined,
  };
  const response = await xeroClient.filesApi.createFileAssociation(
    xeroClient.tenantId,
    fileId,
    association,
    undefined,
    getClientHeaders(),
  );

  return mapXeroFileAssociation(response.body);
}

async function deleteXeroFileAssociationInFiles(
  fileId: string,
  objectId: string,
): Promise<void> {
  await xeroClient.authenticate();

  await xeroClient.filesApi.deleteFileAssociation(
    xeroClient.tenantId,
    fileId,
    objectId,
    getClientHeaders(),
  );
}

async function getXeroFileDocument(fileId: string): Promise<XeroFileDocument> {
  await xeroClient.authenticate();

  const [fileResponse, contentResponse] = await Promise.all([
    xeroClient.filesApi.getFile(
      xeroClient.tenantId,
      fileId,
      getClientHeaders(),
    ),
    xeroClient.filesApi.getFileContent(
      xeroClient.tenantId,
      fileId,
      getClientHeaders(),
    ),
  ]);

  const file = mapXeroFile(fileResponse.body);
  const contentType =
    file.mimeType ??
    contentResponse.response.headers["content-type"] ??
    "application/octet-stream";

  return {
    file,
    ...formatBinaryContent(contentResponse.body, contentType),
  };
}

export async function uploadXeroFile(
  fileName: string,
  stagedFileId: string,
  name?: string,
  folderId?: string,
): Promise<XeroClientResponse<XeroFile>> {
  try {
    const file = await uploadFileToXero(fileName, stagedFileId, name, folderId);

    return {
      result: file,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}

export async function createXeroFileFolder(
  name: string,
): Promise<XeroClientResponse<XeroFileFolder>> {
  try {
    const folder = await createXeroFolderInFiles(name);

    return {
      result: folder,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}

export async function updateXeroFile(
  fileId: string,
  name?: string,
  folderId?: string,
): Promise<XeroClientResponse<XeroFile>> {
  try {
    const file = await updateXeroFileInFiles(fileId, name, folderId);

    return {
      result: file,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}

export async function listXeroFiles(
  pageSize?: number,
  page?: number,
  sort?: FileSortField,
  direction?: SortDirection,
  folderId?: string,
): Promise<XeroClientResponse<XeroFilesListResult>> {
  try {
    const result = await getXeroFiles(
      pageSize,
      page,
      sort,
      direction,
      folderId,
    );

    return {
      result,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}

export async function listXeroFileFolders(
  sort?: FileSortField,
): Promise<XeroClientResponse<XeroFileFolder[]>> {
  try {
    const folders = await getXeroFolders(sort);

    return {
      result: folders,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}

export async function updateXeroFileFolder(
  folderId: string,
  name: string,
): Promise<XeroClientResponse<XeroFileFolder>> {
  try {
    const folder = await updateXeroFolderInFiles(folderId, name);

    return {
      result: folder,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}

export async function deleteXeroFile(
  fileId: string,
): Promise<XeroClientResponse<null>> {
  try {
    await deleteXeroFileInFiles(fileId);

    return {
      result: null,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}

export async function deleteXeroFileFolder(
  folderId: string,
): Promise<XeroClientResponse<null>> {
  try {
    await deleteXeroFolderInFiles(folderId);

    return {
      result: null,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}

export async function associateXeroFile(
  fileId: string,
  objectId: string,
  objectGroup?: string,
  objectType?: string,
  sendWithObject?: boolean,
): Promise<XeroClientResponse<XeroFileAssociation>> {
  try {
    const association = await createXeroFileAssociationInFiles(
      fileId,
      objectId,
      objectGroup,
      objectType,
      sendWithObject,
    );

    return {
      result: association,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}

export async function removeXeroFileAssociation(
  fileId: string,
  objectId: string,
): Promise<XeroClientResponse<null>> {
  try {
    await deleteXeroFileAssociationInFiles(fileId, objectId);

    return {
      result: null,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}

export async function getXeroFileDocumentById(
  fileId: string,
): Promise<XeroClientResponse<XeroFileDocument>> {
  try {
    const document = await getXeroFileDocument(fileId);

    return {
      result: document,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
