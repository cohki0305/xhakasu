import type { Settings } from "../../shared/types";
import type { ClassifyReply, Msg } from "./messages";
import { loadSettings } from "./settings";
import { Tracker, type PostState } from "./tracker";
import { SEL, cellOf, myHandle, pageKind, readPost } from "./x-dom";

const STATE = "data-xhk-state";
const ID = "data-xhk-id";
const send = (msg: Msg) => chrome.runtime.sendMessage(msg);

let settings: Settings;
let tracker: Tracker;

function apply(id: string, state: PostState): void {
  for (const article of document.querySelectorAll(`article[${ID}="${id}"]`)) {
    const cell = cellOf(article);
    if (state === "shown") cell.removeAttribute(STATE);
    else cell.setAttribute(STATE, state);
  }
}

function clearAll(): void {
  for (const el of document.querySelectorAll(`[${STATE}]`)) el.removeAttribute(STATE);
  for (const el of document.querySelectorAll(`[${ID}]`)) el.removeAttribute(ID);
}

function scan(): void {
  if (settings.paused) return;
  const page = pageKind(location.pathname);
  if (page.kind === "skip") return clearAll();

  // X は表示枠を使い回す。投稿が抜けた枠に前の印が残っていたら外す
  for (const cell of document.querySelectorAll(`[${STATE}]`)) {
    if (!cell.querySelector(`article[${ID}]`) && !cell.matches(`article[${ID}]`)) cell.removeAttribute(STATE);
  }

  const me = myHandle(document);
  for (const article of document.querySelectorAll(SEL.tweet)) {
    const post = readPost(article);
    if (!post) continue;
    if (article.getAttribute(ID) === post.id) continue; // この枠のこの投稿は処理済み
    article.setAttribute(ID, post.id);
    cellOf(article).removeAttribute(STATE);
    const isOpened = page.kind === "status" && page.id === post.id;
    tracker.see(
      { id: post.id, text: post.text },
      { exempt: isOpened || (me !== null && post.handle === me), skipGenre: page.kind === "status" },
    );
  }
}

let scheduled = false;
function scheduleScan(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scan();
  });
}

async function start(): Promise<void> {
  settings = await loadSettings();
  tracker = new Tracker(
    {
      classify: async (posts) => {
        const reply = (await send({ type: "classify", posts })) as ClassifyReply;
        if (!reply.ok) throw new Error(reply.error);
        return reply.body;
      },
      apply,
      onHidden: (reason) => void send({ type: "count", reason }),
    },
    settings,
  );

  new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });

  chrome.storage.onChanged.addListener(async (changes) => {
    if (!changes.settings && !changes.accessKey) return;
    settings = await loadSettings();
    tracker.updateSettings(settings);
    clearAll(); // 印を外して再スキャン。Tracker が Verdict を持っていれば問い合わせは起きない
    scan();
  });

  scan();
}

void start();
