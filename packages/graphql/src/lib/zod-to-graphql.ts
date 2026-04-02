import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull,
  GraphQLEnumType,
  GraphQLUnionType,
  GraphQLScalarType,
  type GraphQLOutputType,
  type GraphQLFieldConfigMap,
} from 'graphql'
import { z } from 'zod'
import { CL3GraphQLSchemaError } from './errors.js'

// Custom scalar for arbitrary JSON values
export const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize: (value: unknown) => value,
  parseValue: (value: unknown) => value,
  parseLiteral: () => null,
})

const typeCache = new Map<string, GraphQLObjectType>()

/**
 * Convert a Zod type to a GraphQL output type.
 * Falls back to JSONScalar for complex/unknown shapes.
 */
export function zodTypeToGraphQL(
  zodType: z.ZodTypeAny,
  name: string
): GraphQLOutputType {
  // Unwrap optional/nullable
  if (zodType instanceof z.ZodOptional || zodType instanceof z.ZodNullable) {
    return zodTypeToGraphQL(zodType.unwrap(), name)
  }

  if (zodType instanceof z.ZodDefault) {
    return zodTypeToGraphQL(zodType._def.innerType, name)
  }

  if (zodType instanceof z.ZodString) return GraphQLString
  if (zodType instanceof z.ZodNumber) {
    // Distinguish int vs float via checks
    return zodType._def.checks?.some((c: { kind: string }) => c.kind === 'int')
      ? GraphQLInt
      : GraphQLFloat
  }
  if (zodType instanceof z.ZodBoolean) return GraphQLBoolean

  if (zodType instanceof z.ZodArray) {
    const inner = zodTypeToGraphQL(zodType.element, `${name}Item`)
    return new GraphQLList(new GraphQLNonNull(inner))
  }

  if (zodType instanceof z.ZodEnum) {
    const values = zodType._def.values as string[]
    const enumName = `${name}Enum`
    return new GraphQLEnumType({
      name: enumName,
      values: Object.fromEntries(values.map((v) => [v, { value: v }])),
    })
  }

  if (zodType instanceof z.ZodUnion) {
    const types = (zodType._def.options as z.ZodTypeAny[]).map((opt, i) => {
      const converted = zodTypeToGraphQL(opt, `${name}Option${i}`)
      if (converted instanceof GraphQLObjectType) return converted
      return null
    }).filter((t): t is GraphQLObjectType => t !== null)

    if (types.length >= 2) {
      return new GraphQLUnionType({ name: `${name}Union`, types })
    }
    return JSONScalar
  }

  if (zodType instanceof z.ZodObject) {
    return zodObjectToGraphQLType(zodType, name)
  }

  // Fallback for records, unknowns, any, etc.
  return JSONScalar
}

/**
 * Convert a ZodObject to a named GraphQLObjectType.
 * Uses a cache to avoid duplicate type definitions.
 */
export function zodObjectToGraphQLType(
  schema: z.ZodObject<z.ZodRawShape>,
  typeName: string
): GraphQLObjectType {
  if (typeCache.has(typeName)) {
    return typeCache.get(typeName)!
  }

  const shape = schema.shape
  const fields: GraphQLFieldConfigMap<unknown, unknown> = {}

  for (const [key, value] of Object.entries(shape)) {
    const gqlType = zodTypeToGraphQL(value as z.ZodTypeAny, `${typeName}_${key}`)
    const isOptional =
      value instanceof z.ZodOptional ||
      value instanceof z.ZodNullable ||
      value instanceof z.ZodDefault

    fields[key] = {
      type: isOptional ? gqlType : new GraphQLNonNull(gqlType),
    }
  }

  if (Object.keys(fields).length === 0) {
    throw new CL3GraphQLSchemaError(
      `Collection type "${typeName}" has no fields. Add at least one field to the Zod schema.`
    )
  }

  const objectType = new GraphQLObjectType({ name: typeName, fields })
  typeCache.set(typeName, objectType)
  return objectType
}

/** Clear the type cache — useful between test runs. */
export function clearTypeCache(): void {
  typeCache.clear()
}
