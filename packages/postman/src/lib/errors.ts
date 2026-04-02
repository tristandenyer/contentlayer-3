export class CL3PostmanError extends Error {
  constructor(message: string, public readonly code: string) {
    super(`[contentlayer3/postman] ${message}`)
    this.name = 'CL3PostmanError'
  }
}

export class CL3PostmanDriftError extends CL3PostmanError {}

export class CL3PostmanUnregisteredError extends CL3PostmanError {
  constructor(sourceName: string) {
    super(
      `'${sourceName}' is not governed. Run: contentlayer3 postman adopt ${sourceName}`,
      'POSTMAN_UNREGISTERED'
    )
    this.name = 'CL3PostmanUnregisteredError'
  }
}

export class CL3PostmanAPIError extends CL3PostmanError {
  constructor(message: string, public readonly status: number) {
    super(message, 'POSTMAN_API_ERROR')
  }
}
