// Keyset pagination prevents permanently pending or failing rows from starving later rows.
// Every page is attempted before failures are reported to the job retry mechanism.
export async function processPages<T extends { id: string }>(
  fetchPage: (after?: string) => Promise<T[]>,
  process: (item: T) => Promise<unknown>,
): Promise<void> {
  let after: string | undefined;
  let failures = 0;
  for (;;) {
    const items = await fetchPage(after);
    if (!items.length) break;
    for (const item of items) {
      try {
        await process(item);
      } catch {
        failures++;
      }
    }
    const next = items[items.length - 1].id;
    if (next === after) throw new Error('Batch cursor did not advance');
    after = next;
  }
  // Do not include provider response bodies, tokens or personal data in job errors.
  if (failures) throw new Error(`${failures} batch item(s) failed; retry required`);
}
