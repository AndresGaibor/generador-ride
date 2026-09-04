export type RideErrorCode =
  | 'RIDE_UNSUPPORTED_DOCUMENT'
  | 'RIDE_INVALID_INPUT'
  | 'RIDE_INVALID_LOGO'
  | 'RIDE_RENDER_FAILED';

export class RideError extends Error {
  readonly code: RideErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: RideErrorCode, options?: { cause?: unknown }) {
    super(message);
    this.code = code;
    this.cause = options?.cause;
    this.name = 'RideError';
    Object.setPrototypeOf(this, RideError.prototype);
  }
}
