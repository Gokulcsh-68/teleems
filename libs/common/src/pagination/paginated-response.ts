export class PaginatedResponse<T> {
  constructor(
    public readonly data: T[],
    public readonly next_cursor: string | null,
    public readonly total_count: number,
  ) {}
}

/**
 * Utility to encode a database cursor (like an ID or Timestamp) into an opaque string
 */
export function encodeCursor(value: string | number | Date): string {
  const normalizedValue = value instanceof Date ? value.toISOString() : String(value);
  return Buffer.from(normalizedValue).toString('base64');
}

/**
 * Utility to decode an opaque cursor back into its raw value
 */
export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('ascii');
}
