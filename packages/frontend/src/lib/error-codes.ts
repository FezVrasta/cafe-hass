/**
 * Error codes for translatable error messages.
 * Used with TranslatableError to throw errors that can be translated in the UI.
 */
export const ErrorCodes = {
  // Validation errors
  EMPTY_AUTOMATION: 'validation.emptyAutomation',
  NO_TRIGGER: 'validation.noTrigger',
  NO_ACTION: 'validation.noAction',
  VALIDATION_FAILED: 'validation.validationFailed',
  TRANSPILE_FAILED: 'validation.transpileFailed',
  NO_AUTOMATION_ID: 'validation.noAutomationId',

  // Connection errors
  NO_CONNECTION: 'connection.noConnection',
  NO_AUTH: 'connection.noAuth',
  AUTH_FAILED: 'connection.authFailed',
  CORS_ERROR: 'connection.corsError',
  CONNECTION_LOST: 'connection.connectionLost',
  RECONNECT_FAILED: 'connection.reconnectFailed',
  NOT_CONNECTED: 'connection.notConnected',
  NO_METHOD: 'connection.noMethod',
  UNEXPECTED_RESPONSE: 'connection.unexpectedResponse',
  CONNECTION_FAILED: 'connection.connectionFailed',

  // API errors
  HTTP_ERROR: 'api.httpError',
  CREATE_FAILED: 'api.createFailed',
  UPDATE_FAILED: 'api.updateFailed',
  DELETE_FAILED: 'api.deleteFailed',
  IMPORT_FAILED: 'api.importFailed',

  // Form errors
  NAME_REQUIRED: 'form.nameRequired',
  URL_TOKEN_REQUIRED: 'form.urlTokenRequired',

  // Import errors
  FILE_READ_FAILED: 'import.fileReadFailed',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * An error that carries a translation key and optional interpolation params.
 * Components can catch this error type and use i18n to translate the message.
 *
 * @example
 * // Throwing a TranslatableError
 * throw new TranslatableError(ErrorCodes.EMPTY_AUTOMATION);
 *
 * // With interpolation params
 * throw new TranslatableError(ErrorCodes.VALIDATION_FAILED, { errors: 'Missing entity_id' });
 *
 * // Catching and translating
 * catch (err) {
 *   if (err instanceof TranslatableError) {
 *     const message = t(`errors:${err.code}`, err.params);
 *   }
 * }
 */
export class TranslatableError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly params?: Record<string, string | number>
  ) {
    super(code); // Use code as message for logging
    this.name = 'TranslatableError';
  }
}

/**
 * Helper to get a translated error message from an error.
 * Falls back to the raw error message if not a TranslatableError.
 */
export function getErrorMessage(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (error instanceof TranslatableError) {
    return t(`errors:${error.code}`, error.params);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return t('errors:api.unknownError');
}
