export const normalizeForMatch = (value: string): string => {
  const s = String(value ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!s) return '';

  const tokens = s.split(' ').map((token) => {
    if (token.length <= 3) return token;

    // Basic singularization so tomato/tomatoes match.
    if (token.endsWith('ies') && token.length > 4) return token.slice(0, -3) + 'y';
    if (token.endsWith('oes') && token.length > 4) return token.slice(0, -2); // tomatoes -> tomato
    if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
    if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);

    return token;
  });

  return tokens.join(' ');
};

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const m = a.length;
  const n = b.length;

  // Use two rows to keep memory small.
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);

    for (let j = 1; j <= n; j++) {
      const cb = b.charCodeAt(j - 1);
      const cost = ca === cb ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }

    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[n];
};

export const similarityScore = (a: string, b: string): number => {
  const na = normalizeForMatch(a).replace(/\s+/g, '');
  const nb = normalizeForMatch(b).replace(/\s+/g, '');
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;

  const dist = levenshteinDistance(na, nb);
  const denom = Math.max(na.length, nb.length);
  return denom === 0 ? 1 : 1 - dist / denom;
};

export const fuzzyMatch = (
  query: string,
  candidate: string,
  threshold = 0.78
): boolean => {
  const q = normalizeForMatch(query);
  const c = normalizeForMatch(candidate);

  if (!q) return true;
  if (!c) return false;

  // Fast path: substring.
  if (c.includes(q)) return true;

  // Compare against tokens as well as full string.
  const candidateTokens = c.split(' ').filter(Boolean);
  let best = similarityScore(q, c);

  for (const token of candidateTokens) {
    const score = similarityScore(q, token);
    if (score > best) best = score;
    if (best >= threshold) return true;
  }

  return best >= threshold;
};
