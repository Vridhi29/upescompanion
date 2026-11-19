export interface PolicySource {
  title: string;
  version?: string | null;
  url?: string | null;
  locator?: string | null;
  sourceType?: "account" | "local";
  content: string;
}

export interface RetrievedPolicyExcerpt {
  source: string;
  version: string | null;
  url: string | null;
  locator: string | null;
  sourceType: "account" | "local" | null;
  excerpt: string;
  relevance: number;
}

const STOP_WORDS = new Set([
  "what", "when", "where", "which", "who", "why", "how", "does", "do", "did", "and", "the", "for", "are", "can", "you", "your", "about", "many", "much", "is", "of", "to", "a", "an", "in", "on", "or", "with", "my", "i", "me", "please",
]);

function tokens(value: string): string[] {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
}

export function policyQueryTerms(query: string): string[] {
  return [...new Set(tokens(query).filter((term) => !STOP_WORDS.has(term)))];
}

/** Retrieves exact user-supplied policy passages; it never generates an answer. */
export function retrievePolicyExcerpts(sources: PolicySource[], query: string, limit = 8): RetrievedPolicyExcerpt[] {
  const terms = policyQueryTerms(query);
  if (!terms.length || !Number.isInteger(limit) || limit <= 0) return [];
  const phrase = terms.join(" ");

  return sources.flatMap((source, sourceIndex) =>
    source.content
      .split(/(?<=[.!?])\s+|\n+/)
      .map((raw, sentenceIndex) => {
        const excerpt = raw.trim();
        if (!excerpt) return null;
        const words = tokens(excerpt);
        const counts = new Map<string, number>();
        for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
        const matched = terms.filter((term) => counts.has(term));
        if (!matched.length) return null;
        const frequencyBonus = matched.reduce((sum, term) => sum + Math.min((counts.get(term) ?? 1) - 1, 2) * 0.15, 0);
        const phraseBonus = excerpt.toLocaleLowerCase().includes(phrase) ? 2 : 0;
        return {
          source: source.title,
          version: source.version || null,
          url: source.url || null,
          locator: source.locator || null,
          sourceType: source.sourceType || null,
          excerpt: excerpt.length > 900 ? `${excerpt.slice(0, 897).trimEnd()}…` : excerpt,
          relevance: matched.length + frequencyBonus + phraseBonus,
          sourceIndex,
          sentenceIndex,
        };
      })
      .filter((result): result is NonNullable<typeof result> => result !== null),
  )
    .sort((a, b) => b.relevance - a.relevance || a.sourceIndex - b.sourceIndex || a.sentenceIndex - b.sentenceIndex)
    .slice(0, limit)
    .map(({ sourceIndex: _sourceIndex, sentenceIndex: _sentenceIndex, ...result }) => result);
}
