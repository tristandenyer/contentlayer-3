export interface TransformResult {
  transformed: boolean
  output: string
  warnings: Warning[]
}

export interface Warning {
  line?: number
  message: string
  requiresManualReview: boolean
}

export interface MigrationSummary {
  filesModified: string[]
  filesChecked: string[]
  warnings: Array<{ file: string } & Warning>
  transformations: string[]
}
