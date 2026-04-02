import { graphql, type GraphQLSchema } from 'graphql'

export interface GraphQLRequestBody {
  query: string
  variables?: Record<string, unknown>
  operationName?: string
}

/**
 * Execute a GraphQL request against a schema.
 * Returns a plain object suitable for serialisation as a JSON HTTP response.
 */
export async function executeGraphQL(
  schema: GraphQLSchema,
  body: GraphQLRequestBody
): Promise<{ data?: unknown; errors?: unknown[] }> {
  const result = await graphql({
    schema,
    source: body.query,
    variableValues: body.variables,
    operationName: body.operationName,
  })
  return result as { data?: unknown; errors?: unknown[] }
}

/**
 * Create a Next.js App Router route handler for GraphQL.
 *
 * Usage in app/api/graphql/route.ts:
 *
 *   import { createRouteHandler } from '@contentlayer3/graphql'
 *   import { schema } from '../../../cl3.graphql'
 *   export const { GET, POST } = createRouteHandler(schema)
 */
export function createRouteHandler(schema: GraphQLSchema): {
  GET: (req: Request) => Promise<Response>
  POST: (req: Request) => Promise<Response>
} {
  async function handle(req: Request): Promise<Response> {
    let body: GraphQLRequestBody

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const query = url.searchParams.get('query')
      if (!query) {
        return new Response(JSON.stringify({ errors: [{ message: 'Missing query parameter' }] }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const variables = url.searchParams.get('variables')
      body = {
        query,
        variables: variables ? (JSON.parse(variables) as Record<string, unknown>) : undefined,
        operationName: url.searchParams.get('operationName') ?? undefined,
      }
    } else {
      body = (await req.json()) as GraphQLRequestBody
    }

    const result = await executeGraphQL(schema, body)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return { GET: handle, POST: handle }
}
