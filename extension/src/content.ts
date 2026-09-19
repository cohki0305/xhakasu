import type { HiddenInfo, Settings } from "../../shared/types";
import type { ClassifyReply, Msg } from "./messages";
import { loadSettings } from "./settings";
import { Tracker, type PostState } from "./tracker";
import { SEL, cellOf, myHandle, pageKind, readPost } from "./x-dom";

const STATE = "data-xhk-state";
const ID = "data-xhk-id";
const LABEL = "data-xhk-label"; // バーに出す文言。CSS の attr() が読む
const OPEN = "data-xhk-open"; // バーをクリックして開いている
const STYLE = "data-xhk-style"; // "remove" のときは跡を残さず消す
const OURS = "data-xhk-tab"; // tabindex をこちらで付けた印
const send = (msg: Msg) => chrome.runtime.sendMessage(msg);

let settings: Settings;
let tracker: Tracker;

function unmark(cell: Element): void {
  for (const attr of [STATE, LABEL, OPEN, STYLE]) cell.removeAttribute(attr);
  if (cell.hasAttribute(OURS)) {
    cell.removeAttribute(OURS);
    cell.removeAttribute("tabindex");
  }
}

function apply(id: string, state: PostState, hidden?: HiddenInfo): void {
  for (const article of document.querySelectorAll(`article[${ID}="${id}"]`)) {
    const cell = cellOf(article);
    unmark(cell);
    if (state === "shown") continue;
    cell.setAttribute(STATE, state);
    if (state !== "hidden" || !hidden) continue;
    if (settings.hiddenStyle === "remove") {
      cell.setAttribute(STYLE, "remove");
    } else {
      cell.setAttribute(LABEL, hidden.label);
      cell.setAttribute(OURS, "");
      cell.setAttribute("tabindex", "0"); // キーボードでもバーに届くようにする
    }
  }
}

function clearAll(): void {
  for (const el of document.querySelectorAll(`[${STATE}]`)) unmark(el);
  for (const el of document.querySelectorAll(`[${ID}]`)) el.removeAttribute(ID);
}

// バーは枠の ::before で描いている。中の投稿は非表示なので、枠そのものが target になるのはバーを押したときだけ
function toggleBar(e: Event): void {
  const cell = e.target as Element | null;
  if (!cell || typeof cell.getAttribute !== "function") return; // document や window が target のこともある
  if (cell.getAttribute(STATE) !== "hidden" || !cell.hasAttribute(LABEL)) return;
  if (e.type === "keydown" && !["Enter", " "].includes((e as KeyboardEvent).key)) return;
  e.preventDefault();
  e.stopPropagation();
  cell.toggleAttribute(OPEN);
}

function scan(): void {
  if (settings.paused) return;
  const page = pageKind(location.pathname);
  if (page.kind === "skip") return clearAll();

  // X は表示枠を使い回す。投稿が抜けた枠に前の印が残っていたら外す
  for (const cell of document.querySelectorAll(`[${STATE}]`)) {
    if (!cell.querySelector(`article[${ID}]`) && !cell.matches(`article[${ID}]`)) unmark(cell);
  }

  const me = myHandle(document);
  for (const article of document.querySelectorAll(SEL.tweet)) {
    const post = readPost(article);
    if (!post) continue;
    if (article.getAttribute(ID) === post.id) continue; // この枠のこの投稿は処理済み
    article.setAttribute(ID, post.id);
    unmark(cellOf(article));
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

  document.addEventListener("click", toggleBar, true);
  document.addEventListener("keydown", toggleBar, true);
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
