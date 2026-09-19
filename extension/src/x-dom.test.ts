import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { cellOf, myHandle, pageKind, readPost } from "./x-dom";

function dom(html: string): Document {
  const w = new Window();
  w.document.body.innerHTML = html;
  return w.document as unknown as Document;
}

const tweet = (handle: string, id: string, text: string, extra = "") => `
  <div data-testid="cellInnerDiv">
    <article data-testid="tweet">
      <a href="/${handle}/status/${id}"><time datetime="2026-09-19">1h</time></a>
      ${text ? `<div data-testid="tweetText">${text}</div>` : ""}
      ${extra}
    </article>
  </div>`;

test("ID・本文・ハンドルを読む", () => {
  const d = dom(tweet("mika_dev", "1700000000000000001", "D1 のマイグレーション"));
  expect(readPost(d.querySelector("article")!)).toEqual({ id: "1700000000000000001", text: "D1 のマイグレーション", handle: "mika_dev" });
});

test("引用された投稿のリンクではなく、時刻のついたリンクを ID に使う", () => {
  const quoted = `<div><a href="/other/status/999">引用元</a></div>`;
  const d = dom(`<article data-testid="tweet">${quoted}<a href="/me/status/123/analytics">x</a><a href="/me/status/123"><time>1h</time></a><div data-testid="tweetText">本文</div></article>`);
  expect(readPost(d.querySelector("article")!)!.id).toBe("123");
});

test("本文がなければ text は空文字", () => {
  const d = dom(tweet("neko", "5", ""));
  expect(readPost(d.querySelector("article")!)).toEqual({ id: "5", text: "", handle: "neko" });
});

test("status リンクがなければ null", () => {
  const d = dom(`<article data-testid="tweet"><div data-testid="tweetText">広告</div></article>`);
  expect(readPost(d.querySelector("article")!)).toBeNull();
});

test("cellOf は外側の枠を返し、なければ article 自身", () => {
  const d = dom(tweet("a", "1", "x"));
  const art = d.querySelector("article")!;
  expect(cellOf(art).getAttribute("data-testid")).toBe("cellInnerDiv");
  const bare = dom(`<article data-testid="tweet"></article>`).querySelector("article")!;
  expect(cellOf(bare)).toBe(bare as unknown as HTMLElement);
});

test("myHandle は左メニューのプロフィールリンクから読む", () => {
  expect(myHandle(dom(`<a data-testid="AppTabBar_Profile_Link" href="/cohki0305">Profile</a>`))).toBe("cohki0305");
  expect(myHandle(dom(`<div></div>`))).toBeNull();
});

test("pageKind", () => {
  expect(pageKind("/home")).toEqual({ kind: "list" });
  expect(pageKind("/search")).toEqual({ kind: "list" });
  expect(pageKind("/i/lists/123")).toEqual({ kind: "list" });
  expect(pageKind("/mika_dev/status/1700")).toEqual({ kind: "status", id: "1700" });
  expect(pageKind("/mika_dev/status/1700/photo/1")).toEqual({ kind: "status", id: "1700" });
  expect(pageKind("/notifications")).toEqual({ kind: "skip" });
  expect(pageKind("/messages/123")).toEqual({ kind: "skip" });
  expect(pageKind("/settings/account")).toEqual({ kind: "skip" });
});

test("同じ article 要素に別の投稿が入ったら、別の ID として読める", () => {
  const d = dom(tweet("a", "1", "最初"));
  const art = d.querySelector("article")!;
  expect(readPost(art)!.id).toBe("1");
  art.innerHTML = `<a href="/b/status/2"><time>1m</time></a><div data-testid="tweetText">次</div>`;
  expect(readPost(art)).toEqual({ id: "2", text: "次", handle: "b" });
});
