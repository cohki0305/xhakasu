import { OTHER_ID } from "../../shared/defaults";
import type { Genre, Settings, Strictness } from "../../shared/types";
import { loadSettings, saveSettings } from "./settings";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let settings: Settings;

function renderGenres(): void {
  const box = $("genres");
  box.replaceChildren(
    ...settings.genres.map((g, i) => {
      const row = document.createElement("div");
      row.className = "genre";

      const wanted = Object.assign(document.createElement("input"), { type: "checkbox", checked: g.wanted, id: `wanted-${g.id}` });
      wanted.setAttribute("aria-label", `${g.name} を表示する`);
      wanted.onchange = () => (settings.genres[i]!.wanted = wanted.checked);

      const name = Object.assign(document.createElement("input"), { type: "text", value: g.name, id: `name-${g.id}`, maxLength: 30 });
      name.setAttribute("aria-label", "ジャンル名");
      name.oninput = () => (settings.genres[i]!.name = name.value);

      const desc = Object.assign(document.createElement("input"), { type: "text", value: g.description, id: `desc-${g.id}`, maxLength: 200 });
      desc.setAttribute("aria-label", `${g.name} の説明文`);
      desc.oninput = () => (settings.genres[i]!.description = desc.value);

      const del = Object.assign(document.createElement("button"), { type: "button", textContent: "削除", disabled: g.id === OTHER_ID });
      del.onclick = () => {
        settings.genres.splice(i, 1);
        renderGenres();
      };

      row.append(wanted, name, desc, del);
      return row;
    }),
  );
  $<HTMLButtonElement>("add").disabled = settings.genres.length >= 20;
}

function addGenre(): void {
  const genre: Genre = { id: `g_${Date.now().toString(36)}`, name: "新しいジャンル", description: "", wanted: true };
  settings.genres.splice(settings.genres.length - 1, 0, genre); // 「その他」は常に末尾
  renderGenres();
  $(`name-${genre.id}`).focus();
}

async function save(): Promise<void> {
  const status = $("status");
  const blank = settings.genres.find((g) => !g.name.trim() || !g.description.trim());
  if (blank) {
    status.textContent = "名前と説明文が空のジャンルがあります。入力するか削除してください。";
    return;
  }
  settings.hideOffensive = $<HTMLInputElement>("hideOffensive").checked;
  settings.hideSexual = $<HTMLInputElement>("hideSexual").checked;
  settings.strictness = document.querySelector<HTMLInputElement>('input[name="strictness"]:checked')!.value as Strictness;
  settings.relayUrl = $<HTMLInputElement>("relayUrl").value.trim();
  settings.accessKey = $<HTMLInputElement>("accessKey").value;
  await saveSettings(settings);
  status.textContent = "保存しました。開いている X のタブにすぐ反映されます。";
}

async function init(): Promise<void> {
  settings = await loadSettings();
  renderGenres();
  $<HTMLInputElement>("hideOffensive").checked = settings.hideOffensive;
  $<HTMLInputElement>("hideSexual").checked = settings.hideSexual;
  document.querySelector<HTMLInputElement>(`input[name="strictness"][value="${settings.strictness}"]`)!.checked = true;
  $<HTMLInputElement>("relayUrl").value = settings.relayUrl;
  $<HTMLInputElement>("accessKey").value = settings.accessKey;
  $("add").onclick = addGenre;
  $("save").onclick = () => void save();
}

void init();
