export class CL3GraphQLError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message)
    this.name = 'CL3GraphQLError'
  }
}

export class CL3GraphQLSchemaError extends CL3GraphQLError {
  constructor(message: string) {
    super(message, 'GRAPHQL_SCHEMA_ERROR')
    this.name = 'CL3GraphQLSchemaError'
  }
}

export class CL3GraphQLResolverError extends CL3GraphQLError {
  constructor(message: string) {
    super(message, 'GRAPHQL_RESOLVER_ERROR')
    this.name = 'CL3GraphQLResolverError'
  }
}
