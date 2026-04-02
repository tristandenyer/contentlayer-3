import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import { hashFile } from './hash.js'

const GENERATED_DIR = join(process.cwd(), '.contentlayer3', 'generated')

function schemaPath(name: string): string {
  return join(GENERATED_DIR, `${name}.schema.ts`)
}

export async function writeGeneratedSchema(name: string, content: string): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  await writeFile(schemaPath(name), content, 'utf-8')
}

export async function readGeneratedSchema(name: string): Promise<string | null> {
  try {
    return await readFile(schemaPath(name), 'utf-8')
  } catch {
    return null
  }
}

export async function generatedSchemaExists(name: string): Promise<boolean> {
  try {
    await access(schemaPath(name), constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function hashGeneratedSchema(name: string): Promise<string | null> {
  const content = await readGeneratedSchema(name)
  if (content === null) return null
  return hashFile(content)
}
