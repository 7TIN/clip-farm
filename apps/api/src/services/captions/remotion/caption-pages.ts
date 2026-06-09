import type { CaptionPage, CaptionToken } from "./types";

export function createCaptionPages(
  tokens: CaptionToken[],
  maxWordsPerPage: number,
  maxPageDurationMs: number,
): CaptionPage[] {
  const pages: CaptionPage[] = [];
  let current: CaptionToken[] = [];

  for (const token of tokens) {
    const first = current[0];
    const wouldExceedWords = current.length >= maxWordsPerPage;
    const wouldExceedDuration = first
      ? token.endMs - first.startMs > maxPageDurationMs
      : false;
    const previousEndsSentence = current.length > 0 && /[.!?]$/.test(current[current.length - 1]!.text.trim());

    if (current.length > 0 && (wouldExceedWords || wouldExceedDuration || previousEndsSentence)) {
      pages.push(tokensToPage(current, pages.length));
      current = [];
    }

    current.push(token);
  }

  if (current.length > 0) {
    pages.push(tokensToPage(current, pages.length));
  }

  return pages;
}

export function activeCaptionPage(pages: CaptionPage[], currentMs: number) {
  return pages.find((page) => currentMs >= page.startMs && currentMs < page.endMs);
}

export function activeTokenIndex(page: CaptionPage | undefined, currentMs: number) {
  if (!page) {
    return -1;
  }

  return page.tokens.findIndex((token) => currentMs >= token.startMs && currentMs < token.endMs);
}

function tokensToPage(tokens: CaptionToken[], index: number): CaptionPage {
  return {
    id: `page_${index}`,
    startMs: tokens[0]?.startMs || 0,
    endMs: tokens[tokens.length - 1]?.endMs || 0,
    tokens,
  };
}