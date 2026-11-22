/* ============================================================
   🏡 쿠사리 타운 · Kusari Village — app.js
   기본 명단(data/sites.js) + 내가 입주시킨 건물(localStorage)
   ============================================================ */
(function () {
  "use strict";

  const BASE = window.KUSARI_TOWN || { districts: [], presets: [], sites: [] };
  const GH_USER = "MinseoHaeseoFa";

  const KEY = {
    custom: "kusari-village:v1:custom-sites",
    fav: "kusari-village:v1:favorites",
    theme: "kusari-village:v1:theme",
    view: "kusari-village:v1:view"
  };

  const DISTRICTS = BASE.districts;
  const PRESETS = BASE.presets;
  const BASE_SITES = BASE.sites.map((s) => Object.assign({ custom: false }, s));

  const state = {
    custom: [],
    favs: [],
    filter: "all",
    query: "",
    view: "map",
    editingId: null,
    detailId: null
  };

  /* ── 저장소 ───────────────────────────────────────────── */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 저장이 막힌 환경(사생활 보호 모드 등)에서는 이번 방문만 반영 */
    }
  }

  state.custom = read(KEY.custom, []).filter((s) => s && s.id && s.name && s.url);
  state.favs = read(KEY.fav, []).filter((id) => typeof id === "string");
  state.view = read(KEY.view, "map") === "deck" ? "deck" : "map";

  /* ── 도우미 ───────────────────────────────────────────── */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }
  function districtOf(id) {
    return DISTRICTS.find((d) => d.id === id) || DISTRICTS[0];
  }
  function presetOf(id) {
    return PRESETS.find((p) => p.id === id) || PRESETS[0];
  }
  function allSites() {
    return BASE_SITES.concat(state.custom);
  }
  function siteById(id) {
    return allSites().find((s) => s.id === id) || null;
  }
  function isFav(id) {
    return state.favs.indexOf(id) > -1;
  }
  function repoUrl(repo) {
    if (!repo) return "";
    return /^https?:\/\//i.test(repo) ? repo : "https://github.com/" + GH_USER + "/" + repo;
  }
  function normalizeUrl(input) {
    let v = String(input || "").trim();
    if (!v) return "";
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = "https://" + v;
    return v;
  }
  function isValidUrl(v) {
    try {
      const u = new URL(v);
      return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname.includes(".");
    } catch (e) {
      return false;
    }
  }
  function shortUrl(v) {
    return String(v || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  function parseTags(input) {
    return String(input || "")
      .split(/[,，、]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 4)
      .map((t) => t.slice(0, 14));
  }

  /* ── 토스트 ───────────────────────────────────────────── */
  const toastEl = $("#toast");
  let toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add("is-visible"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("is-visible");
      setTimeout(() => { toastEl.hidden = true; }, 320);
    }, 2400);
  }

  /* ── 장식(가로수·표지판·가로등) ────────────────────────── */
  const ornaments = {
    travel: [
      ['tree', 34, 45], ['bush', 44, 31], ['flower', 22, 25], ['tree', 30, 40],
      ['sign', 30, 45], ['bush', 40, 28], ['tree', 32, 43], ['lamp', 24, 46]
    ],
    creative: [
      ['flower', 22, 25], ['tree', 30, 40], ['bush', 40, 28], ['sign', 28, 42],
      ['tree', 34, 45], ['flower', 22, 25], ['bush', 42, 30], ['lamp', 24, 46]
    ],
    work: [
      ['tree', 34, 45], ['sign', 30, 45], ['bush', 42, 30], ['tree', 30, 40],
      ['flower', 22, 25], ['bush', 40, 28], ['tree', 32, 43], ['lamp', 24, 46]
    ],
    sprout: [
      ['bush', 40, 28], ['flower', 22, 25], ['tree', 30, 40], ['flower', 22, 25],
      ['bush', 42, 30], ['tree', 32, 43], ['sign', 28, 42], ['lamp', 24, 46]
    ]
  };
  function streetHtml(districtId) {
    const set = ornaments[districtId] || ornaments.travel;
    return set.map(([kind, w, h]) =>
      `<svg class="orn orn--${kind}" width="${w}" height="${h}" aria-hidden="true"><use href="#s-${kind}"/></svg>`
    ).join("");
  }

  /* ── 마을 지도 그리기 ─────────────────────────────────── */
  const districtsEl = $("#districts");

  function plotHtml(site) {
    const d = districtOf(site.district);
    const preset = presetOf(site.building);
    const fav = isFav(site.id);
    const tags = (site.tags || []).slice(0, 2)
      .map((t, i) => `<span class="tag${i === 1 ? " tag--soft" : ""}">${esc(t)}</span>`).join("");
    return `
      <article class="plot" data-id="${esc(site.id)}" role="button" tabindex="0"
               aria-label="${esc(site.name)} 자세히 보기" style="--d-accent:${d.accent}">
        <button type="button" class="plot__fav${fav ? " is-on" : ""}" data-fav="${esc(site.id)}"
                aria-pressed="${fav}" aria-label="${esc(site.name)} 즐겨찾기" title="즐겨찾기 핀">
          <span aria-hidden="true">★</span>
        </button>
        ${fav ? '<span class="plot__pin" aria-hidden="true">⭐ 핀 고정</span>' : ""}
        <div class="plot__media">
          <img class="plot__img" src="${esc(preset.img)}" alt="${esc(preset.name)} 건물 그림"
               width="360" height="270" />
        </div>
        <div class="plot__name"><span>${esc(site.name)}</span></div>
        <div class="plot__tags">${tags}</div>
      </article>`;
  }

  function addPlotHtml(districtId) {
    const d = districtOf(districtId);
    return `
      <button type="button" class="plot plot--add" data-action="add" data-district="${esc(districtId)}"
              style="--d-accent:${d.accent}" aria-label="${esc(d.name)}에 새 건물 입주">
        <span class="addmark" aria-hidden="true">＋</span>
        <span class="addtext">신규 입주 부지</span>
        <span class="addsub">눌러서 새 사이트를<br/>이 자리에 세워 보세요</span>
      </button>`;
  }

  function renderMap() {
    if (!districtsEl) return;
    const sites = allSites();
    const html = DISTRICTS.map((d) => {
      const owns = sites.filter((s) => s.district === d.id);
      if (d.id === "sprout" && owns.length === 0) return "";
      return `
        <section class="district${d.id === "sprout" ? " district--sprout" : ""}"
                 data-district="${esc(d.id)}"
                 style="--tint:${d.tint};--lawn:${d.lawn};--d-accent:${d.accent}">
          <header class="district__head">
            <span class="district__emoji" aria-hidden="true">${d.emoji}</span>
            <div class="district__meta">
              <h2 class="district__title">${esc(d.name)} <em>${esc(d.en)}</em></h2>
              <p class="district__desc">${esc(d.desc)}</p>
            </div>
            <span class="district__count"><i aria-hidden="true"></i>${owns.length}채</span>
          </header>
          <div class="district__street" aria-hidden="true">${streetHtml(d.id)}</div>
          <div class="plots">
            ${owns.map(plotHtml).join("")}
            ${addPlotHtml(d.id)}
          </div>
        </section>`;
    }).join("");
    districtsEl.innerHTML = html;
  }

  /* ── 앱 덱 그리기 ─────────────────────────────────────── */
  const deckEl = $("#deckGrid");
  const emptyEl = $("#deckEmpty");
  const chipsEl = $("#filterChips");

  const FILTERS = [
    { id: "all", label: "전체", icon: "🏘️" },
    { id: "travel", label: "여행", icon: "🧭" },
    { id: "creative", label: "창작", icon: "📸" },
    { id: "work", label: "업무", icon: "🏛️" },
    { id: "fav", label: "즐겨찾기", icon: "⭐" }
  ];

  const GH_ICON = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';

  function chipHtml() {
    return FILTERS.map((f) => `
      <button type="button" class="chip${state.filter === f.id ? " is-active" : ""}"
              data-filter="${f.id}" aria-pressed="${state.filter === f.id}">
        <span aria-hidden="true">${f.icon}</span> ${f.label}
      </button>`).join("");
  }

  function filteredSites() {
    const q = state.query.trim().toLowerCase();
    return allSites().filter((s) => {
      if (state.filter === "fav" && !isFav(s.id)) return false;
      if (state.filter !== "all" && state.filter !== "fav" && s.district !== state.filter) return false;
      if (!q) return true;
      const hay = [s.name, s.desc, (s.tags || []).join(" "), districtOf(s.district).name].join(" ").toLowerCase();
      return hay.indexOf(q) > -1;
    });
  }

  function cardHtml(site) {
    const d = districtOf(site.district);
    const preset = presetOf(site.building);
    const fav = isFav(site.id);
    const repo = repoUrl(site.repo);
    return `
      <article class="card" data-id="${esc(site.id)}">
        <div class="card__thumb">
          <img src="${esc(preset.img)}" alt="${esc(preset.name)} 건물 그림" width="92" height="92"
               loading="lazy" />
        </div>
        <div class="card__body">
          <div class="card__top">
            <h3 class="card__name">${esc(site.name)}</h3>
            <button type="button" class="card__star${fav ? " is-on" : ""}" data-fav="${esc(site.id)}"
                    aria-pressed="${fav}" aria-label="${esc(site.name)} 즐겨찾기" title="즐겨찾기">
              <span aria-hidden="true">★</span>
            </button>
          </div>
          <span class="card__dist" style="color:${d.accent}"><i aria-hidden="true"></i>${d.emoji} ${esc(d.name)}</span>
          <p class="card__desc">${esc(site.desc || "아직 소개 글이 없어요.")}</p>
          <div class="card__foot">
            <a class="card__open" href="${esc(site.url)}" target="_blank" rel="noopener">열기 <span aria-hidden="true">↗</span></a>
            ${repo ? `<a class="card__repo" href="${esc(repo)}" target="_blank" rel="noopener" title="GitHub 저장소" aria-label="${esc(site.name)} GitHub 저장소">${GH_ICON}</a>` : ""}
            <button type="button" class="card__more" data-open="${esc(site.id)}">자세히</button>
          </div>
        </div>
      </article>`;
  }

  function renderDeck() {
    if (!deckEl) return;
    if (chipsEl) chipsEl.innerHTML = chipHtml();
    const list = filteredSites();
    deckEl.innerHTML = list.map(cardHtml).join("");
    const empty = list.length === 0;
    emptyEl.hidden = !empty;
    deckEl.hidden = empty;
    if (empty) {
      const title = $(".empty__title", emptyEl);
      const desc = $(".empty__desc", emptyEl);
      if (state.filter === "fav") {
        title.textContent = "아직 즐겨찾기 핀이 없어요";
        desc.textContent = "마을 지도나 카드에서 ⭐를 눌러 두면 여기에 모여요.";
      } else if (state.query) {
        title.textContent = "‘" + state.query + "’ 와 맞는 사이트가 없어요";
        desc.textContent = "다른 말로 찾아보거나 검색어를 지워 보세요.";
      } else {
        title.textContent = "이 자리에는 아직 아무도 살지 않아요";
        desc.textContent = "새 건물을 입주시켜 마을을 채워 보세요.";
      }
    }
  }

  /* ── 상단 요약 ────────────────────────────────────────── */
  function renderStats() {
    const sites = allSites();
    const used = new Set(sites.map((s) => s.district));
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("statSites", sites.length);
    set("statDistricts", Math.max(used.size, 3));
    set("statFav", state.favs.filter((id) => !!siteById(id)).length);
    set("statCustom", state.custom.length);
    set("footerCount", sites.length);
    const lead = $("#heroLead");
    if (lead) {
      lead.textContent = state.custom.length
        ? "지금 마을에는 사이트 " + sites.length + "채가 살고 있어요. 새로 입주한 " + state.custom.length + "채도 문을 열었어요."
        : "지금 마을에는 사이트 " + sites.length + "채가 살고 있어요. 건물을 눌러 문을 두드려 보세요.";
    }
  }

  function renderAll() {
    renderMap();
    renderDeck();
    renderStats();
    if (state.detailId && $("#detailModal") && !$("#detailModal").hidden) fillDetail(state.detailId);
  }

  /* ── 즐겨찾기 ─────────────────────────────────────────── */
  function toggleFav(id) {
    if (!siteById(id)) return;
    const i = state.favs.indexOf(id);
    const on = i === -1;
    if (on) state.favs.push(id); else state.favs.splice(i, 1);
    write(KEY.fav, state.favs);
    renderAll();
    if (state.detailId === id) fillDetail(id);
    const name = siteById(id).name;
    toast(on ? "⭐ " + name + " 핀을 고정했어요" : name + " 핀을 풀었어요");
  }

  /* ── 테마 ─────────────────────────────────────────────── */
  const themeToggle = $("#themeToggle");
  const themeLabel = $("#themeLabel");

  function applyTheme(theme, persist) {
    const t = theme === "sunset" ? "sunset" : "day";
    document.documentElement.setAttribute("data-theme", t);
    if (themeLabel) themeLabel.textContent = t === "sunset" ? "노을" : "낮";
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", String(t === "sunset"));
      themeToggle.setAttribute("aria-label", t === "sunset" ? "낮으로 바꾸기" : "노을로 바꾸기");
      const knob = $(".theme-toggle__knob", themeToggle);
      if (knob) knob.textContent = t === "sunset" ? "🌙" : "☀️";
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "sunset" ? "#3B2A46" : "#FAF6EE");
    if (persist) write(KEY.theme, t);
  }
  applyTheme(read(KEY.theme, "day"), false);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "sunset" ? "day" : "sunset";
      applyTheme(next, true);
      toast(next === "sunset" ? "🌅 노을이 내려앉았어요" : "☀️ 맑은 낮이에요");
    });
  }

  /* ── 보기 전환 ────────────────────────────────────────── */
  const views = { map: $("#view-map"), deck: $("#view-deck") };

  function setView(view, persist) {
    state.view = view === "deck" ? "deck" : "map";
    Object.keys(views).forEach((k) => { if (views[k]) views[k].hidden = k !== state.view; });
    $$(".segmented__btn").forEach((b) => {
      const on = b.dataset.view === state.view;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    if (persist) write(KEY.view, state.view);
  }
  $$(".segmented__btn").forEach((b) => {
    b.addEventListener("click", () => setView(b.dataset.view, true));
  });

  /* ── 모달 공통 ────────────────────────────────────────── */
  let lastFocus = null;

  function openModal(el) {
    if (!el) return;
    lastFocus = document.activeElement;
    el.hidden = false;
    document.body.style.overflow = "hidden";
    const sheet = $(".sheet", el);
    if (sheet) setTimeout(() => sheet.focus({ preventScroll: true }), 30);
  }
  function closeModal(el) {
    if (!el) return;
    el.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
  }
  function anyModalOpen() {
    return $$(".modal").some((m) => !m.hidden);
  }
  function topModal() {
    const open = $$(".modal").filter((m) => !m.hidden);
    return open[open.length - 1] || null;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && anyModalOpen()) {
      const m = topModal();
      if (m.id === "detailModal") state.detailId = null;
      closeModal(m);
      return;
    }
    if (e.key !== "Tab") return;
    const m = topModal();
    if (!m) return;
    const focusables = $$('a[href], button:not([disabled]), input:not([type="hidden"]), textarea, select, [tabindex]:not([tabindex="-1"])', m)
      .filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  $$(".modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) {
        if (m.id === "detailModal") state.detailId = null;
        closeModal(m);
      }
    });
  });

  /* ── 건물 상세 ────────────────────────────────────────── */
  const detailModal = $("#detailModal");

  function fillDetail(id) {
    const site = siteById(id);
    if (!site) { closeModal(detailModal); state.detailId = null; return; }
    const d = districtOf(site.district);
    const preset = presetOf(site.building);
    const fav = isFav(site.id);
    const repo = repoUrl(site.repo);

    $("#detailImg").src = preset.img;
    $("#detailImg").alt = preset.name + " 건물 그림";
    $("#detailDistrict").textContent = d.emoji + " " + d.name;
    $("#detailPin").hidden = !fav;
    $("#detailBuilding").textContent = preset.name + " · " + preset.en;
    $("#detailTitle").textContent = site.name;
    $("#detailDesc").textContent = site.desc || "아직 소개 글이 없어요. 정보를 수정해 한 줄 소개를 남겨 보세요.";
    $("#detailTags").innerHTML = (site.tags || [])
      .map((t, i) => `<li><span class="tag${i % 2 ? " tag--soft" : ""}">${esc(t)}</span></li>`).join("");
    $("#detailUrl").textContent = shortUrl(site.url);
    $("#detailUrl").href = site.url;
    $("#detailOpen").href = site.url;

    const repoBtn = $("#detailRepo");
    if (repo) { repoBtn.hidden = false; repoBtn.href = repo; }
    else { repoBtn.hidden = true; repoBtn.removeAttribute("href"); }

    const favBtn = $("#detailFav");
    favBtn.classList.toggle("is-fav", fav);
    favBtn.setAttribute("aria-pressed", String(fav));
    favBtn.textContent = fav ? "⭐ 핀 고정됨" : "⭐ 즐겨찾기";

    const manage = $("#detailManage");
    manage.hidden = !site.custom;
    if (site.custom) {
      manage.innerHTML = `
        <button type="button" class="btn btn--soft" id="detailEdit">✏️ 정보 수정</button>
        <button type="button" class="btn btn--danger" id="detailDelete">🗑 이 건물 철거</button>`;
      $("#detailEdit").addEventListener("click", () => openForm("edit", site.id));
      $("#detailDelete").addEventListener("click", () => askDelete(site));
    }
  }

  function askDelete(site) {
    const manage = $("#detailManage");
    manage.innerHTML = `
      <p class="confirm__text"><strong>${esc(site.name)}</strong> 을(를) 마을에서 철거할까요? 되돌릴 수 없어요.</p>
      <button type="button" class="btn btn--quiet" id="delCancel">취소</button>
      <button type="button" class="btn btn--danger" id="delOk">철거하기</button>`;
    manage.classList.add("is-confirming");
    $("#delCancel").addEventListener("click", () => fillDetail(site.id));
    $("#delOk").addEventListener("click", () => {
      state.custom = state.custom.filter((s) => s.id !== site.id);
      state.favs = state.favs.filter((id) => id !== site.id);
      write(KEY.custom, state.custom);
      write(KEY.fav, state.favs);
      state.detailId = null;
      closeModal(detailModal);
      renderAll();
      toast("🧹 " + site.name + " 을(를) 철거했어요");
    });
  }

  function openDetail(id) {
    state.detailId = id;
    fillDetail(id);
    openModal(detailModal);
  }

  if ($("#detailFav")) {
    $("#detailFav").addEventListener("click", () => { if (state.detailId) toggleFav(state.detailId); });
  }

  /* ── 입주 / 수정 폼 ───────────────────────────────────── */
  const formModal = $("#formModal");
  const form = $("#siteForm");
  const formError = $("#formError");

  function pickHtml() {
    return DISTRICTS.map((d) => `
      <label class="pick" data-pick-value="${esc(d.id)}">
        <input type="radio" name="district" value="${esc(d.id)}" />
        <span aria-hidden="true">${d.emoji}</span> ${esc(d.name)}
      </label>`).join("");
  }
  function buildingPickHtml() {
    return PRESETS.map((p) => `
      <label class="bpick" data-pick-value="${esc(p.id)}" title="${esc(p.name)}">
        <input type="radio" name="building" value="${esc(p.id)}" />
        <img src="${esc(p.img)}" alt="" width="120" height="120" loading="lazy" />
        <span>${esc(p.name)}</span>
      </label>`).join("");
  }

  function markPick(container, value) {
    $$(".pick, .bpick", container).forEach((el) => {
      const input = $("input", el);
      const on = input.value === value;
      input.checked = on;
      el.classList.toggle("is-checked", on);
    });
  }

  function openForm(mode, siteId, districtId) {
    state.editingId = mode === "edit" ? siteId : null;
    const site = mode === "edit" ? siteById(siteId) : null;

    $("#formEyebrow").textContent = site ? "EDIT SITE" : "NEW SITE";
    $("#formTitle").textContent = site ? "건물 정보 수정" : "새 건물 입주";
    $("#formSubmit").textContent = site ? "수정 저장" : "입주시키기";
    $("#fName").value = site ? site.name : "";
    $("#fUrl").value = site ? site.url : "";
    $("#fDesc").value = site ? site.desc || "" : "";
    $("#fTags").value = site ? (site.tags || []).join(", ") : "";

    $("#districtPick").innerHTML = pickHtml();
    $("#buildingPick").innerHTML = buildingPickHtml();

    const district = site ? site.district : (districtId || "travel");
    const building = site ? site.building : "travel-hub";
    markPick($("#districtPick"), district);
    markPick($("#buildingPick"), building);

    $$(".pick, .bpick", formModal).forEach((el) => {
      const input = $("input", el);
      input.addEventListener("change", () => markPick(el.parentElement, input.value));
    });

    inValidate(null);
    openModal(formModal);
    setTimeout(() => $("#fName").focus({ preventScroll: true }), 60);
  }

  function inValidate(msg) {
    if (!formError) return;
    if (msg) { formError.textContent = msg; formError.hidden = false; }
    else { formError.textContent = ""; formError.hidden = true; }
  }

  $$(".pick, .bpick").forEach(() => {}); // no-op (picks are rendered per open)

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#fName").value.trim();
      const rawUrl = $("#fUrl").value.trim();
      const desc = $("#fDesc").value.trim();
      const tags = parseTags($("#fTags").value);
      const districtInput = $('#siteForm input[name="district"]:checked');
      const buildingInput = $('#siteForm input[name="building"]:checked');
      const district = districtInput ? districtInput.value : "travel";
      const building = buildingInput ? buildingInput.value : "travel-hub";

      ["#fName", "#fUrl"].forEach((s) => $(s).classList.remove("is-invalid"));

      if (!name) {
        $("#fName").classList.add("is-invalid");
        inValidate("사이트 이름을 적어 주세요.");
        $("#fName").focus();
        return;
      }
      const url = normalizeUrl(rawUrl);
      if (!url || !isValidUrl(url)) {
        $("#fUrl").classList.add("is-invalid");
        inValidate("주소를 다시 확인해 주세요. 예) https://example.com");
        $("#fUrl").focus();
        return;
      }
      const dup = allSites().find((s) => s.id !== state.editingId &&
        normalizeUrl(s.url).replace(/\/$/, "") === url.replace(/\/$/, ""));
      if (dup) {
        $("#fUrl").classList.add("is-invalid");
        inValidate("이미 입주한 주소예요 (" + dup.name + "). 다른 주소를 넣어 주세요.");
        $("#fUrl").focus();
        return;
      }

      if (state.editingId) {
        const target = state.custom.find((s) => s.id === state.editingId);
        if (target) {
          Object.assign(target, { name, url, desc, tags, district, building });
          write(KEY.custom, state.custom);
          toast("✏️ " + name + " 정보를 고쳤어요");
        }
      } else {
        const newSite = {
          id: "custom-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name, url, desc, tags,
          repo: "",
          district, building,
          custom: true,
          addedAt: new Date().toISOString()
        };
        state.custom.push(newSite);
        write(KEY.custom, state.custom);
        toast("🎉 " + name + " 이(가) " + districtOf(district).name + "에 입주했어요");
      }

      const editing = state.editingId;
      state.editingId = null;
      closeModal(formModal);
      state.filter = "all";
      state.query = "";
      if ($("#searchInput")) $("#searchInput").value = "";
      if ($("#searchClear")) $("#searchClear").hidden = true;
      renderAll();
      setView(state.view, false);

      if (!editing) {
        const id = state.custom[state.custom.length - 1].id;
        setTimeout(() => {
          const el = districtsEl && districtsEl.querySelector('[data-id="' + id + '"]');
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("plot--just-added");
            setTimeout(() => el.classList.remove("plot--just-added"), 2600);
          }
        }, 120);
      }
    });
  }

  /* ── 폼 열기 버튼들 ───────────────────────────────────── */
  if ($("#addBtn")) $("#addBtn").addEventListener("click", () => openForm("add"));
  $$('[data-action="add"]').forEach(() => {}); // delegation handles rendered plots
  if ($("#deckEmpty")) {
    const addInEmpty = $('[data-action="add"]', $("#deckEmpty"));
    if (addInEmpty) addInEmpty.addEventListener("click", () => openForm("add"));
  }

  /* ── 이벤트 위임: 마을 ────────────────────────────────── */
  if (districtsEl) {
    districtsEl.addEventListener("click", (e) => {
      const fav = e.target.closest("[data-fav]");
      if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); return; }
      const add = e.target.closest('[data-action="add"]');
      if (add) { openForm("add", null, add.dataset.district); return; }
      const plot = e.target.closest(".plot[data-id]");
      if (plot) { openDetail(plot.dataset.id); }
    });
    districtsEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const plot = e.target.closest('.plot[data-id]');
      if (plot && e.target === plot) { e.preventDefault(); openDetail(plot.dataset.id); }
    });
  }

  /* ── 이벤트 위임: 덱 ──────────────────────────────────── */
  if (deckEl) {
    deckEl.addEventListener("click", (e) => {
      const fav = e.target.closest("[data-fav]");
      if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); return; }
      const open = e.target.closest("[data-open]");
      if (open) { openDetail(open.dataset.open); return; }
      const card = e.target.closest(".card");
      if (card && !e.target.closest("a, button")) openDetail(card.dataset.id);
    });
  }
  if (chipsEl) {
    chipsEl.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter]");
      if (!chip) return;
      state.filter = chip.dataset.filter;
      renderDeck();
    });
  }

  /* ── 검색 ─────────────────────────────────────────────── */
  const searchInput = $("#searchInput");
  const searchClear = $("#searchClear");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.query = searchInput.value;
      if (searchClear) searchClear.hidden = !state.query;
      renderDeck();
    });
  }
  if (searchClear) {
    searchClear.addEventListener("click", () => {
      state.query = "";
      if (searchInput) { searchInput.value = ""; searchInput.focus(); }
      searchClear.hidden = true;
      renderDeck();
    });
  }

  /* ── 내보내기 ─────────────────────────────────────────── */
  function exportJson() {
    const sites = allSites().map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      repo: s.repo || "",
      district: s.district,
      building: s.building,
      desc: s.desc || "",
      tags: s.tags || [],
      custom: !!s.custom
    }));
    const payload = {
      app: "kusari-village",
      version: 1,
      exportedAt: new Date().toISOString(),
      count: sites.length,
      customCount: sites.filter((s) => s.custom).length,
      favorites: state.favs.slice(),
      sites
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kusari-village-sites-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    toast("📋 사이트 " + sites.length + "곳을 JSON으로 내보냈어요");
  }
  if ($("#exportBtn")) $("#exportBtn").addEventListener("click", exportJson);
  if ($("#formExportBtn")) $("#formExportBtn").addEventListener("click", exportJson);

  /* ── 시작 ─────────────────────────────────────────────── */
  setView(state.view, false);
  renderAll();
})();
