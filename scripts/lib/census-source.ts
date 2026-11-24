/** TubeCensus canonical IDs are 24 ASCII characters followed by LF (25 bytes). */
export const CENSUS_URLS = [
  'https://zenodo.org/records/18267682/files/census_ids.txt?download=1',
  'https://zenodo.org/api/records/18267682/files/census_ids.txt/content',
];

export async function fetchCensusIds(offset: number, limit: number, urls = CENSUS_URLS): Promise<string[]> {
  const start = offset * 25;
  const end = (offset + limit) * 25 - 1;
  const errors: string[] = [];
  for (const url of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { Range: `bytes=${start}-${end}`, 'User-Agent': 'InfluxScout/1.0 (channel discovery)' },
          signal: AbortSignal.timeout(60_000),
        });
        const range = res.headers.get('content-range');
        if (res.status !== 206 || !range?.startsWith(`bytes ${start}-`)) {
          await res.body?.cancel();
          throw new Error(`HTTP ${res.status}; expected byte range starting at ${start}`);
        }
        const text = await res.text();
        const ids = text.trimEnd().split('\n');
        if (!text.endsWith('\n') || ids.length > limit || ids.some(id => !/^UC[\w-]{22}$/.test(id))) {
          throw new Error('Unexpected census format; checkpoint was not advanced');
        }
        return ids;
      } catch (error) {
        errors.push(`${new URL(url).pathname}: ${error instanceof Error ? error.message : error}`);
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  throw new Error(`Census download failed: ${errors.join('; ')}`);
}
