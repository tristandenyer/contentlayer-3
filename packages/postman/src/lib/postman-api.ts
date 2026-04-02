import { CL3PostmanAPIError } from './errors.js'

const BASE_URL = 'https://api.getpostman.com'

export interface PostmanClient {
  apiKey: string
  workspaceId?: string
}

export interface Collection {
  id: string
  name: string
  uid: string
  updatedAt: string
}

export interface CollectionDetail {
  id: string
  name: string
  collection: {
    item: unknown[]
    variable: unknown[]
  }
}

export interface Workspace {
  id: string
  name: string
  type: string
}

export function createPostmanClient(config: PostmanClient): PostmanClient {
  return { ...config }
}

async function apiFetch<T>(client: PostmanClient, path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'x-api-key': client.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new CL3PostmanAPIError(
      `Postman API request failed: ${path} — HTTP ${response.status}`,
      response.status
    )
  }

  return response.json() as Promise<T>
}

export async function listCollections(client: PostmanClient): Promise<Collection[]> {
  const path = client.workspaceId
    ? `/collections?workspace=${client.workspaceId}`
    : '/collections'
  const data = await apiFetch<{ collections: Collection[] }>(client, path)
  return data.collections
}

export async function getCollection(client: PostmanClient, id: string): Promise<CollectionDetail> {
  const data = await apiFetch<{ collection: CollectionDetail }>(client, `/collections/${id}`)
  return data.collection
}

export async function getCollectionAsOpenAPI(client: PostmanClient, id: string): Promise<string> {
  const data = await apiFetch<unknown>(client, `/collections/${id}/transformations`)
  return JSON.stringify(data)
}

export async function createCollection(
  client: PostmanClient,
  name: string,
  _openapi: string
): Promise<{ id: string }> {
  const path = client.workspaceId
    ? `/collections?workspace=${client.workspaceId}`
    : '/collections'

  const body = {
    collection: {
      info: {
        name,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [],
    },
  }

  const data = await apiFetch<{ collection: { id: string } }>(client, path, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return { id: data.collection.id }
}

export async function updateCollection(
  client: PostmanClient,
  id: string,
  _openapi: string
): Promise<void> {
  await apiFetch<unknown>(client, `/collections/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      collection: {
        info: {
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      },
    }),
  })
}

export async function listWorkspaces(client: PostmanClient): Promise<Workspace[]> {
  const data = await apiFetch<{ workspaces: Workspace[] }>(client, '/workspaces')
  return data.workspaces
}

export async function createWorkspace(
  client: PostmanClient,
  name: string
): Promise<{ id: string }> {
  const data = await apiFetch<{ workspace: { id: string } }>(client, '/workspaces', {
    method: 'POST',
    body: JSON.stringify({ workspace: { name, type: 'personal' } }),
  })
  return { id: data.workspace.id }
}

export async function createEnvironment(
  client: PostmanClient,
  name: string,
  vars: Record<string, string>
): Promise<{ id: string }> {
  const values = Object.entries(vars).map(([key, value]) => ({
    key,
    value,
    enabled: true,
    type: 'default',
  }))

  const data = await apiFetch<{ environment: { id: string } }>(client, '/environments', {
    method: 'POST',
    body: JSON.stringify({ environment: { name, values } }),
  })

  return { id: data.environment.id }
}
