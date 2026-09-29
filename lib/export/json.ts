export const JSON_MIME = "application/json;charset=utf-8";

/** Converts column-ordered rows into an array of records. */
export function rowsToRecords<T>(headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<T>>): Array<Record<string, T>> {
  return rows.map((row) => {
    const record: Record<string, T> = {};
    headers.forEach((h, i) => {
      record[h] = row[i];
    });
    return record;
  });
}

export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}
