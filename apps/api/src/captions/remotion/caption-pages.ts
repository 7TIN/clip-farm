import type { CaptionPage, CaptionToken } from "./types";

type PageInput = {
  tokens: CaptionToken[];
  maxWordsPerPage: number;
  maxPageDurationMs: number;
};

const punctuationBreakPattern = /[.!?;:]$/;

export function groupIntoPages(input: PageInput): CaptionPage[] {
  const { tokens, maxWordsPerPage, maxPageDurationMs } = input;

  if (!tokens.length) {
    return [];
  }

  const pages: CaptionPage[] = [];
  let currentTokens: CaptionToken[] = [];

  for (const token of tokens) {
    if (currentTokens.length === 0) {
      currentTokens.push(token);
      continue;
    }

    const pageStart = currentTokens[0]!.startMs;
    const durationIfAdded = token.endMs - pageStart;

    const wouldExceedDuration = durationIfAdded > maxPageDurationMs;
    const wouldExceedWords = currentTokens.length >= maxWordsPerPage;
    const prevEndsWithPunctuation = punctuationBreakPattern.test(
      currentTokens[currentTokens.length - 1]!.text.trim(),
    );

    if ((wouldExceedDuration || wouldExceedWords || prevEndsWithPunctuation) && currentTokens.length > 0) {
      pages.push(buildPage(currentTokens));
      currentTokens = [token];
    } else {
      currentTokens.push(token);
    }
  }

  if (currentTokens.length > 0) {
    pages.push(buildPage(currentTokens));
  }

  return pages;
}

function buildPage(tokens: CaptionToken[]): CaptionPage {
  const first = tokens[0]!;
  const last = tokens[tokens.length - 1]!;

  return {
    id: `page_${first.index}`,
    startMs: first.startMs,
    endMs: last.endMs,
    tokens,
  };
}

export function findActivePage(pages: CaptionPage[], currentTimeMs: number): CaptionPage | undefined {
  return pages.find((page) => currentTimeMs >= page.startMs && currentTimeMs < page.endMs);
}

export function findActiveToken(
  tokens: CaptionToken[],
  currentTimeMs: number,
): CaptionToken | undefined {
  return tokens.find(
    (token) => currentTimeMs >= token.startMs && currentTimeMs < token.endMs,
  );
}
