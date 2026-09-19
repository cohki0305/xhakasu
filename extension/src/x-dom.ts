// X の DOM に依存するものはすべてこのファイルに置く。X 側の変更で壊れたら、直すのはここだけ。
export const SEL = {
  tweet: 'article[data-testid="tweet"]',
  text: '[data-testid="tweetText"]',
  cell: '[data-testid="cellInnerDiv"]',
  profileLink: 'a[data-testid="AppTabBar_Profile_Link"]',
} as const;

export type PostInfo = { id: string; text: string; handle: string };

const STATUS_RE = /^\/([^/]+)\/status\/(\d+)/;

export function readPost(article: Element): PostInfo | null {
  // 引用元や analytics へのリンクも /status/ を含む。投稿自身の permalink は <time> を包んでいる。
  const link =
    article.querySelector('a[href*="/status/"] time')?.closest("a") ?? article.querySelector('a[href*="/status/"]');
  const m = link?.getAttribute("href")?.match(STATUS_RE);
  if (!m) return null;
  const text = article.querySelector(SEL.text)?.textContent?.trim() ?? "";
  return { id: m[2]!, text, handle: m[1]! };
}

export function cellOf(article: Element): HTMLElement {
  return (article.closest(SEL.cell) ?? article) as HTMLElement;
}

export function myHandle(doc: Document): string | null {
  const href = doc.querySelector(SEL.profileLink)?.getAttribute("href");
  return href ? href.replace(/^\//, "") : null;
}

export type PageKind = { kind: "skip" } | { kind: "list" } | { kind: "status"; id: string };

export function pageKind(pathname: string): PageKind {
  if (/^\/(notifications|messages|settings)(\/|$)/.test(pathname)) return { kind: "skip" };
  const m = pathname.match(STATUS_RE);
  return m ? { kind: "status", id: m[2]! } : { kind: "list" };
}
