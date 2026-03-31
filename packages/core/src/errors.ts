export class CL3ValidationError extends Error {
  constructor(
    public readonly collectionName: string,
    public readonly filePath: string,
    public readonly fieldPath: string,
    public readonly issue: string
  ) {
    super(`[CL3] Validation error in '${collectionName}' at ${filePath}: ${fieldPath} — ${issue}`)
    this.name = 'CL3ValidationError'
  }
}

export class CL3SourceError extends Error {
  constructor(public readonly collectionName: string, cause: Error) {
    super(`[CL3] Source error in '${collectionName}': ${cause.message}`, { cause })
    this.name = 'CL3SourceError'
  }
}
