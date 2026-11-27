/* ============================================================
   🏡 쿠사리 빌리지 v8 — app.js
   2.5D 마을 지도 · 본부/별관 계층 · 카메라/투어/걷기
   시간대(낮·노을·밤) 자동 전환 + 현지 실시간 날씨 풍경
   기본 명단(data/sites.js) + 내가 입주시킨 건물(localStorage)
   ============================================================ */
(function () {
  "use strict";

  const CFG = window.KUSARI_TOWN || { world: { w: 2400, h: 1900 }, districts: [], presets: [], sites: [] };
  const W = CFG.world || { w: 2400, h: 1900 };
  const DISTRICTS = CFG.districts || [];
  const PRESETS = CFG.presets || [];
  const GH_USER = "MinseoHaeseoFa";

  const KEY = {
    custom: "kusari-village:v2:custom-sites",
    fav: "kusari-village:v2:favorites",
    theme: "kusari-village:v4:time-mode",
    wx: "kusari-village:v4:weather-mode",
    view: "kusari-village:v2:view",
    coach: "kusari-village:v2:coach-seen",
    v1custom: "kusari-village:v1:custom-sites",
    v1fav: "kusari-village:v1:favorites",
    v1theme: "kusari-village:v1:theme"
  };

  /* ── 도우미 ───────────────────────────────────────────── */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }
  function read(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 사생활 보호 모드 등 */ }
  }
  function districtOf(id) { return DISTRICTS.find((d) => d.id === id) || DISTRICTS[0]; }
  function presetOf(id) { return PRESETS.find((p) => p.id === id) || PRESETS[0]; }
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
    try { const u = new URL(v); return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname.includes("."); }
    catch (e) { return false; }
  }
  function shortUrl(v) { return String(v || "").replace(/^https?:\/\//, "").replace(/\/$/, ""); }
  function parseTags(input) {
    return String(input || "").split(/[,，、]/).map((t) => t.trim()).filter(Boolean).slice(0, 4).map((t) => t.slice(0, 14));
  }

  /* ── 상태 ─────────────────────────────────────────────── */
  const state = {
    custom: [], favs: [],
    filter: "all", query: "",
    view: "map", mode: "browse",
    detailId: null, editingId: null,
    timeMode: "auto",
    wxMode: "auto",
    wx: { code: null, temp: null, key: "clear", loaded: false, place: "" },
    cam: { cx: W.w / 2, cy: W.h / 2, s: 0.55 },
    walk: { x: 1180, y: 1832, vx: 0, vy: 0, target: null, face: 1, moving: false, last: 0 },
    nearId: null,
    tour: { on: false, i: 0, timer: null, stops: [], leg: null },
    hoverDistrict: null
  };

  const BASE_SITES = (CFG.sites || []).map((s) => Object.assign({}, s, { custom: false }));

  function allSites() { return BASE_SITES.concat(state.custom); }
  function siteById(id) { return allSites().find((s) => s.id === id) || null; }

  /* 열림 방식 — 우리가 직접 컨트롤할 수 없는 외부 사이트(노션 등)는 새 탭,
     우리가 만든 자체 웹앱(repo 가 있는 사이트)은 기존처럼 같은 탭에서 이동한다.
     · newTab === true  → 새 탭
     · repo 가 없음     → 새 탭 (우리 저장소가 없는 바깥 사이트)
     · repo 가 있음     → 같은 탭 (우리가 배포·수정하는 자체 웹앱)                        */
  function opensInNewTab(site) {
    if (!site) return false;
    return site.newTab === true || !site.repo;
  }
  function linkTarget(site) {
    return opensInNewTab(site) ? ' target="_blank" rel="noopener noreferrer"' : "";
  }
  function openWord(site) {
    return opensInNewTab(site) ? "새 탭에서 열기" : "사이트로 이동";
  }

  /* 사이트로 바로 이동 — 모달 없이. 자체 웹앱은 같은 탭(_self),
     외부 사이트는 새 탭(_blank)으로 열어 이 빌리지 화면을 남겨 둔다. */
  function goToSite(site) {
    if (!site || !site.url) return;
    if (state.tour.on) stopTour();
    hideCoach();
    if (opensInNewTab(site)) {
      const w = window.open(site.url, "_blank", "noopener,noreferrer");
      if (w) { try { w.opener = null; } catch (err) { /* noopener 로 이미 끊김 */ } }
      return;
    }
    window.location.href = site.url;
  }
  function isFav(id) { return state.favs.indexOf(id) > -1; }
  function childrenOf(id) { return allSites().filter((s) => s.tier === 2 && s.parent === id); }
  function isHub(site) { return childrenOf(site.id).length > 0; }
  function roleOf(site) {
    if (site.role) return site.role;
    if (site.tier === 2) {
      const p = siteById(site.parent);
      return "별관 · " + (p ? p.name : "본부") + " 하위";
    }
    return districtOf(site.district).name + " · 독립 사이트";
  }
  function widthOf(site) {
    if (site.w) return site.w;
    return site.tier === 2 ? 168 : 250;
  }

  /* ── 저장된 데이터 ─────────────────────────────────────── */
  (function loadState() {
    let custom = read(KEY.custom, null);
    if (!Array.isArray(custom)) {
      const v1 = read(KEY.v1custom, []);
      custom = Array.isArray(v1) ? v1.map((s, i) => Object.assign({}, s, {
        tier: 1, parent: null, pos: positionForNew(s.district, null),
        role: districtOf(s.district).name + " · 독립 사이트"
      })) : [];
    }
    state.custom = custom.filter((s) => s && s.id && s.name && s.url).map((s) => {
      if (!Array.isArray(s.pos)) s.pos = positionForNew(s.district, s.parent);
      return s;
    });
    const fav = read(KEY.fav, null) || read(KEY.v1fav, []);
    state.favs = Array.isArray(fav) ? fav.filter((id) => typeof id === "string") : [];
  })();

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
      setTimeout(() => { toastEl.hidden = true; }, 300);
    }, 2600);
  }

  /* ── 카메라 ───────────────────────────────────────────── */
  const stage = $("#stage");
  const world = $("#world");
  let vw = window.innerWidth, vh = window.innerHeight;
  const MAX_S = 2.0;
  let minScale = 0.3;
  let camAnim = null;

  const isNarrow = () => vw < 760;
  function fitScale() { return Math.min(vw / W.w, vh / W.h); }
  /* 지도가 화면을 꽉 채우는 최소 배율(cover) — 지도 바깥 배경이 드러나지 않는다 */
  function coverScale() { return Math.max(vw / W.w, vh / W.h) * 1.004; }
  /* 화면 종류별 최소 배율
     · 모바일(좁은 화면): cover — 지도가 화면을 가득 채운다
     · PC(넓은 화면): fit — 마을 전체가 위아래 잘리지 않고 한눈에 들어온다.
       지도 밖으로 드러나는 자리는 마을 들판(잔디·강·숲)이 이어져 경계가 보이지 않는다. */
  function fitViewScale() { return fitScale() * 0.93; }
  function minScaleFor() { return isNarrow() ? coverScale() : fitViewScale(); }
  function dZoom(base) { return Math.max(minScale, base * (isNarrow() ? 0.62 : 1)); }

  function clampCam() {
    /* 풀스크린: 지도 가장자리가 화면 밖으로 나가도록만 클램핑한다 (바깥 배경 노출 0) */
    const visW = vw / state.cam.s, visH = vh / state.cam.s;
    state.cam.cx = visW >= W.w ? W.w / 2 : clamp(state.cam.cx, visW / 2, W.w - visW / 2);
    state.cam.cy = visH >= W.h ? W.h / 2 : clamp(state.cam.cy, visH / 2, W.h - visH / 2);
  }

  let miniViewEl = null;
  let zoomTag = null;
  function applyCam() {
    state.cam.s = clamp(state.cam.s, minScale, MAX_S);
    clampCam();
    const s = state.cam.s;
    const tx = vw / 2 - state.cam.cx * s;
    const ty = vh / 2 - state.cam.cy * s;
    world.style.transform = "translate3d(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px,0) scale(" + s.toFixed(4) + ")";
    const tag = s < 0.34 ? "tiny" : (s < 0.46 ? "far" : (s < 0.95 ? "mid" : "near"));
    if (tag !== zoomTag) { world.dataset.zoom = tag; zoomTag = tag; }
    updateMiniView();
  }

  function setCenter(cx, cy, s) {
    state.cam.cx = cx; state.cam.cy = cy;
    if (s) state.cam.s = s;
    applyCam();
  }

  function panTo(cx, cy, s, dur) {
    dur = dur == null ? 1000 : dur;
    const from = { cx: state.cam.cx, cy: state.cam.cy, s: state.cam.s };
    const to = { cx: cx, cy: cy, s: clamp(s || state.cam.s, minScale, MAX_S) };
    if (dur <= 0) { setCenter(to.cx, to.cy, to.s); return; }
    cancelAnimationFrame(camAnim);
    const t0 = performance.now();
    (function step(now) {
      const t = clamp((now - t0) / dur, 0, 1);
      const e = easeInOut(t);
      state.cam.cx = lerp(from.cx, to.cx, e);
      state.cam.cy = lerp(from.cy, to.cy, e);
      state.cam.s = lerp(from.s, to.s, e);
      applyCam();
      if (t < 1) camAnim = requestAnimationFrame(step);
    })(t0);
  }
  function stopCamAnim() { cancelAnimationFrame(camAnim); }

  function resize() {
    vw = window.innerWidth; vh = window.innerHeight;
    minScale = minScaleFor();
    if (state.cam.s < minScale) state.cam.s = minScale;
    applyCam();
    fxResize();
  }
  window.addEventListener("resize", () => { resize(); });

  /* 초기 카메라 — PC 는 마을 전체가 한눈에 들어오는 fit 배율에서 시작한다 */
  (function initCam() {
    minScale = minScaleFor();
    if (isNarrow()) {
      state.cam.s = minScale * 1.16;
      state.cam.cx = 1010; state.cam.cy = 700;
      applyCam();
      setTimeout(() => panTo(1010, 780, minScale, 1100), 140);
    } else {
      state.cam.s = minScale;
      state.cam.cx = W.w / 2; state.cam.cy = W.h / 2;
      applyCam();
    }
  })();

  /* ── 드래그 · 휠 · 핀치 ───────────────────────────────── */
  const pointers = new Map();
  let dragging = false, dragMoved = 0, lastMid = null, pinchDist = 0, pinchS = 1;

  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
    if (e.target.closest(".bld")) { /* 건물 클릭도 드래그 가능 */ }
    /* 포인터 캡처를 쓰면 클릭이 stage 로 재조준되어 건물 클릭이 먹지 않는다.
       이동·해제는 window 리스너로 받으므로 캡처가 필요 없다. */
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true; dragMoved = 0; stage.classList.add("is-dragging");
      stopTourIfUser();
    } else if (pointers.size === 2) {
      const p = Array.from(pointers.values());
      pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      pinchS = state.cam.s;
      lastMid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
    }
    if (state.mode === "walk") {
      // 걷기 모드: 탭한 곳으로 걸어감
      const rect = stage.getBoundingClientRect();
      const wx = (e.clientX - rect.left - (vw / 2 - state.cam.cx * state.cam.s)) / state.cam.s;
      const wy = (e.clientY - rect.top - (vh / 2 - state.cam.cy * state.cam.s)) / state.cam.s;
      state.walk.target = { x: wx, y: wy };
    }
  });

  function pointerMove(e) {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1 && dragging) {
      dragMoved += Math.abs(dx) + Math.abs(dy);
      if (dragMoved > 3) {
        stopCamAnim();
        state.cam.cx -= dx / state.cam.s;
        state.cam.cy -= dy / state.cam.s;
        if (state.mode === "walk") state.walk.target = null;
        applyCam();
      }
    } else if (pointers.size === 2) {
      const p = Array.from(pointers.values());
      const dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const mid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
      if (pinchDist > 0) {
        const nextS = clamp(pinchS * (dist / pinchDist), minScale, MAX_S);
        if (lastMid) {
          state.cam.cx -= (mid.x - lastMid.x) / state.cam.s;
          state.cam.cy -= (mid.y - lastMid.y) / state.cam.s;
        }
        state.cam.s = nextS;
        applyCam();
      }
      lastMid = mid;
    }
  }

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      dragging = false;
      stage.classList.remove("is-dragging");
      setTimeout(() => { dragMoved = 0; }, 30);
    }
    if (pointers.size < 2) { pinchDist = 0; lastMid = null; }
  }
  window.addEventListener("pointermove", pointerMove, { passive: true });
  window.addEventListener("pointerup", endPointer);
  window.addEventListener("pointercancel", endPointer);
  stage.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") endPointer(e); });

  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    stopTourIfUser();
    const rect = stage.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const s0 = state.cam.s;
    const s1 = clamp(s0 * Math.exp(-e.deltaY * 0.0016), minScale, MAX_S);
    const wx = state.cam.cx + (px - vw / 2) / s0;
    const wy = state.cam.cy + (py - vh / 2) / s0;
    state.cam.s = s1;
    state.cam.cx = wx - (px - vw / 2) / s1;
    state.cam.cy = wy - (py - vh / 2) / s1;
    applyCam();
  }, { passive: false });

  /* ── 지형(터레인) ─────────────────────────────────────── */
  /* 마을 바깥 들판(apron) — 넓은 PC 화면에서 마을 전체가 보여도 지도 경계나
     이질적인 단색이 드러나지 않도록 같은 잔디·강·숲을 사방으로 이어 붙인다.
     좌표계는 마을 (0,0)-(2400,1900) 그대로이고, 그 둘레로만 땅을 더 둔다. */
  const PAD = { l: 1400, t: 1100, r: 1400, b: 1100 };
  const RIVER = "M -1500 1136 C -1100 1072 -520 1024 -80 1024 C 260 994 520 1064 860 1056 C 1040 1052 1140 1028 1240 1042 C 1420 1066 1600 1084 1800 1058 C 2000 1032 2200 1012 2480 1036 C 2900 1054 3300 1014 3800 1090";
  /* 오솔길 — 다리 위 삼거리(1160,740)에서 여행 지구(서쪽)와 창작 골목(동쪽)으로 갈라진다.
     (지형 SVG 는 viewBox 높이 때문에 화면에 120 만큼 아래로 그려진다 — 길은 그만큼 당겨서 적는다) */
  const ROADS = [
    "M 1180 2860 L 1180 1046",
    "M 1180 1040 C 1180 950 1172 860 1160 740",
    "M 1160 740 C 1100 722 1012 646 952 604 C 926 586 894 580 862 580",
    "M 1180 1116 C 1152 1216 1100 1310 1005 1390",
    "M 1180 1476 C 1300 1458 1424 1398 1524 1368 C 1652 1330 1780 1324 1904 1314",
    "M 1160 740 C 1290 746 1420 752 1550 760 C 1680 768 1760 780 1822 802"
  ];

  const TREES = [
    [150, 300, 1.0], [108, 520, 0.8], [206, 762, 0.9], [112, 1132, 0.85], [64, 1220, 0.9],
    [318, 262, 0.85], [432, 146, 1.0], [648, 132, 0.9], [864, 112, 0.82], [1122, 104, 0.88],
    [1382, 112, 0.95], [1624, 96, 0.9], [1862, 124, 1.0], [2104, 172, 0.9], [2286, 318, 0.95],
    [2342, 566, 1.0], [2368, 846, 0.85], [2312, 1196, 0.9], [2226, 1436, 1.0], [2058, 1818, 0.9],
    [1782, 1840, 0.85], [1518, 1850, 0.8], [1330, 1856, 0.8], [1030, 1868, 0.9], [742, 1868, 0.85],
    [430, 1866, 0.9], [400, 1470, 0.62], [300, 1560, 0.75], [850, 1560, 0.75], [1486, 560, 0.62], [1560, 980, 0.7], [2050, 980, 0.72],
    [330, 1042, 0.6], [960, 250, 0.6], [1060, 246, 0.55], [1300, 1082, 0.6], [1080, 1200, 0.6]
  ];
  const BUSHES = [
    [238, 618, 0.9], [252, 918, 0.8], [352, 1236, 0.85], [1060, 1250, 0.8], [1470, 1210, 0.8],
    [1960, 1180, 0.85], [2148, 620, 0.9], [1636, 260, 0.85], [842, 236, 0.8], [586, 226, 0.8],
    [1722, 962, 0.75], [860, 1078, 0.8], [1288, 700, 0.7], [1120, 780, 0.7], [232, 828, 0.7]
  ];
  const FLOWERS = [
    [300, 700, 0.9], [330, 742, 0.75], [268, 760, 0.8], [1080, 1692, 0.9], [1128, 1738, 0.8],
    [1236, 1734, 0.85], [1180, 1766, 0.75], [880, 640, 0.8], [1150, 640, 0.8], [1616, 806, 0.9],
    [1652, 842, 0.8], [2020, 1024, 0.85], [200, 1448, 0.8], [930, 1448, 0.8], [382, 1582, 0.8],
    [352, 1522, 0.7], [768, 1582, 0.8], [798, 1522, 0.7], [2140, 500, 0.8]
  ];
  const LAMPS = [
    [1108, 1128, 1.0], [1256, 1000, 1.0], [1006, 732, 0.9], [1288, 860, 0.85],
    [356, 1226, 0.85], [745, 1300, 0.85], [1646, 760, 0.85], [1904, 1002, 0.85],
    [1060, 1600, 0.9], [1300, 1430, 0.9], [1180, 1236, 0.8]
  ];
  const BENCHES = [[1070, 1640, 0.9], [570, 1818, 0.9], [640, 1880, 0.85], [1146, 726, 0.8], [1520, 618, 0.8], [1888, 1120, 0.85]];
  const ROCKS = [[404, 986, 0.9], [560, 1102, 0.8], [1320, 966, 0.85], [1478, 1108, 0.9], [1980, 1116, 0.8], [740, 1120, 0.7]];
  const REEDS = [[300, 1002, 0.9], [332, 1012, 0.8], [1490, 1074, 0.9], [1524, 1086, 0.8], [2140, 1024, 0.9], [710, 1064, 0.85]];
  const BOATS = [[522, 1042, 1.0], [1668, 1054, 0.9]];

  /* 들판 숲 — 마을(0,0)-(2400,1900) 바깥 둘레에만 놓는다 */
  const APRON_TREES = [
    [-980, 520, 1.05], [-1240, 1000, 1.15], [-780, 1290, 1.0], [-320, 1530, 0.95], [-1060, 170, 1.0],
    [-420, -300, 1.0], [140, -430, 1.05], [860, -520, 1.1], [1620, -470, 1.05], [2280, -390, 1.0],
    [2820, 200, 1.1], [2700, 780, 1.0], [2960, 1260, 1.15], [2540, 1570, 1.0], [1200, 2260, 1.1],
    [320, 2150, 1.0], [2020, 2140, 1.05], [680, 2070, 0.95]
  ];
  const APRON_BUSHES = [
    [-620, 300, 1.0], [-880, 830, 1.1], [-360, 1170, 0.95], [2680, 430, 1.05], [2860, 1010, 1.0],
    [2540, 2070, 1.0], [-160, -240, 1.0], [780, -370, 0.95], [1980, -310, 1.0], [1400, 2130, 1.0]
  ];

  /* 지구 표지판 — 구역 색으로 칠한 큰 팻말.
     위 칸에 이모지 + 한글 이름, 아래 칸에 영문 이름을 넣는다.
     자리는 data/sites.js 의 district.sign 을 먼저 쓴다 (없으면 v7 자리로 대체). */
  const SIGN_FALLBACK = { travel: [1010, 852], creative: [1600, 896], work: [250, 1615], sprout: [1450, 1560] };
  function signSvg(x, y, label, en, accent) {
    const W_BOARD = 268, H_BOARD = 78;
    return `<g>
      <ellipse cx="${x}" cy="${y + 72}" rx="30" ry="8" fill="#3F5B45" opacity=".22"/>
      <rect x="${x - 9}" y="${y - 4}" width="18" height="76" rx="8" fill="#B08A57"/>
      <rect x="${x - 7}" y="${y - 4}" width="6" height="76" rx="3" fill="#C79E6C" opacity=".7"/>
      <rect x="${x - W_BOARD / 2 + 4}" y="${y - H_BOARD + 6}" width="${W_BOARD}" height="${H_BOARD}" rx="16" fill="#3F5B45" opacity=".2"/>
      <rect x="${x - W_BOARD / 2}" y="${y - H_BOARD}" width="${W_BOARD}" height="${H_BOARD}" rx="16" fill="${accent}" stroke="#FFFDF4" stroke-opacity=".95" stroke-width="4"/>
      <rect x="${x - W_BOARD / 2 + 8}" y="${y - H_BOARD + 7}" width="${W_BOARD - 16}" height="${H_BOARD * 0.5}" rx="11" fill="#FFF" opacity=".14"/>
      <text x="${x}" y="${y - H_BOARD + 41}" text-anchor="middle" font-size="30" font-weight="900" fill="#FFFDF6" font-family="var(--font)">${label}</text>
      <text x="${x}" y="${y - H_BOARD + 65}" text-anchor="middle" font-size="13" font-weight="800" letter-spacing="2.4" fill="#FFFDF6" opacity=".82" font-family="var(--font)">${en}</text>
    </g>`;
  }

  function svgUse(kind, x, y, s, extra) {
    const w = kind === "tree" || kind === "tree--warm" ? 64 : 56;
    const h = kind === "tree" || kind === "tree--warm" ? 84 : 44;
    return `<use href="#s-${kind}" x="${x - (w * s) / 2}" y="${y - h * s}" width="${w * s}" height="${h * s}" ${extra || ""}/>`;
  }

  function terrainSVG() {
    /* 지구 권역 — 바닥 색을 구역별로 확실히 달리 깔고, 경계선을 두 겹으로 세운다.
       (구역이 '어디까지인지'가 한눈에 읽히도록 v7.1 에서 톤을 올렸다) */
    const zones = DISTRICTS.map((d, i) => {
      const z = d.zone;
      if (!z) return "";
      const gid = "zoneTint" + i;
      return `<defs>
          <radialGradient id="${gid}" cx=".5" cy=".5" r=".5">
            <stop offset="0" stop-color="${d.accent}" stop-opacity=".34"/>
            <stop offset=".6" stop-color="${d.accent}" stop-opacity=".27"/>
            <stop offset="1" stop-color="${d.accent}" stop-opacity=".19"/>
          </radialGradient>
        </defs>
        <ellipse cx="${z.cx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}" fill="url(#${gid})"/>
        <ellipse cx="${z.cx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}" fill="none" stroke="${d.accent}" stroke-opacity=".12"
          stroke-width="26"/>
        <ellipse cx="${z.cx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}" fill="none" stroke="${d.accent}" stroke-opacity=".8"
          stroke-width="7" stroke-dasharray="30 20"/>
        <ellipse cx="${z.cx}" cy="${z.cy}" rx="${z.rx - 18}" ry="${z.ry - 18}" fill="none" stroke="${d.accent}"
          stroke-opacity=".38" stroke-width="3"/>`;
    }).join("");

    const roadSvg = ROADS.map((d) => `
      <path d="${d}" fill="none" stroke="#BFA87F" stroke-opacity=".5" stroke-width="58" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#E7D8B8" stroke-width="48" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#F6EBD4" stroke-width="34" stroke-linecap="round"/>
    `).join("");

    return `
    <defs>
      <linearGradient id="gGrass" x1="0" y1="0" x2="840" y2="1900" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#AFCE86"/>
        <stop offset=".46" stop-color="#98BC70"/>
        <stop offset="1" stop-color="#7FA55C"/>
      </linearGradient>
      <linearGradient id="gWater" x1="0" y1="0" x2="1" y2=".25">
        <stop offset="0" stop-color="#74B6BF"/>
        <stop offset=".45" stop-color="#8ACACB"/>
        <stop offset="1" stop-color="#5E9FAD"/>
      </linearGradient>
      <radialGradient id="gPlaza" cx=".5" cy=".42" r=".68">
        <stop offset="0" stop-color="#F2E7CC"/>
        <stop offset=".72" stop-color="#E6D7B7"/>
        <stop offset="1" stop-color="#D2BF97"/>
      </radialGradient>
      <radialGradient id="gHill" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#D2E7AC" stop-opacity=".9"/>
        <stop offset="1" stop-color="#D2E7AC" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="gMeadow" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#7EA35C" stop-opacity=".55"/>
        <stop offset="1" stop-color="#7EA35C" stop-opacity="0"/>
      </radialGradient>
      <pattern id="pGrass" width="96" height="96" patternUnits="userSpaceOnUse">
        <circle cx="18" cy="24" r="1.6" fill="#7FA063" opacity=".35"/>
        <circle cx="62" cy="12" r="1.2" fill="#C9DCAE" opacity=".45"/>
        <circle cx="44" cy="58" r="1.8" fill="#7FA063" opacity=".28"/>
        <circle cx="82" cy="74" r="1.3" fill="#C9DCAE" opacity=".4"/>
        <circle cx="10" cy="80" r="1.1" fill="#7FA063" opacity=".3"/>
      </pattern>
      <pattern id="pStone" width="52" height="44" patternUnits="userSpaceOnUse">
        <rect width="52" height="44" fill="none"/>
        <rect x="2" y="2" width="22" height="17" rx="6" fill="#F2EAD9" opacity=".9"/>
        <rect x="28" y="4" width="20" height="14" rx="5" fill="#EADFC9" opacity=".9"/>
        <rect x="6" y="24" width="19" height="15" rx="5" fill="#EDE3CF" opacity=".9"/>
        <rect x="30" y="22" width="18" height="17" rx="6" fill="#F4EDDD" opacity=".9"/>
      </pattern>
      <radialGradient id="hubHalo" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#E9B98C" stop-opacity=".22"/>
        <stop offset=".62" stop-color="#E9B98C" stop-opacity=".12"/>
        <stop offset="1" stop-color="#E9B98C" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="gLeaf" cx=".34" cy=".28" r=".8">
        <stop offset="0" stop-color="#A9CC85"/>
        <stop offset=".55" stop-color="#86AC66"/>
        <stop offset="1" stop-color="#5F8245"/>
      </radialGradient>
      <radialGradient id="gShade" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#6F8B4E" stop-opacity=".26"/>
        <stop offset=".55" stop-color="#6F8B4E" stop-opacity=".18"/>
        <stop offset="1" stop-color="#6F8B4E" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="gShadeDark" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#37503C" stop-opacity=".34"/>
        <stop offset=".6" stop-color="#37503C" stop-opacity=".22"/>
        <stop offset="1" stop-color="#37503C" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- 마을 + 바깥 들판 잔디 (한 장으로 이어진다) -->
    <rect x="${-PAD.l}" y="${-PAD.t}" width="${W.w + PAD.l + PAD.r}" height="${W.h + PAD.t + PAD.b}" fill="#7FA55C"/>
    <rect x="${-PAD.l}" y="${-PAD.t}" width="${W.w + PAD.l + PAD.r}" height="${W.h + PAD.t + PAD.b}" fill="url(#gGrass)"/>
    <rect x="${-PAD.l}" y="${-PAD.t}" width="${W.w + PAD.l + PAD.r}" height="${W.h + PAD.t + PAD.b}" fill="url(#pGrass)"/>

    <!-- 들판 너머 완만한 언덕 -->
    <ellipse cx="1200" cy="-660" rx="2200" ry="560" fill="url(#gHill)"/>
    <ellipse cx="1200" cy="2480" rx="2100" ry="560" fill="url(#gMeadow)"/>
    <ellipse cx="-980" cy="760" rx="980" ry="760" fill="url(#gHill)"/>
    <ellipse cx="3380" cy="820" rx="980" ry="800" fill="url(#gHill)"/>

    <!-- 완만한 언덕 -->
    <ellipse cx="360" cy="150" rx="620" ry="330" fill="url(#gHill)"/>
    <ellipse cx="2080" cy="230" rx="560" ry="300" fill="url(#gHill)"/>
    <ellipse cx="2200" cy="1420" rx="520" ry="280" fill="url(#gHill)"/>
    <ellipse cx="240" cy="1240" rx="420" ry="300" fill="url(#gHill)"/>
    <ellipse cx="1200" cy="1830" rx="700" ry="220" fill="url(#gMeadow)"/>
    <ellipse cx="1500" cy="700" rx="420" ry="300" fill="url(#gMeadow)"/>

    <!-- 지구 권역 -->
    ${zones}

    <!-- 강 -->
    <path d="${RIVER}" fill="none" stroke="#DCC9A3" stroke-width="168" stroke-linecap="round"/>
    <path d="${RIVER}" fill="none" stroke="#C9B58C" stroke-opacity=".55" stroke-width="150" stroke-linecap="round"/>
    <path d="${RIVER}" fill="none" stroke="url(#gWater)" stroke-width="126" stroke-linecap="round"/>
    <path d="${RIVER}" fill="none" stroke="#B9E0DE" stroke-opacity=".55" stroke-width="46" stroke-linecap="round"/>
    <path d="${RIVER}" fill="none" stroke="#FFF" stroke-opacity=".4" stroke-width="3" stroke-dasharray="34 46"/>
    <path d="M 240 1012 C 340 1002 420 1018 512 1012" fill="none" stroke="#FFF" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>
    <path d="M 1340 1058 C 1420 1050 1490 1060 1560 1054" fill="none" stroke="#FFF" stroke-opacity=".45" stroke-width="4" stroke-linecap="round"/>
    <path d="M 1900 1064 C 1970 1056 2030 1064 2090 1058" fill="none" stroke="#FFF" stroke-opacity=".4" stroke-width="4" stroke-linecap="round"/>

    <!-- 달빛 강물 반사 (밤에만 서서히 켜진다) -->
    <g class="moon-reflect">
      <path d="${RIVER}" fill="none" stroke="#BBD8F5" stroke-opacity=".5" stroke-width="62" stroke-linecap="round"/>
      <path d="${RIVER}" fill="none" stroke="#EAF4FF" stroke-opacity=".5" stroke-width="6" stroke-dasharray="14 30" stroke-linecap="round"/>
      <path d="${RIVER}" fill="none" stroke="#FFFFFF" stroke-opacity=".38" stroke-width="2.4" stroke-dasharray="6 40" stroke-linecap="round"/>
    </g>

    <!-- 오솔길 -->
    ${roadSvg}

    <!-- 광장 — 여행 지구 본부(서쪽) 앞마당 -->
    <ellipse cx="650" cy="648" rx="298" ry="150" fill="url(#gShade)"/>
    <ellipse cx="650" cy="646" rx="244" ry="120" fill="url(#gPlaza)"/>
    <ellipse cx="650" cy="646" rx="244" ry="120" fill="url(#pStone)" opacity=".42"/>
    <ellipse cx="650" cy="646" rx="244" ry="120" fill="none" stroke="#BFA981" stroke-width="5"/>
    <ellipse cx="650" cy="646" rx="204" ry="102" fill="none" stroke="#BFA981" stroke-opacity=".5" stroke-width="3" stroke-dasharray="14 16"/>

    <!-- 업무 광장 — 4열 × 2줄 입주 자리를 받는 큰 돌바닥 (동쪽 끝은 대문 아치 앞에서 멈춘다) -->
    <ellipse cx="540" cy="1526" rx="506" ry="373" fill="url(#gShade)"/>
    <ellipse cx="540" cy="1520" rx="500" ry="365" fill="url(#gPlaza)"/>
    <ellipse cx="540" cy="1520" rx="500" ry="365" fill="url(#pStone)" opacity=".4"/>
    <ellipse cx="540" cy="1520" rx="500" ry="365" fill="none" stroke="#BFA981" stroke-width="5"/>
    <ellipse cx="540" cy="1520" rx="428" ry="300" fill="none" stroke="#BFA981" stroke-opacity=".38" stroke-width="3" stroke-dasharray="16 18"/>

    <!-- 광장은 비워 둔 돌바닥으로 남기고, 다음 입주앱(감사보고서 자동화) 자리를 미리 확보해 둔다 -->

    <!-- 대문 앞 마당 -->
    <ellipse cx="1180" cy="1748" rx="176" ry="82" fill="url(#gPlaza)" opacity=".92"/>
    <ellipse cx="1180" cy="1748" rx="176" ry="82" fill="url(#pStone)" opacity=".45"/>

    <ellipse cx="1830" cy="796" rx="300" ry="120" fill="#E9DCC2" opacity=".75" transform="rotate(-24 1830 796)"/>
    <ellipse cx="1830" cy="796" rx="300" ry="120" fill="url(#pStone)" opacity=".4" transform="rotate(-24 1830 796)"/>

    <ellipse cx="1740" cy="1348" rx="300" ry="156" fill="#B4CB86" opacity=".5"/>
    <g opacity=".28" stroke="#8AA75C" stroke-width="5" fill="none" stroke-linecap="round">
      <path d="M1490 1310 q 60 -14 120 0"/><path d="M1490 1352 q 60 -14 120 0"/><path d="M1490 1394 q 60 -14 120 0"/>
      <path d="M1730 1288 q 60 -14 120 0"/><path d="M1730 1330 q 60 -14 120 0"/><path d="M1730 1372 q 60 -14 120 0"/>
    </g>

    <!-- 다리 -->
    <g>
      <ellipse cx="1180" cy="1052" rx="124" ry="44" fill="url(#gShadeDark)"/>
      <rect x="1096" y="940" width="168" height="204" rx="18" fill="#B79E76"/>
      <rect x="1104" y="948" width="152" height="188" rx="14" fill="#E7DBBE"/>
      <rect x="1104" y="948" width="152" height="188" rx="14" fill="url(#pStone)" opacity=".5"/>
      <g stroke="#C9B893" stroke-width="2" opacity=".55">
        <path d="M1108 998h144M1108 1050h144M1108 1102h144"/>
      </g>
      <rect x="1082" y="930" width="22" height="224" rx="9" fill="#DCCAA4"/>
      <rect x="1256" y="930" width="22" height="224" rx="9" fill="#DCCAA4"/>
      <rect x="1082" y="930" width="22" height="224" rx="9" fill="url(#pStone)" opacity=".35"/>
      <rect x="1256" y="930" width="22" height="224" rx="9" fill="url(#pStone)" opacity=".35"/>
      <g fill="#C6AF88">
        <rect x="1078" y="926" width="30" height="14" rx="6"/><rect x="1078" y="1144" width="30" height="14" rx="6"/>
        <rect x="1252" y="926" width="30" height="14" rx="6"/><rect x="1252" y="1144" width="30" height="14" rx="6"/>
      </g>
      <path d="M1092 1052h176" stroke="#B39A72" stroke-width="3" opacity=".45"/>
    </g>

    <!-- 입구 아치 — 앞마당(대문 앞 마당)에서 아바타가 문 앞에 서도록 조금 위로 올려 세운다 -->
    <g transform="translate(0 144)">
      <ellipse cx="1180" cy="1570" rx="160" ry="26" fill="url(#gShadeDark)"/>
      <rect x="1064" y="1436" width="32" height="140" rx="14" fill="#D3B486"/>
      <rect x="1064" y="1436" width="11" height="140" rx="5" fill="#C6A575"/>
      <rect x="1264" y="1436" width="32" height="140" rx="14" fill="#D3B486"/>
      <rect x="1285" y="1436" width="11" height="140" rx="5" fill="#C6A575"/>
      <rect x="1050" y="1424" width="60" height="19" rx="9" fill="#E4CBA3"/>
      <rect x="1250" y="1424" width="60" height="19" rx="9" fill="#E4CBA3"/>
      <path d="M1080 1438 C1080 1374 1132 1352 1180 1352 C1228 1352 1280 1374 1280 1438 L1248 1438 C1248 1396 1218 1380 1180 1380 C1142 1380 1112 1396 1112 1438 Z" fill="#D9B98A"/>
      <path d="M1080 1438 C1080 1374 1132 1352 1180 1352 C1228 1352 1280 1374 1280 1438 L1248 1438 C1248 1396 1218 1380 1180 1380 C1142 1380 1112 1396 1112 1438 Z" fill="none" stroke="#B99567" stroke-width="4"/>
      <rect x="1104" y="1378" width="152" height="54" rx="13" fill="#FFF9EA" stroke="#B99567" stroke-width="4"/>
      <text x="1180" y="1402" text-anchor="middle" font-size="20" font-weight="900" fill="#7A5330" font-family="var(--font)">쿠사리 빌리지</text>
      <text x="1180" y="1421" text-anchor="middle" font-size="10.5" font-weight="800" letter-spacing="2.2" fill="#B08A57" font-family="var(--font)">KUSARI VILLAGE</text>
      <circle cx="1180" cy="1346" r="8.5" fill="#E4C48E" stroke="#B99567" stroke-width="3"/>
      <path d="M1180 1355 v-17" stroke="#B99567" stroke-width="3"/>
      <g opacity=".92">
        <path d="M1098 1352 l-26 24 26 4z" fill="#C97E52"/>
        <path d="M1262 1352 l26 24 -26 4z" fill="#C97E52"/>
      </g>
    </g>

    <!-- 지구 표지판 — 각 구역 앞길 땅 위에 큰 팻말로 세운다 (자리는 district.sign) -->
    ${DISTRICTS.map((d) => {
      const p = d.sign || SIGN_FALLBACK[d.id];
      if (!p) return "";
      return signSvg(p[0], p[1], (d.emoji ? d.emoji + " " : "") + d.name, String(d.en || "").toUpperCase(), d.accent || "#5E7A6A");
    }).join("")}

    <!-- 장식 -->
    ${TREES.map(([x, y, s]) => svgUse(x % 3 === 0 ? "tree--warm" : "tree", x, y, s)).join("")}
    ${BUSHES.map(([x, y, s]) => svgUse("bush", x, y, s)).join("")}
    ${FLOWERS.map(([x, y, s]) => svgUse("flower", x, y, s)).join("")}
    ${LAMPS.map(([x, y, s]) => svgUse("lamp", x, y, s)).join("")}
    ${BENCHES.map(([x, y, s]) => svgUse("bench", x, y, s)).join("")}
    ${ROCKS.map(([x, y, s]) => svgUse("rock", x, y, s)).join("")}
    ${REEDS.map(([x, y, s]) => svgUse("reed", x, y, s)).join("")}
    ${BOATS.map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><use href="#s-boat" x="-40" y="-30" width="80" height="44"/></g>`).join("")}

    <!-- 들판 숲 (마을 바깥) -->
    ${APRON_TREES.map(([x, y, s]) => svgUse(x % 2 === 0 ? "tree--warm" : "tree", x, y, s)).join("")}
    ${APRON_BUSHES.map(([x, y, s]) => svgUse("bush", x, y, s)).join("")}

    <!-- 물가 잔물결 -->
    <g opacity=".5">
      <path d="M 300 1058 q 18 -8 36 0" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round"/>
      <path d="M 1470 1044 q 18 -8 36 0" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round"/>
      <path d="M 2020 1074 q 18 -8 36 0" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round"/>
    </g>`;
  }

  /* ── 건물 그리기 ───────────────────────────────────────── */
  const bldsEl = $("#blds");
  const linksEl = $("#links");

  function sitePos(site) {
    if (Array.isArray(site.pos)) return { x: site.pos[0], y: site.pos[1] };
    const d = districtOf(site.district);
    return { x: d.zone ? d.zone.cx : W.w / 2, y: d.zone ? d.zone.cy : W.h / 2 };
  }

  function bldHtml(site) {
    const preset = presetOf(site.building);
    const tier = site.tier === 2 ? 2 : 1;
    const p = sitePos(site);
    const w = widthOf(site);
    const hub = tier === 1 && isHub(site);
    const role = roleOf(site);
    return `
      <button type="button" class="bld" data-id="${esc(site.id)}" data-tier="${tier}" data-hub="${hub}" data-href="${esc(site.url)}"
              style="--x:${p.x};--y:${p.y};--w:${w};z-index:${Math.round(p.y)}"
              aria-label="${esc(site.name)}. ${esc(role)}. ${esc(openWord(site))}"
              title="${esc(site.name)} — 누르면 ${opensInNewTab(site) ? "새 탭에서 열림" : "바로 이동"}">
        <span class="bld__pad" aria-hidden="true"></span>
        <span class="bld__light" aria-hidden="true"></span>
        <img class="bld__img" src="${esc(preset.img)}" alt="${esc(preset.name)} 건물 그림"
             width="${preset.w || 760}" height="${preset.h || 700}" decoding="async">
        ${isFav(site.id) ? '<span class="bld__fav" aria-hidden="true">★</span>' : ""}
        ${hub ? '<span class="bubble" data-hub-bubble></span>' : '<span class="bubble"></span>'}
        <span class="bld__plate">
          <span class="bld__name">${esc(site.name)}</span>
          <span class="bld__role">${esc(role)}</span>
        </span>
      </button>`;
  }

  function renderWorld() {
    /* 지도 위 `새 건물 입주` 빈 부지는 그리지 않는다 (상단 `＋ 새 건물 입주` 버튼으로만 입주).
       빈 자리는 data/sites.js 의 district.slots 에 남겨 두어 다음 건물이 차례로 들어온다. */
    bldsEl.innerHTML = allSites().map(bldHtml).join("");
    renderLinks();
    bindBldEvents();
  }

  function curve(from, to, bend) {
    const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    return { d: `M ${from.x} ${from.y} Q ${mx + nx * bend} ${my + ny * bend} ${to.x} ${to.y}`, mx: mx + nx * bend, my: my + ny * bend };
  }

  function renderLinks() {
    if (!linksEl) return;
    const hubs = allSites().filter((s) => s.tier === 1 && isHub(s));
    let out = "";
    hubs.forEach((hub) => {
      const hp = sitePos(hub);
      const d = districtOf(hub.district);
      const kids = childrenOf(hub.id);
      out += `<ellipse cx="${hp.x}" cy="${hp.y - 30}" rx="450" ry="360" fill="url(#hubHalo)"/>`;
      kids.forEach((k, i) => {
        const kp = sitePos(k);
        const c = curve({ x: hp.x, y: hp.y - 10 }, { x: kp.x, y: kp.y - 6 }, (i % 2 ? 1 : -1) * (60 + i * 14));
        out += `<path id="link-${esc(hub.id)}-${esc(k.id)}" d="${c.d}" fill="none" stroke="#8A5A3A" stroke-opacity=".22"
                  stroke-width="9" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
                <path d="${c.d}" fill="none" stroke="${d.accent}" stroke-opacity=".92"
                  stroke-width="3.6" stroke-dasharray="13 11" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
                <circle cx="${kp.x}" cy="${kp.y - 6}" r="9" fill="#FFF8E8" stroke="${d.accent}" stroke-width="3" vector-effect="non-scaling-stroke"/>
                <circle r="7" fill="#FFF6E2" stroke="${d.accent}" stroke-width="2">
                  <animateMotion dur="${6 + i * 0.8}s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#link-${esc(hub.id)}-${esc(k.id)}"/>
                  </animateMotion>
                </circle>`;
      });
    });
    linksEl.innerHTML = out;
  }

  /* ── 마을 이벤트 ──────────────────────────────────────── */
  function bindBldEvents() {
    if (!bldsEl) return;
    bldsEl.onclick = (e) => {
      /* 드래그로 지도를 옮긴 직후의 손 떼임은 클릭으로 보지 않는다 */
      if (dragMoved > 6) return;
      const add = e.target.closest("[data-add]");
      if (add) { stopTour(); openForm("add", null, add.dataset.add); return; }
      const b = e.target.closest(".bld[data-id]");
      if (!b) return;
      const site = siteById(b.dataset.id);
      if (!site) return;
      /* 건물을 누르면 설명 모달 없이 그 사이트로 바로 이동 (자체 앱은 같은 탭, 외부 사이트는 새 탭) */
      goToSite(site);
    };
    bldsEl.onkeydown = (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const b = e.target.closest(".bld[data-id]");
      if (b && e.target === b) {
        e.preventDefault();
        const site = siteById(b.dataset.id);
        if (site) goToSite(site);
      }
    };
  }

  /* ── 상단 요약 · 지구 바 ──────────────────────────────── */
  function renderStats() {
    const sites = allSites();
    const t1 = sites.filter((s) => s.tier !== 2).length;
    const t2 = sites.filter((s) => s.tier === 2).length;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("sumSites", sites.length);
    set("sumT1", t1);
    set("sumT2", t2);
    set("keyT1", t1);
    set("keyT2", t2);
    set("footerCount", sites.length);
    set("leadSites", sites.length);
    set("leadT1", t1);
    set("leadT2", t2);
  }

  /* 지구 바 — 간판 하단 좌측의 세로 목록.
     한 줄에 [이모지 + 지구명] 왼쪽, [입주 수] 오른쪽 정렬. */
  function renderDistrictChips() {
    const nav = $("#districtChips");
    if (!nav) return;
    nav.innerHTML = DISTRICTS.map((d) => {
      const n = allSites().filter((s) => s.district === d.id).length;
      const short = esc(d.name.replace(" 지구", "").replace(" 골목", "").replace(" 광장", "").replace(" 놀이터", ""));
      return `<button type="button" class="hud__chip" data-district="${esc(d.id)}" title="${esc(d.name)}로 이동">
        <span class="hud__label"><span class="hud__ico" aria-hidden="true">${d.emoji}</span><span class="hud__long">${esc(d.name)}</span><span class="hud__short">${short}</span></span>
        <b class="hud__n">${n}</b></button>`;
    }).join("");

    nav.onclick = (e) => {
      const btn = e.target.closest("[data-district]");
      if (!btn) return;
      const d = districtOf(btn.dataset.district);
      const look = d.look || (d.zone ? { cx: d.zone.cx, cy: d.zone.cy, s: 0.9 } : null);
      if (!look) return;
      stopTour();
      panTo(look.cx, look.cy, dZoom(look.s), 780);
      $$(".hud__chip", nav).forEach((b) => b.classList.toggle("is-on", b === btn));
    };
  }

  /* ── 미니맵 ───────────────────────────────────────────── */
  function renderMinimap() {
    const svg = $("#minimapSvg");
    if (!svg) return;
    const dots = allSites().map((s) => {
      const p = sitePos(s);
      return `<g class="mm-site ${s.tier === 2 ? "mm-t2" : "mm-t1"}" data-mm="${esc(s.id)}">
        <circle cx="${p.x}" cy="${p.y}" r="${s.tier === 2 ? 30 : 46}"/>
        <title>${esc(s.name)}</title>
      </g>`;
    }).join("");
    svg.innerHTML = `
      <rect width="${W.w}" height="${W.h}" fill="#A8C489" rx="90"/>
      <path class="mm-river" d="${RIVER}"/>
      ${ROADS.map((d) => `<path class="mm-road" d="${d}"/>`).join("")}
      ${DISTRICTS.filter((d) => d.zone).map((d) => `<ellipse class="mm-zone" cx="${d.zone.cx}" cy="${d.zone.cy}" rx="${d.zone.rx}" ry="${d.zone.ry}"/>`).join("")}
      <g>${dots}</g>
      <rect class="mm-view" x="0" y="0" width="100" height="100" rx="26" fill="none"/>
    `;
    miniViewEl = $(".mm-view", svg);
    updateMiniView();

    svg.onclick = (e) => {
      const dot = e.target.closest("[data-mm]");
      if (dot) {
        const s = siteById(dot.dataset.mm);
        if (s) { stopTour(); focusSite(s, 760); }
        return;
      }
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W.w;
      const y = ((e.clientY - r.top) / r.height) * W.h;
      stopTour();
      panTo(x, y, Math.max(state.cam.s, 0.9), 640);
    };
  }

  function updateMiniView() {
    if (!miniViewEl) return;
    const w = vw / state.cam.s, h = vh / state.cam.s;
    const x = state.cam.cx - w / 2, y = state.cam.cy - h / 2;
    miniViewEl.setAttribute("x", x.toFixed(0));
    miniViewEl.setAttribute("y", y.toFixed(0));
    miniViewEl.setAttribute("width", w.toFixed(0));
    miniViewEl.setAttribute("height", h.toFixed(0));
    miniViewEl.style.display = (w / W.w > 0.9 && h / W.h > 0.9) ? "none" : "";
  }

  /* ── 시간대(낮·노을·밤) — 현지 시각 자동 + 수동 전환 ────── */
  /*   08:00~17:59 낮 / 18:00~18:59 노을 / 19:00~07:59 밤   */
  const PHASE_META = {
    day:    { ico: "☀️", label: "낮",  say: "☀️ 맑은 낮이에요" },
    sunset: { ico: "🌅", label: "노을", say: "🌅 노을이 내려앉았어요 — 가로등에 불이 켜집니다" },
    night:  { ico: "🌙", label: "밤",  say: "🌙 별빛 내린 밤이에요 — 달빛이 강물에 잠깁니다" }
  };
  const TIME_CYCLE = ["auto", "day", "sunset", "night"];
  const THEME_COLOR = { day: "#EFE3CD", sunset: "#2B2337", night: "#131A2E" };

  function phaseOfNow(d) {
    const h = (d || new Date()).getHours();
    if (h >= 8 && h < 18) return "day";
    if (h === 18) return "sunset";
    return "night";
  }
  function phaseNow() { return state.timeMode === "auto" ? phaseOfNow() : state.timeMode; }

  function applyTime(mode, opts) {
    state.timeMode = TIME_CYCLE.indexOf(mode) > 0 ? mode : "auto";
    const phase = phaseNow();
    const meta = PHASE_META[phase];
    document.documentElement.dataset.theme = phase;

    const ico = $("#themeIco"), lab = $("#themeLabel"), btn = $("#themeBtn"), autoTag = $("#themeAuto");
    if (ico) ico.textContent = meta.ico;
    if (lab) lab.textContent = meta.label;
    if (autoTag) autoTag.hidden = state.timeMode !== "auto";
    if (btn) {
      const nextLabel = state.timeMode === "auto" ? "낮" : (state.timeMode === "night" ? "자동" : PHASE_META[TIME_CYCLE[TIME_CYCLE.indexOf(state.timeMode) + 1]].label);
      btn.setAttribute("aria-pressed", String(state.timeMode !== "auto"));
      btn.setAttribute("aria-label", "시간대 " + meta.label + (state.timeMode === "auto" ? " (자동)" : " (고정)") + " · 누르면 " + nextLabel);
      btn.title = "낮 → 노을 → 밤 → 자동";
    }
    const metaTag = document.querySelector('meta[name="theme-color"]');
    if (metaTag) metaTag.setAttribute("content", THEME_COLOR[phase]);

    if (opts && opts.persist) write(KEY.theme, state.timeMode);
    if (opts && opts.toast) {
      toast(state.timeMode === "auto"
        ? "🕒 현지 시각에 맞춰 자동 전환 — 지금은 " + meta.label + "이에요"
        : meta.say);
    }
  }
  function nextTimeMode() {
    return TIME_CYCLE[(TIME_CYCLE.indexOf(state.timeMode) + 1) % TIME_CYCLE.length];
  }
  if ($("#themeBtn")) {
    $("#themeBtn").addEventListener("click", () => {
      applyTime(nextTimeMode(), { persist: true, toast: true });
    });
  }

  /* ── 날씨 — 현지 실시간(Open-Meteo) + 미리보기 체험 ─────── */
  const WX_INFO = {
    clear:  { ico: "☀️", label: "맑음",     fx: "none" },
    partly: { ico: "⛅", label: "구름 조금", fx: "none" },
    cloud:  { ico: "☁️", label: "흐림",     fx: "none" },
    rain:   { ico: "🌧", label: "비",       fx: "rain" },
    snow:   { ico: "🌨", label: "눈",       fx: "snow" },
    fog:    { ico: "🌫", label: "안개",     fx: "none" },
    storm:  { ico: "⛈", label: "천둥번개", fx: "rain" }
  };
  const WX_CYCLE = ["auto", "clear", "cloud", "rain", "snow"];
  const WX_FALLBACK = { lat: 36.815, lon: 127.114 }; /* 천안 */

  function wxKeyFromCode(code) {
    if (code === 0) return "clear";
    if (code === 1 || code === 2) return "partly";
    if (code === 3) return "cloud";
    if (code === 45 || code === 48) return "fog";
    if (code >= 51 && code <= 57) return "rain";
    if (code >= 61 && code <= 67) return "rain";
    if (code >= 71 && code <= 77) return "snow";
    if (code >= 80 && code <= 82) return "rain";
    if (code === 85 || code === 86) return "snow";
    if (code >= 95) return "storm";
    return "clear";
  }

  function applyWeather(opts) {
    const auto = state.wxMode === "auto";
    const key = auto ? state.wx.key : state.wxMode;
    const info = WX_INFO[key] || WX_INFO.clear;
    const tempTxt = state.wx.temp == null ? "--°" : Math.round(state.wx.temp) + "°";
    document.documentElement.dataset.weather = key;

    const ico = $("#wxIco"), txt = $("#wxTxt"), temp = $("#wxTemp"), chip = $("#wxChip");
    if (ico) ico.textContent = info.ico;
    if (txt) txt.textContent = info.label;
    if (temp) temp.textContent = tempTxt;
    if (chip) {
      chip.classList.toggle("is-preview", !auto);
      chip.setAttribute("aria-label", "날씨 " + info.label + (state.wx.temp == null ? "" : " " + Math.round(state.wx.temp) + "도") +
        (auto ? " · 지금 이곳 실시간" : " · 미리보기 체험") + ". 누르면 자동 → 맑음 → 흐림 → 비 → 눈 순서로 바뀝니다.");
      chip.title = auto ? "지금 이곳 날씨 — 눌러서 비·눈 풍경도 미리 볼 수 있어요" : "미리보기: " + info.label + " — 눌러서 다음 날씨";
    }
    setFx(info.fx);

    if (opts && opts.persist) write(KEY.wx, state.wxMode);
    if (opts && opts.toast) {
      toast(auto
        ? (state.wx.loaded ? "🌍 지금 이곳 날씨로 돌아왔어요 — " + info.label + " " + tempTxt : "🌍 지금 이곳 날씨를 불러오는 중이에요 — " + info.label)
        : info.ico + " " + info.label + " 풍경 미리보기");
    }
  }
  if ($("#wxChip")) {
    $("#wxChip").addEventListener("click", () => {
      state.wxMode = WX_CYCLE[(WX_CYCLE.indexOf(state.wxMode) + 1) % WX_CYCLE.length];
      applyWeather({ persist: true, toast: true });
    });
  }

  function loadWeather() {
    if (!navigator.geolocation) { fetchOpenMeteo(WX_FALLBACK.lat, WX_FALLBACK.lon); return; }
    let settled = false;
    const fallbackTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      fetchOpenMeteo(WX_FALLBACK.lat, WX_FALLBACK.lon);
    }, 4200);
    const fallback = () => {
      if (settled) return;
      settled = true;
      clearTimeout(fallbackTimer);
      fetchOpenMeteo(WX_FALLBACK.lat, WX_FALLBACK.lon);
    };
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (settled) return;
          settled = true;
          clearTimeout(fallbackTimer);
          fetchOpenMeteo(pos.coords.latitude, pos.coords.longitude);
        },
        fallback,
        { timeout: 4000, maximumAge: 600000, enableHighAccuracy: false }
      );
    } catch (e) { fallback(); }
  }

  function fetchOpenMeteo(lat, lon) {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat.toFixed(4) + "&longitude=" + lon.toFixed(4) +
      "&current=weather_code,temperature_2m&timezone=auto";
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http " + r.status))))
      .then((data) => {
        const cur = (data && data.current) || {};
        const code = Number(cur.weather_code);
        const temp = Number(cur.temperature_2m);
        state.wx.code = Number.isFinite(code) ? code : null;
        state.wx.temp = Number.isFinite(temp) ? temp : null;
        state.wx.key = state.wx.code == null ? "clear" : wxKeyFromCode(state.wx.code);
        state.wx.loaded = true;
      })
      .catch(() => {
        state.wx.key = "clear";
        state.wx.temp = null;
        state.wx.loaded = false;
      })
      .then(() => { applyWeather(); });
  }

  /* ── 날씨 효과 캔버스 — pointer-events:none 캔버스 단 1개 ── */
  const fxCanvas = $("#fxCanvas");
  const fxCtx = fxCanvas ? fxCanvas.getContext("2d") : null;
  const REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const rainDrops = [], snowFlakes = [];
  let fxKind = "none", fxW = 0, fxH = 0, fxDpr = 1;

  function fxResize() {
    if (!fxCanvas) return;
    fxDpr = Math.min(2, window.devicePixelRatio || 1);
    fxW = window.innerWidth;
    fxH = window.innerHeight;
    fxCanvas.width = Math.round(fxW * fxDpr);
    fxCanvas.height = Math.round(fxH * fxDpr);
    fxCanvas.style.width = fxW + "px";
    fxCanvas.style.height = fxH + "px";
    if (fxCtx) fxCtx.setTransform(fxDpr, 0, 0, fxDpr, 0, 0);
    seedFx(fxKind);
  }

  function newDrop() {
    return {
      x: Math.random() * (fxW + 120), y: Math.random() * fxH - fxH * 0.2,
      l: 11 + Math.random() * 20, v: 620 + Math.random() * 520,
      a: 0.22 + Math.random() * 0.34
    };
  }
  function newFlake() {
    return {
      x: Math.random() * fxW, y: Math.random() * fxH,
      r: 1.1 + Math.random() * 2.3, v: 24 + Math.random() * 46,
      d: Math.random() * Math.PI * 2, w: 10 + Math.random() * 20,
      a: 0.45 + Math.random() * 0.45
    };
  }
  function seedFx(kind) {
    rainDrops.length = 0;
    snowFlakes.length = 0;
    if (kind === "rain") {
      const n = Math.round(clamp(fxW / 7.5, 50, 130));
      for (let i = 0; i < n; i++) rainDrops.push(newDrop());
    } else if (kind === "snow") {
      const n = Math.round(clamp(fxW / 11, 34, 84));
      for (let i = 0; i < n; i++) snowFlakes.push(newFlake());
    }
    if (fxCtx) fxCtx.clearRect(0, 0, fxW, fxH);
  }
  function setFx(kind) {
    if (kind === fxKind) return;
    fxKind = kind;
    if (fxCanvas) fxCanvas.setAttribute("data-fx", kind);
    seedFx(kind);
  }
  function drawFx(dt) {
    if (!fxCtx || fxKind === "none" || REDUCED) return;
    if (state.view !== "map") return;
    fxCtx.clearRect(0, 0, fxW, fxH);
    if (fxKind === "rain") {
      fxCtx.lineWidth = 1.15;
      fxCtx.lineCap = "round";
      for (let i = 0; i < rainDrops.length; i++) {
        const d = rainDrops[i];
        d.y += d.v * dt;
        d.x -= d.v * 0.16 * dt;
        if (d.y > fxH + 40) {
          d.y = -40 - Math.random() * 120;
          d.x = Math.random() * (fxW + 160);
        }
        if (d.x < -50) d.x = fxW + 50;
        fxCtx.strokeStyle = "rgba(214,233,248," + d.a.toFixed(2) + ")";
        fxCtx.beginPath();
        fxCtx.moveTo(d.x, d.y);
        fxCtx.lineTo(d.x - d.l * 0.16, d.y + d.l);
        fxCtx.stroke();
      }
    } else if (fxKind === "snow") {
      for (let i = 0; i < snowFlakes.length; i++) {
        const f = snowFlakes[i];
        f.d += dt * 0.9;
        f.y += f.v * dt;
        f.x += Math.sin(f.d) * f.w * dt;
        if (f.y > fxH + 16) { f.y = -16; f.x = Math.random() * fxW; }
        if (f.x < -16) f.x = fxW + 16;
        else if (f.x > fxW + 16) f.x = -16;
        fxCtx.fillStyle = "rgba(255,255,255," + f.a.toFixed(2) + ")";
        fxCtx.beginPath();
        fxCtx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        fxCtx.fill();
      }
    }
  }

  /* ── 시간대 · 날씨 초기화 ─────────────────────────────── */
  (function initSky() {
    const savedTime = read(KEY.theme, "auto");
    applyTime(TIME_CYCLE.indexOf(savedTime) > 0 ? savedTime : "auto", {});
    const savedWx = read(KEY.wx, "auto");
    state.wxMode = WX_CYCLE.indexOf(savedWx) > 0 ? savedWx : "auto";
    fxResize();
    applyWeather({});
    loadWeather();

    /* 자동 시간대: 30초마다 현지 시각 확인, 탭 복귀 시 즉시 확인 */
    let lastPhase = phaseOfNow();
    setInterval(() => {
      if (state.timeMode !== "auto") return;
      const p = phaseOfNow();
      if (p !== lastPhase) { lastPhase = p; applyTime("auto", {}); }
    }, 30000);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || state.timeMode !== "auto") return;
      lastPhase = phaseOfNow();
      applyTime("auto", {});
    });
    /* 실시간 날씨는 20분마다 갱신 */
    setInterval(() => { if (state.wxMode === "auto") loadWeather(); }, 20 * 60 * 1000);
  })();

  /* ── 보기 전환 ────────────────────────────────────────── */
  function setView(view, persist, opts) {
    state.view = view === "deck" ? "deck" : "map";
    document.body.dataset.view = state.view;
    const deck = $("#work");
    if (deck) deck.hidden = state.view !== "deck";
    $$(".segmented__btn").forEach((b) => {
      const on = b.dataset.view === state.view;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    if (state.view === "deck") {
      stopTour();
      if (state.mode === "walk") exitWalk();
      renderDeck();
      if (!opts || opts.scroll !== false) window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    } else {
      resize();
      if (opts && opts.focus) focusSite(opts.focus, 900);
    }
    if (persist) write(KEY.view, state.view);
  }
  $$(".segmented__btn").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view, true)));
  $$("[data-godeck]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); setView("deck", true); }));

  window.addEventListener("hashchange", () => {
    if (location.hash === "#work") setView("deck", true);
    else if (location.hash === "" && state.view === "deck") setView("map", true);
  });

  /* ── 앱 덱(계층 목록) ─────────────────────────────────── */
  const FILTERS = [
    { id: "all", label: "전체", icon: "🏘️" },
    { id: "travel", label: "여행", icon: "🧭" },
    { id: "creative", label: "창작", icon: "📸" },
    { id: "work", label: "업무", icon: "🏛️" },
    { id: "sprout", label: "영감", icon: "💡" },
    { id: "fav", label: "즐겨찾기", icon: "⭐" }
  ];
  const GH_ICON = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';

  function matchesQuery(s, q) {
    if (!q) return true;
    const hay = [s.name, s.desc, (s.tags || []).join(" "), districtOf(s.district).name, roleOf(s)].join(" ").toLowerCase();
    return hay.includes(q);
  }

  function childRowHtml(child, last) {
    const p = presetOf(child.building);
    return `<li class="tree__item">
      <span class="tree__branch" aria-hidden="true">${last ? "└─" : "├─"}</span>
      <span class="tree__thumb"><img src="${esc(p.img)}" alt="" width="38" height="38" loading="lazy"></span>
      <span class="tree__txt">
        <span class="tree__name">${esc(child.name)}</span>
        <span class="tree__role">${esc(roleOf(child))}</span>
      </span>
      <span class="tree__acts">
        <a class="tree__open" href="${esc(child.url)}"${linkTarget(child)} aria-label="${esc(child.name)} ${esc(openWord(child))}">열기 ↗</a>
        <button type="button" class="tree__open" data-open="${esc(child.id)}" aria-label="${esc(child.name)} 정보">ℹ️</button>
      </span>
    </li>`;
  }

  function hubCardHtml(hub, kids, matchedByChild) {
    const p = presetOf(hub.building);
    const d = districtOf(hub.district);
    const fav = isFav(hub.id);
    const repo = repoUrl(hub.repo);
    const allKids = childrenOf(hub.id);
    const showTree = allKids.length > 0;
    return `
      <article class="card card--hub" data-id="${esc(hub.id)}">
        <div class="card__thumb"><img src="${esc(p.img)}" alt="${esc(p.name)} 건물 그림" width="118" height="118" loading="lazy"></div>
        <div class="card__body">
          <div class="card__top">
            <div>
              <span class="tierbadge">본부</span>
              <h3 class="card__name" style="margin-top:5px">${esc(hub.name)}</h3>
            </div>
            <button type="button" class="card__star${fav ? " is-on" : ""}" data-fav="${esc(hub.id)}" aria-pressed="${fav}" aria-label="${esc(hub.name)} 즐겨찾기">★</button>
          </div>
          <span class="card__dist" style="color:${d.accent}"><i></i>${d.emoji} ${esc(d.name)}</span>
          <span class="card__role">${esc(roleOf(hub))}</span>
          <p class="card__desc">${esc(hub.desc || "아직 소개 글이 없어요.")}</p>
          <div class="card__foot">
            <a class="card__open" href="${esc(hub.url)}"${linkTarget(hub)} aria-label="${esc(hub.name)} ${esc(openWord(hub))}">열기 ↗</a>
            ${repo ? `<a class="card__repo" href="${esc(repo)}" target="_blank" rel="noopener" aria-label="GitHub 저장소">${GH_ICON}</a>` : ""}
            <button type="button" class="card__more" data-open="${esc(hub.id)}" aria-label="${esc(hub.name)} 정보 보기">ℹ️ 정보</button>
          </div>
        </div>
        ${showTree ? `<div class="tree">
          <button type="button" class="tree__head" data-fold-tree aria-expanded="true">
            <span class="tree__mark">└─</span> 연결된 하위 사이트
            <span class="tree__count">별관 ${allKids.length}</span>
            ${matchedByChild && state.query ? '<span class="tree__count" style="background:#FFF1D8;color:#9A6B10">검색 일치</span>' : ""}
            <span class="tree__fold">접기 ▾</span>
          </button>
          <ul class="tree__list">
            ${kids.map((k, i) => childRowHtml(k, i === kids.length - 1)).join("")}
          </ul>
        </div>` : ""}
      </article>`;
  }

  function simpleCardHtml(site) {
    const p = presetOf(site.building);
    const d = districtOf(site.district);
    const fav = isFav(site.id);
    const repo = repoUrl(site.repo);
    const parent = site.tier === 2 && site.parent ? siteById(site.parent) : null;
    return `
      <article class="card" data-id="${esc(site.id)}">
        <div class="card__thumb"><img src="${esc(p.img)}" alt="${esc(p.name)} 건물 그림" width="92" height="92" loading="lazy"></div>
        <div class="card__body">
          <div class="card__top">
            <div>
              <span class="tierbadge${site.tier === 2 ? " tierbadge--2" : ""}">${site.tier === 2 ? "별관" : "본부"}</span>
              <h3 class="card__name" style="margin-top:5px">${esc(site.name)}</h3>
            </div>
            <button type="button" class="card__star${fav ? " is-on" : ""}" data-fav="${esc(site.id)}" aria-pressed="${fav}" aria-label="${esc(site.name)} 즐겨찾기">★</button>
          </div>
          <span class="card__dist" style="color:${d.accent}"><i></i>${d.emoji} ${esc(d.name)}</span>
          ${parent ? `<span class="card__parentlink" style="margin-top:4px">⬆️ ${esc(parent.name)}</span>` : ""}
          <p class="card__desc">${esc(site.desc || "아직 소개 글이 없어요.")}</p>
          <div class="card__foot">
            <a class="card__open" href="${esc(site.url)}"${linkTarget(site)} aria-label="${esc(site.name)} ${esc(openWord(site))}">열기 ↗</a>
            ${repo ? `<a class="card__repo" href="${esc(repo)}" target="_blank" rel="noopener" aria-label="GitHub 저장소">${GH_ICON}</a>` : ""}
            <button type="button" class="card__more" data-open="${esc(site.id)}" aria-label="${esc(site.name)} 정보 보기">ℹ️ 정보</button>
          </div>
        </div>
      </article>`;
  }

  function renderDeck() {
    const grid = $("#deckGrid");
    if (!grid) return;
    const q = state.query.trim().toLowerCase();
    $$("#filterChips").forEach(() => {});
    const chips = $("#filterChips");
    if (chips) {
      chips.innerHTML = FILTERS.map((f) => `
        <button type="button" class="chip${state.filter === f.id ? " is-active" : ""}" data-filter="${f.id}" aria-pressed="${state.filter === f.id}">
          <span aria-hidden="true">${f.icon}</span> ${f.label}
        </button>`).join("");
    }
    renderStats();

    const tier1 = allSites().filter((s) => s.tier !== 2);
    const orphans = allSites().filter((s) => s.tier === 2 && !siteById(s.parent));
    const cards = [];

    tier1.forEach((hub) => {
      if (state.filter !== "all" && state.filter !== "fav" && hub.district !== state.filter) return;
      let kids = childrenOf(hub.id);
      if (state.filter === "fav") kids = kids.filter((k) => isFav(k.id));
      if (q) kids = kids.filter((k) => matchesQuery(k, q));
      const selfMatch = matchesQuery(hub, q);
      const favOk = state.filter !== "fav" || isFav(hub.id) || kids.length > 0;
      if (!favOk) return;
      if (q && !selfMatch && kids.length === 0) return;
      if (childrenOf(hub.id).length) cards.push(hubCardHtml(hub, kids, !selfMatch && kids.length > 0));
      else cards.push(simpleCardHtml(hub));
    });

    orphans.forEach((s) => {
      if (state.filter !== "all" && state.filter !== "fav" && s.district !== state.filter) return;
      if (state.filter === "fav" && !isFav(s.id)) return;
      if (!matchesQuery(s, q)) return;
      cards.push(simpleCardHtml(s));
    });

    grid.innerHTML = cards.join("");
    const empty = cards.length === 0;
    $("#deckEmpty").hidden = !empty;
    grid.hidden = empty;
    if (empty) {
      const title = $(".empty__title"), desc = $(".empty__desc");
      if (state.filter === "fav") { title.textContent = "아직 즐겨찾기 핀이 없어요"; desc.textContent = "마을 지도나 카드에서 ⭐를 눌러 두면 여기에 모여요."; }
      else if (state.query) { title.textContent = "‘" + state.query + "’ 와 맞는 사이트가 없어요"; desc.textContent = "다른 말로 찾아보거나 검색어를 지워 보세요."; }
      else { title.textContent = "이 자리에는 아직 아무도 살지 않아요"; desc.textContent = "새 건물을 입주시켜 마을을 채워 보세요."; }
    }
  }

  if ($("#deckGrid")) {
    $("#deckGrid").addEventListener("click", (e) => {
      const fav = e.target.closest("[data-fav]");
      if (fav) { toggleFav(fav.dataset.fav); return; }
      const open = e.target.closest("[data-open]");
      if (open) { openDetail(open.dataset.open); return; }
      const fold = e.target.closest("[data-fold-tree]");
      if (fold) {
        const list = fold.parentElement.querySelector(".tree__list");
        const hidden = list.hasAttribute("hidden");
        if (hidden) list.removeAttribute("hidden"); else list.setAttribute("hidden", "");
        fold.setAttribute("aria-expanded", String(hidden));
        fold.querySelector(".tree__fold").textContent = hidden ? "접기 ▾" : "펼치기 ▸";
        return;
      }
      const card = e.target.closest(".card");
      if (card && !e.target.closest("a,button")) openDetail(card.dataset.id);
    });
    $("#filterChips").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter]");
      if (!chip) return;
      state.filter = chip.dataset.filter;
      renderDeck();
    });
  }
  const searchInput = $("#searchInput"), searchClear = $("#searchClear");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.query = searchInput.value;
      if (searchClear) searchClear.hidden = !state.query;
      renderDeck();
    });
  }
  if (searchClear) {
    searchClear.addEventListener("click", () => {
      state.query = ""; searchInput.value = ""; searchClear.hidden = true; searchInput.focus(); renderDeck();
    });
  }

  /* ── 즐겨찾기 ─────────────────────────────────────────── */
  function toggleFav(id) {
    const site = siteById(id);
    if (!site) return;
    const i = state.favs.indexOf(id);
    const on = i === -1;
    if (on) state.favs.push(id); else state.favs.splice(i, 1);
    write(KEY.fav, state.favs);
    renderWorld(); renderDeck();
    if (state.detailId === id) fillDetail(id);
    toast(on ? "⭐ " + site.name + " 핀을 고정했어요" : site.name + " 핀을 풀었어요");
  }

  /* ── 모달 ─────────────────────────────────────────────── */
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
    document.body.style.overflow = state.view === "deck" ? "" : "hidden";
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
  }
  function anyModalOpen() { return $$(".modal").some((m) => !m.hidden); }
  function topModal() { const open = $$(".modal").filter((m) => !m.hidden); return open[open.length - 1] || null; }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (anyModalOpen()) {
        const m = topModal();
        if (m.id === "detailModal") state.detailId = null;
        closeModal(m);
        return;
      }
      if (state.tour.on) { stopTour(); return; }
      if (state.mode === "walk") { exitWalk(); return; }
    }
    if (e.key !== "Tab") return;
    const m = topModal();
    if (!m) return;
    const focusables = $$('a[href], button:not([disabled]), input:not([type="hidden"]), textarea, select, [tabindex]:not([tabindex="-1"])', m)
      .filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
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

  /* ── 상세 시트 ────────────────────────────────────────── */
  const detailModal = $("#detailModal");

  function depthBoxHtml(site) {
    const kids = childrenOf(site.id);
    if (kids.length) {
      return `<div class="depthbox depthbox--hub">
        <p class="depthbox__title">🔗 연결된 하위 사이트 <span class="depthbox__count">별관 ${kids.length}</span></p>
        <ul class="depthbox__list">
          ${kids.map((k, i) => {
            const kp = presetOf(k.building);
            return `<li class="depthbox__item">
              <span class="depthbox__branch" aria-hidden="true">${i === kids.length - 1 ? "└─" : "├─"}</span>
              <span class="depthbox__thumb"><img src="${esc(kp.img)}" alt="" width="30" height="30" loading="lazy"></span>
              <button type="button" class="depthbox__name" data-goto="${esc(k.id)}">${esc(k.name)}<span class="depthbox__role">${esc(roleOf(k))}</span></button>
              <a class="depthbox__open" href="${esc(k.url)}"${linkTarget(k)} aria-label="${esc(k.name)} ${esc(openWord(k))}">열기 ↗</a>
            </li>`;
          }).join("")}
        </ul>
      </div>`;
    }
    if (site.tier === 2) {
      const parent = siteById(site.parent);
      if (parent) {
        return `<div class="depthbox depthbox--child">
          <p class="depthbox__title">⬆️ 상위 허브</p>
          <button type="button" class="depthbox__parent" data-goto="${esc(parent.id)}">
            <span class="tierbadge">본부</span>
            <b>${esc(parent.name)}</b>
            <span class="arrow">→</span>
          </button>
        </div>`;
      }
    }
    return `<div class="depthbox">
      <p class="depthbox__title">🌿 본부 · 독립 사이트</p>
      <p style="margin:0;font-size:11.5px;line-height:1.6;color:var(--ink-soft)">다른 본부에 매달리지 않고 홀로 서는 사이트예요. 이 건물을 본부로 삼아 별관을 이어 붙일 수 있습니다.</p>
    </div>`;
  }

  function fillDetail(id) {
    const site = siteById(id);
    if (!site) { closeModal(detailModal); state.detailId = null; return; }
    const d = districtOf(site.district);
    const preset = presetOf(site.building);
    const fav = isFav(site.id);

    $("#detailImg").src = preset.img;
    $("#detailImg").alt = preset.name + " 건물 그림";
    $("#detailDistrict").textContent = d.emoji + " " + d.name;
    $("#detailTier").textContent = site.tier === 2 ? "별관" : "본부";
    $("#detailTier").style.background = site.tier === 2 ? "var(--t2)" : "var(--t1)";
    $("#detailPin").hidden = !fav;
    $("#detailBuilding").textContent = preset.name + " · " + preset.en;
    $("#detailTitle").textContent = site.name;
    $("#detailDesc").textContent = site.desc || "아직 소개 글이 없어요. 정보를 수정해 한 줄 소개를 남겨 보세요.";
    $("#detailTags").innerHTML = (site.tags || []).map((t, i) => `<li><span class="tag${i % 2 ? " tag--soft" : ""}">${esc(t)}</span></li>`).join("");
    $("#detailDepth").innerHTML = depthBoxHtml(site);
    /* 외부 사이트는 상세 시트의 URL 링크·열기 버튼도 새 탭으로 */
    const newTab = opensInNewTab(site);
    [$("#detailUrl"), $("#detailOpen")].forEach((a) => {
      if (!a) return;
      a.href = site.url;
      if (newTab) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      else { a.removeAttribute("target"); a.removeAttribute("rel"); }
    });
    $("#detailUrl").textContent = shortUrl(site.url);
    const openBtnEl = $("#detailOpen");
    if (openBtnEl) openBtnEl.textContent = newTab ? "🚀 새 탭에서 열기" : "🚀 사이트 열기";

    const repo = repoUrl(site.repo), repoBtn = $("#detailRepo");
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
      $("#detailEdit").addEventListener("click", () => { closeModal(detailModal); openForm("edit", site.id); });
      $("#detailDelete").addEventListener("click", () => askDelete(site));
    }
  }

  function askDelete(site) {
    const kids = childrenOf(site.id);
    const manage = $("#detailManage");
    if (kids.length) {
      manage.innerHTML = `<p class="confirm__text"><strong>${esc(site.name)}</strong> 은(는) 하위 사이트 <b>${kids.length}곳</b>이 연결된 본부예요.
        먼저 하위 사이트를 철거하거나 다른 본부로 옮긴 뒤 철거할 수 있어요.</p>
        <button type="button" class="btn btn--quiet" id="delCancel">알겠어요</button>`;
      $("#delCancel").addEventListener("click", () => fillDetail(site.id));
      return;
    }
    manage.innerHTML = `
      <p class="confirm__text"><strong>${esc(site.name)}</strong> 을(를) 마을에서 철거할까요? 되돌릴 수 없어요.</p>
      <button type="button" class="btn btn--quiet" id="delCancel">취소</button>
      <button type="button" class="btn btn--danger" id="delOk">철거하기</button>`;
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
    if (!siteById(id)) return;
    state.detailId = id;
    fillDetail(id);
    openModal(detailModal);
  }
  if ($("#detailFav")) $("#detailFav").addEventListener("click", () => { if (state.detailId) toggleFav(state.detailId); });
  if ($("#detailDepth")) {
    $("#detailDepth").addEventListener("click", (e) => {
      const goto = e.target.closest("[data-goto]");
      if (goto) { openDetail(goto.dataset.goto); return; }
    });
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
  function tierValue() {
    const r = $('#siteForm input[name="tier"]:checked');
    return r && r.value === "2" ? 2 : 1;
  }
  function parentValue() { return $("#fParent") ? $("#fParent").value : ""; }

  function fillParentOptions(selected) {
    const sel = $("#fParent");
    if (!sel) return;
    const hubs = allSites().filter((s) => s.tier !== 2 && s.id !== state.editingId);
    sel.innerHTML = hubs.map((h) => {
      const n = childrenOf(h.id).length;
      return `<option value="${esc(h.id)}"${selected === h.id ? " selected" : ""}>${esc(h.name)} — ${esc(districtOf(h.district).name)}${n ? " · 하위 " + n : " · 하위 없음"}</option>`;
    }).join("");
  }

  function syncTierUI() {
    const tier = tierValue();
    const pp = $("#parentPick"), df = $("#districtField");
    if (pp) pp.hidden = tier !== 2;
    if (df) df.hidden = tier === 2;
    $$(".tiercard", $("#tierPick")).forEach((el) => {
      const on = Number(el.dataset.tier) === tier;
      el.classList.toggle("is-checked", on);
      $("input", el).checked = on;
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
    fillParentOptions(site && site.parent);

    const tier = site ? (site.tier === 2 ? 2 : 1) : 1;
    $$('#siteForm input[name="tier"]').forEach((r) => { r.checked = Number(r.value) === tier; });

    const district = site ? site.district : (districtId || "travel");
    markPick($("#districtPick"), district);
    markPick($("#buildingPick"), site ? site.building : (tier === 2 ? "cafe" : "travel-hub"));

    $$(".pick, .bpick", formModal).forEach((el) => {
      const input = $("input", el);
      input.addEventListener("change", () => markPick(el.parentElement, input.value));
    });
    $$('#siteForm input[name="tier"]').forEach((r) => r.addEventListener("change", syncTierUI));

    syncTierUI();
    inValidate(null);
    openModal(formModal);
    setTimeout(() => $("#fName").focus({ preventScroll: true }), 80);
  }

  function inValidate(msg) {
    if (!formError) return;
    if (msg) { formError.textContent = msg; formError.hidden = false; }
    else { formError.textContent = ""; formError.hidden = true; }
  }

  /* 자동 배치 */
  function positionForNew(districtId, parentId) {
    const occupied = allSites();
    const distToAll = (x, y, skipId) => {
      let min = 1e9;
      occupied.forEach((s) => {
        if (s.id === skipId) return;
        const p = sitePos(s);
        min = Math.min(min, Math.hypot(p.x - x, p.y - y));
      });
      return min;
    };
    if (parentId) {
      const parent = siteById(parentId);
      if (parent) {
        const p = sitePos(parent);
        const angles = [-150, -35, 35, 150, -100, 100, 0, 180];
        for (const R of [330, 400, 470, 540]) {
          for (const a of angles) {
            const rad = (a * Math.PI) / 180;
            const x = clamp(p.x + Math.cos(rad) * R, 160, W.w - 160);
            const y = clamp(p.y - 30 + Math.sin(rad) * R * 0.78, 260, W.h - 150);
            if (distToAll(x, y, parent.id) > 210) return [Math.round(x), Math.round(y)];
          }
        }
        return [clamp(p.x + 340, 160, W.w - 160), clamp(p.y + 40, 260, W.h - 150)];
      }
    }
    const d = districtOf(districtId);
    const slots = (d.slots || []).slice();
    let best = null, bestD = -1;
    slots.forEach(([x, y]) => {
      const dist = distToAll(x, y);
      if (dist > bestD) { bestD = dist; best = [x, y]; }
    });
    if (best && bestD > 120) return best;
    const z = d.zone || { cx: W.w / 2, cy: W.h / 2 };
    return [Math.round(clamp(z.cx + (Math.random() - 0.5) * 240, 160, W.w - 160)),
            Math.round(clamp(z.cy + (Math.random() - 0.5) * 150, 260, W.h - 150))];
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#fName").value.trim();
      const rawUrl = $("#fUrl").value.trim();
      const desc = $("#fDesc").value.trim();
      const tags = parseTags($("#fTags").value);
      const tier = tierValue();
      const districtInput = $('#siteForm input[name="district"]:checked');
      const buildingInput = $('#siteForm input[name="building"]:checked');
      let district = districtInput ? districtInput.value : "travel";
      const building = buildingInput ? buildingInput.value : "travel-hub";
      const parent = tier === 2 ? parentValue() : null;

      ["#fName", "#fUrl"].forEach((s) => $(s).classList.remove("is-invalid"));
      if (!name) { $("#fName").classList.add("is-invalid"); inValidate("사이트 이름을 적어 주세요."); $("#fName").focus(); return; }
      const url = normalizeUrl(rawUrl);
      if (!url || !isValidUrl(url)) { $("#fUrl").classList.add("is-invalid"); inValidate("주소를 다시 확인해 주세요. 예) https://example.com"); $("#fUrl").focus(); return; }
      const dup = allSites().find((s) => s.id !== state.editingId && normalizeUrl(s.url).replace(/\/$/, "") === url.replace(/\/$/, ""));
      if (dup) { $("#fUrl").classList.add("is-invalid"); inValidate("이미 입주한 주소예요 (" + dup.name + "). 다른 주소를 넣어 주세요."); $("#fUrl").focus(); return; }
      if (tier === 2 && !parent) { inValidate("별관으로 입주하려면 상위 본부를 골라 주세요."); return; }
      if (tier === 2 && parent) {
        const p = siteById(parent);
        if (p) district = p.district;
      }

      let created = null;
      if (state.editingId) {
        const target = state.custom.find((s) => s.id === state.editingId);
        if (target) {
          const wasParent = target.parent;
          Object.assign(target, { name, url, desc, tags, district, building, tier, parent: tier === 2 ? parent : null });
          if (tier === 2 && target.pos && wasParent !== parent) {
            target.pos = positionForNew(district, parent);
          }
          if (tier === 1 && wasParent) {
            target.pos = positionForNew(district, null);
            target.role = districtOf(district).name + " · 독립 사이트";
          }
          write(KEY.custom, state.custom);
          toast("✏️ " + name + " 정보를 고쳤어요");
        }
      } else {
        created = {
          id: "custom-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name, url, desc, tags, repo: "",
          district, building, tier, parent: tier === 2 ? parent : null,
          pos: positionForNew(district, tier === 2 ? parent : null),
          w: tier === 2 ? 168 : 240,
          role: tier === 2
            ? "별관 · " + (siteById(parent) ? siteById(parent).name : "본부") + " 하위"
            : districtOf(district).name + " · 독립 사이트",
          custom: true,
          addedAt: new Date().toISOString()
        };
        state.custom.push(created);
        write(KEY.custom, state.custom);
        if (tier === 2) {
          const p = siteById(parent);
          toast("🎉 " + name + " 이(가) " + (p ? p.name : "본부") + " 옆 별관으로 연결됐어요");
        } else {
          toast("🎉 " + name + " 이(가) " + districtOf(district).name + "에 입주했어요");
        }
      }

      state.editingId = null;
      closeModal(formModal);
      state.filter = "all"; state.query = "";
      if (searchInput) searchInput.value = "";
      if (searchClear) searchClear.hidden = true;
      renderAll();
      renderDeck();
      setView(state.view, false, { scroll: false });

      const focusId = created ? created.id : state.detailId;
      if (created) {
        setTimeout(() => {
          focusSite(created, 900);
          const el = bldsEl.querySelector('[data-id="' + created.id + '"]');
          if (el) { el.classList.add("bld--tour"); setTimeout(() => el.classList.remove("bld--tour"), 2400); }
          openDetail(created.id);
        }, 140);
      }
    });
  }

  if ($("#addBtn")) $("#addBtn").addEventListener("click", () => openForm("add"));
  if ($("#deckEmpty")) {
    const addInEmpty = $('[data-action="add"]', $("#deckEmpty"));
    if (addInEmpty) addInEmpty.addEventListener("click", () => openForm("add"));
  }
  if ($("#addBtn")) $("#addBtn").addEventListener("click", () => { if (state.mode === "walk") exitWalk(); });

  /* ── 내보내기 ─────────────────────────────────────────── */
  function exportJson() {
    const sites = allSites().map((s) => ({
      id: s.id, name: s.name, url: s.url, repo: s.repo || "",
      district: s.district, building: s.building, tier: s.tier === 2 ? 2 : 1,
      parent: s.parent || null, pos: sitePos(s), role: roleOf(s),
      desc: s.desc || "", tags: s.tags || [], custom: !!s.custom
    }));
    const payload = {
      app: "kusari-village", version: 2, exportedAt: new Date().toISOString(),
      count: sites.length, tier1: sites.filter((s) => s.tier === 1).length,
      tier2: sites.filter((s) => s.tier === 2).length,
      favorites: state.favs.slice(), sites
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kusari-village-sites-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    toast("📋 사이트 " + sites.length + "곳(본부 " + payload.tier1 + " · 별관 " + payload.tier2 + ")를 JSON으로 내보냈어요");
  }
  if ($("#exportBtn")) $("#exportBtn").addEventListener("click", exportJson);
  if ($("#formExportBtn")) $("#formExportBtn").addEventListener("click", exportJson);

  /* ── 자동 투어 ────────────────────────────────────────── */
  /*    대문(WALK_SPAWN)에 서 있는 아바타가 정류장마다 건물 앞까지
        걸어가고, 카메라가 부드럽게 따라간 뒤 안내를 보여준다.          */
  const tourCap = $("#tourCap");
  const TOUR_SPEED = 258;  /* 세계 좌표 px/초 — 뛰지 않는 여유 있는 도보 속도 */
  const TOUR_ACC = 780;    /* px/초² — 출발·도착을 부드럽게 */

  function tourStops() {
    const stops = [{
      key: "entrance", cx: 1180, cy: 1700, s: 0.95,
      title: "마을 입구", desc: "어서 오세요, 쿠사리 빌리지입니다. 강을 건너 오솔길을 따라 여행 지구 본부로 올라가 볼까요?"
    }];
    const order = ["travel", "creative", "work", "sprout"];
    order.forEach((did) => {
      allSites().filter((s) => s.district === did && s.tier !== 2).forEach((hub) => {
        const kids = childrenOf(hub.id);
        stops.push({
          key: hub.id, site: hub, s: kids.length ? 0.82 : 0.95,
          title: hub.name,
          /* 안내 카드에도 `본부 · 별관 N개` 같은 구분 표기를 쓰지 않는다 */
          desc: stripTierWord(hub.desc || roleOf(hub))
        });
        kids.forEach((k) => stops.push({
          key: k.id, site: k, s: 1.02,
          title: k.name,
          desc: stripTierWord(k.desc || roleOf(k))
        }));
      });
    });
    const n1 = allSites().filter((s) => s.tier !== 2).length;
    const n2 = allSites().filter((s) => s.tier === 2).length;
    stops.push({ key: "overview", cx: W.w / 2, cy: 900, s: minScale, title: "마을 한 바퀴 완료", desc: "마을의 " + (n1 + n2) + "곳을 모두 둘러봤어요. 미니맵이나 왼쪽 지구 바로 원하는 곳을 다시 찾아가세요." });
    return stops;
  }

  /* 명패 한 줄 소개(`본부. …` / `별관. …`)의 구분 접두어만 걷어낸다 */
  function stripTierWord(text) {
    return String(text || "").replace(/^(본부|별관)\s*[.·]\s*/, "");
  }

  function siteFocus(site, s) {
    const p = sitePos(site);
    const preset = presetOf(site.building);
    const w = widthOf(site);
    const h = (w * (preset.h || 700)) / (preset.w || 760);
    return { cx: p.x, cy: p.y - h * 0.52, s: s || (site.tier === 2 ? 1.0 : 0.9) };
  }

  /* 정류장 인사 지점 — 건물 발밑 앞쪽 여백.
     명패는 발밑 아래로 붙으므로 아바타가 이름을 가리지 않고,
     마을 가운데(오솔길) 쪽으로 살짝 비켜서서 길에서 온 사람처럼 선다. */
  function greetPoint(site) {
    const p = sitePos(site);
    const w = widthOf(site);
    const side = p.x > W.w / 2 ? -1 : 1;
    return { x: Math.round(p.x + side * w * 0.34), y: Math.round(p.y + 26) };
  }

  function setTourState(walking) {
    const badge = $("#tourState");
    if (badge) badge.hidden = !walking;
    if (tourCap) tourCap.classList.toggle("is-walking", !!walking);
  }

  /* 아바타를 목적지까지 걷게 한다 — 도착하면 onArrive 를 부른다 */
  function startTourWalk(to, onArrive, opts) {
    opts = opts || {};
    stopCamAnim();  /* 도착 연출 중이던 카메라 이동을 끊고 추적 카메라로 넘긴다 */
    const from = { x: state.walk.x, y: state.walk.y };
    const dx = to.x - from.x, dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    state.tour.leg = {
      from: from, to: to, dist: dist, left: dist, v: 0,
      ux: dist ? dx / dist : 0, uy: dist ? dy / dist : 0,
      follow: opts.follow !== false,
      camS: opts.camS || state.cam.s,
      onArrive: onArrive || null
    };
    if (Math.abs(dx) > 4) state.walk.face = dx > 0 ? 1 : -1;
    state.walk.moving = dist > 1;
    updateAvatar();
    setTourState(true);
    if (dist <= 1) finishTourWalk();
  }

  function finishTourWalk() {
    const leg = state.tour.leg;
    state.tour.leg = null;
    if (leg) { state.walk.x = leg.to.x; state.walk.y = leg.to.y; }
    state.walk.moving = false;
    updateAvatar();
    if (leg && typeof leg.onArrive === "function") leg.onArrive();
  }

  /* 매 프레임: 일정한 도보 속도로 걸어가고 카메라가 뒤따라간다 */
  function stepTourWalk(dt) {
    const leg = state.tour.leg;
    if (!leg) return;
    /* 남은 거리에 맞춘 목표 속도 — 도착이 가까우면 저절로 느려진다 */
    const vTarget = Math.min(TOUR_SPEED, Math.sqrt(2 * TOUR_ACC * Math.max(0, leg.left)));
    leg.v += clamp(vTarget - leg.v, -TOUR_ACC * 1.7 * dt, TOUR_ACC * dt);
    const step = Math.min(leg.left, Math.max(0, leg.v * dt));
    leg.left = Math.max(0, leg.left - step);
    state.walk.x = leg.to.x - leg.ux * leg.left;
    state.walk.y = leg.to.y - leg.uy * leg.left;
    state.walk.moving = true;
    updateAvatar();

    if (leg.follow) {
      const k = 1 - Math.pow(0.0016, dt);
      state.cam.cx = lerp(state.cam.cx, state.walk.x, k);
      state.cam.cy = lerp(state.cam.cy, state.walk.y - 120, k);
      state.cam.s = lerp(state.cam.s, leg.camS, 1 - Math.pow(0.08, dt));
      applyCam();
    }
    if (leg.left <= 0.5) finishTourWalk();
  }
  function focusSite(site, dur) {
    const f = siteFocus(site);
    panTo(f.cx, f.cy, dZoom(f.s), dur == null ? 900 : dur);
  }

  /* 투어 하이라이트만 걷어낸다(말풍선 숨김 표시 포함) */
  function clearTourMark() {
    $$(".bld--tour").forEach((el) => { el.classList.remove("bld--tour"); el.classList.remove("bld--quiet"); });
  }

  /* 투어 정류장 표시 — 건물 하이라이트만 켜고 말풍선은 띄우지 않는다
     (본부·별관·독립 사이트 구분 없이 전부 동일) */
  function showBubble(siteId) {
    clearTourMark();
    const el = bldsEl.querySelector('.bld[data-id="' + siteId + '"]');
    if (!el) return;
    const b = $(".bubble", el);
    if (b) b.textContent = "";
    el.classList.add("bld--quiet");
    el.classList.add("bld--tour");
  }

  function renderTourDots(n, active) {
    const dots = $("#tourDots");
    if (!dots) return;
    dots.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i === active ? "is-on" : ""}"></i>`).join("");
    $("#tourStep").textContent = (active + 1) + " / " + n;
  }

  function startTour() {
    if (state.mode === "walk") exitWalk();
    if (state.view !== "map") setView("map", true);
    const stops = tourStops();
    state.tour.on = true;
    state.tour.stops = stops;
    state.tour.i = -1;
    state.tour.leg = null;
    document.body.classList.add("is-touring");
    $("#tourBtn").setAttribute("aria-pressed", "true");
    $("#tourBtn .dock__ico").textContent = "❚❚";
    $("#tourBtn .dock__label").textContent = "투어 정지";
    tourCap.hidden = false;
    $("#tourOpen").style.display = "none";
    nextTourStep();
    hideCoach();
  }

  function nextTourStep() {
    clearTimeout(state.tour.timer);
    if (!state.tour.on) return;
    state.tour.i += 1;
    const stops = state.tour.stops;
    if (state.tour.i >= stops.length) { stopTour(true); return; }
    const st = stops[state.tour.i];
    renderTourDots(stops.length, state.tour.i);
    $("#tourTitle").textContent = st.title;
    $("#tourDesc").textContent = st.desc;
    $("#tourOpen").style.display = "none";

    /* 정류장마다: 지금 아바타 위치 → 건물 앞까지 천천히 걸어간 뒤 안내 */
    if (st.site) {
      startTourWalk(greetPoint(st.site), () => arriveAtStop(st), { camS: dZoom(st.s) });
    } else if (st.key === "overview") {
      /* 마지막: 안내자가 대문으로 걸어 돌아가는 동안 마을 전체를 조망 */
      startTourWalk({ x: WALK_SPAWN.x, y: WALK_SPAWN.y }, () => arriveAtStop(st), { camS: minScale, follow: false });
      panTo(st.cx, st.cy, dZoom(st.s), 1500);
    } else {
      /* 마을 입구: 안내자가 대문 앞으로 걸어온다 */
      startTourWalk({ x: WALK_SPAWN.x, y: WALK_SPAWN.y }, () => arriveAtStop(st), { camS: dZoom(st.s) });
    }
  }

  /* 정류장 도착 — 카메라를 건물 앞에 앉히고 투어 카드/안내를 보여준다 */
  function arriveAtStop(st) {
    setTourState(false);
    $("#tourDesc").textContent = st.desc;
    if (st.site) {
      const f = siteFocus(st.site);
      /* 도착 안내 카드가 건물 발밑 명패를 가리지 않도록 건물을 살짝 위로 앉힌다 */
      panTo(f.cx, f.cy + (isNarrow() ? 80 : 64), dZoom(f.s), 900);
      /* 자동 투어에서는 본부·별관 구분 없이 건물 위 말풍선을 띄우지 않는다 — 하이라이트만 */
      showBubble(st.site.id);
      const openBtn = $("#tourOpen");
      openBtn.style.display = "";
      openBtn.textContent = opensInNewTab(st.site) ? "새 탭에서 열기 ↗" : "사이트 열기 ↗";
      openBtn.onclick = () => goToSite(st.site);
    } else {
      clearTourMark();
      if (typeof st.cx === "number") panTo(st.cx, st.cy, dZoom(st.s), 1100);
      $("#tourOpen").style.display = "none";
    }
    const dwell = st.site ? (st.site.tier === 2 ? 2800 : 3400) : 3400;
    clearTimeout(state.tour.timer);
    state.tour.timer = setTimeout(nextTourStep, dwell);
  }

  /* 투어 카드의 ◀ 이전 / 다음 ▶ — 지금 서 있는 자리에서 다음 목적지로 걷는다 */
  function goTourStep(delta) {
    if (!state.tour.on) return;
    const last = state.tour.stops.length - 1;
    const target = clamp(state.tour.i + delta, 0, last);
    clearTimeout(state.tour.timer);
    state.tour.leg = null;
    state.walk.moving = false;
    updateAvatar();
    state.tour.i = target - 1;
    nextTourStep();
  }

  function stopTour(finished) {
    if (!state.tour.on) return;
    state.tour.on = false;
    clearTimeout(state.tour.timer);
    /* 걷던 발걸음은 그 자리에서 자연스럽게 멈춘다 */
    state.tour.leg = null;
    state.walk.moving = false;
    updateAvatar();
    setTourState(false);
    document.body.classList.remove("is-touring");
    tourCap.hidden = true;
    clearTourMark();
    const btn = $("#tourBtn");
    if (btn) {
      btn.setAttribute("aria-pressed", "false");
      $(".dock__ico", btn).textContent = "▶";
      $(".dock__label", btn).textContent = "자동 투어";
    }
    if (finished) toast("🏡 마을 한 바퀴를 다 돌았어요");
  }
  function stopTourIfUser() { if (state.tour.on) stopTour(); }

  if ($("#tourBtn")) $("#tourBtn").addEventListener("click", () => {
    if (state.tour.on) stopTour(); else startTour();
  });
  if ($("#tourStop")) $("#tourStop").addEventListener("click", () => stopTour());
  if ($("#tourNext")) $("#tourNext").addEventListener("click", () => goTourStep(1));
  if ($("#tourPrev")) $("#tourPrev").addEventListener("click", () => goTourStep(-1));

  /* ── 걷기 모드 ────────────────────────────────────────── */
  const avatar = $("#avatar");
  const keys = new Set();
  /* 기본 스폰 — 대문 아치 바로 앞(문 밖 앞마당 돌바닥) */
  const WALK_SPAWN = { x: 1180, y: 1812 };
  function enterWalk() {
    stopTour();
    if (state.view !== "map") setView("map", true);
    state.mode = "walk";
    document.body.dataset.mode = "walk";
    stage.classList.add("is-walk");
    /* 대문(쿠사리 빌리지 아치) 바로 앞 길 위에서 걷기를 시작한다 */
    state.walk.x = WALK_SPAWN.x; state.walk.y = WALK_SPAWN.y;
    state.walk.target = null;
    state.walk.vx = 0; state.walk.vy = 0;
    $("#walkBtn").setAttribute("aria-pressed", "true");
    $("#walkHint").hidden = false;
    $("#joy").hidden = false;
    $("#coach").hidden = true;
    panTo(WALK_SPAWN.x, WALK_SPAWN.y - 90, dZoom(1.08), 800);
    
    hideCoach();
    updateAvatar();
  }
  function exitWalk() {
    state.mode = "browse";
    document.body.dataset.mode = "browse";
    stage.classList.remove("is-walk");
    $("#walkBtn").setAttribute("aria-pressed", "false");
    $("#walkHint").hidden = true;
    $("#joy").hidden = true;
    state.walk.target = null;
    if (state.nearId) {
      const prev = bldsEl.querySelector('.bld[data-id="' + state.nearId + '"]');
      if (prev) prev.classList.remove("bld--near");
      state.nearId = null;
    }
    keys.clear();
  }
  if ($("#walkBtn")) $("#walkBtn").addEventListener("click", () => { if (state.mode === "walk") exitWalk(); else enterWalk(); });
  if ($("#walkExit")) $("#walkExit").addEventListener("click", exitWalk);
  if ($("#walkEnterBtn")) $("#walkEnterBtn").addEventListener("click", () => { if (state.nearId) goToSite(siteById(state.nearId)); });

  function blocked(x, y) {
    if (x < 90 || x > W.w - 90 || y < 210 || y > W.h - 60) return true;
    for (const s of allSites()) {
      const p = sitePos(s);
      const r = widthOf(s) * 0.3;
      if (Math.hypot(p.x - x, p.y - y) < r) return true;
    }
    return false;
  }

  function updateAvatar() {
    if (!avatar) return;
    avatar.style.transform = "translate3d(" + state.walk.x.toFixed(1) + "px," + state.walk.y.toFixed(1) + "px,0)";
    avatar.classList.toggle("is-step", state.walk.moving);
    avatar.classList.toggle("avatar--flip", state.walk.face < 0);
  }

  const KEYMAP = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0]
  };
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea,select")) return;
    if (anyModalOpen()) return;
    if (state.mode === "walk") {
      if (e.key === "Enter" && state.nearId) { e.preventDefault(); goToSite(siteById(state.nearId)); return; }
      if (KEYMAP[e.key]) { keys.add(e.key); e.preventDefault(); state.walk.target = null; return; }
    } else {
      if (e.key === "+" || e.key === "=") { zoomBy(1.25); return; }
      if (e.key === "-") { zoomBy(0.8); return; }
      if (e.key === "0") { panTo(W.w / 2, 830, minScale, 700); return; }
      if (e.key === "t" || e.key === "T") { if (state.tour.on) stopTour(); else startTour(); return; }
      if (e.key === "w" || e.key === "W") { enterWalk(); return; }
    }
  });
  document.addEventListener("keyup", (e) => { if (KEYMAP[e.key]) keys.delete(e.key); });
  window.addEventListener("blur", () => keys.clear());

  function zoomBy(f) {
    stopTourIfUser();
    const s = clamp(state.cam.s * f, minScale, MAX_S);
    panTo(state.cam.cx, state.cam.cy, s, 240);
  }
  if ($("#zoomIn")) $("#zoomIn").addEventListener("click", () => zoomBy(1.3));
  if ($("#zoomOut")) $("#zoomOut").addEventListener("click", () => zoomBy(1 / 1.3));
  if ($("#zoomFit")) $("#zoomFit").addEventListener("click", () => {
    stopTourIfUser();
    panTo(W.w / 2, 830, minScale, 760);
  });

  /* 조이스틱 */
  const joy = $("#joy"), knob = $("#joyKnob");
  if (joy) {
    let joyActive = false, jx = 0, jy = 0;
    const setKnob = (dx, dy) => { knob.style.transform = "translate(" + dx + "px," + dy + "px)"; };
    const start = (e) => {
      joyActive = true; joy.setPointerCapture(e.pointerId);
      state.walk.target = null;
      move(e);
    };
    const move = (e) => {
      if (!joyActive) return;
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const max = r.width / 2 - 16;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      setKnob(dx, dy);
      jx = dx / max; jy = dy / max;
    };
    const end = () => { joyActive = false; jx = 0; jy = 0; setKnob(0, 0); };
    joy.addEventListener("pointerdown", start);
    joy.addEventListener("pointermove", move);
    joy.addEventListener("pointerup", end);
    joy.addEventListener("pointercancel", end);
    joy._axis = () => ({ x: jx, y: jy });
  }

  /* ── 메인 루프: 걷기 + 카메라 팔로우 ─────────────────── */
  let lastT = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (state.tour.leg) stepTourWalk(dt);
    else if (state.mode === "walk") {
      const speed = 340;
      let vx = 0, vy = 0;
      keys.forEach((k) => { const v = KEYMAP[k]; if (v) { vx += v[0]; vy += v[1]; } });
      if (joy && joy._axis) { const a = joy._axis(); vx += a.x; vy += a.y; }
      if (vx === 0 && vy === 0 && state.walk.target) {
        const dx = state.walk.target.x - state.walk.x, dy = state.walk.target.y - state.walk.y;
        const d = Math.hypot(dx, dy);
        if (d > 14) { vx = dx / d; vy = dy / d; } else { state.walk.target = null; }
      }
      const len = Math.hypot(vx, vy);
      if (len > 0) {
        vx /= len; vy /= len;
        const step = speed * dt;
        const nx = state.walk.x + vx * step;
        const ny = state.walk.y + vy * step;
        if (!blocked(nx, state.walk.y)) state.walk.x = nx;
        if (!blocked(state.walk.x, ny)) state.walk.y = ny;
        if (Math.abs(vx) > 0.08) state.walk.face = vx > 0 ? 1 : -1;
        state.walk.moving = true;
      } else {
        state.walk.moving = false;
      }
      updateAvatar();

      state.cam.cx = lerp(state.cam.cx, state.walk.x, 1 - Math.pow(0.001, dt));
      state.cam.cy = lerp(state.cam.cy, state.walk.y - 60, 1 - Math.pow(0.001, dt));
      state.cam.s = lerp(state.cam.s, dZoom(1.12), 1 - Math.pow(0.02, dt));
      applyCam();

      /* 가까운 건물 */
      let near = null, nd = 1e9;
      allSites().forEach((s) => {
        const p = sitePos(s);
        const d = Math.hypot(p.x - state.walk.x, p.y - (state.walk.y - 10));
        const limit = widthOf(s) * 0.42 + 70;
        if (d < limit && d < nd) { nd = d; near = s; }
      });
      const nearId = near ? near.id : null;
      if (nearId !== state.nearId) {
        if (state.nearId) {
          const prev = bldsEl.querySelector('.bld[data-id="' + state.nearId + '"]');
          if (prev) prev.classList.remove("bld--near");
        }
        state.nearId = nearId;
        const enterBtn = $("#walkEnterBtn");
        if (near) {
          const el = bldsEl.querySelector('.bld[data-id="' + near.id + '"]');
          if (el) { el.classList.add("bld--near"); const b = $(".bubble", el); if (b) b.textContent = "들어가기 ⏎"; }
          if (enterBtn) { enterBtn.hidden = false; enterBtn.textContent = near.name + " 들어가기"; }
        } else if (enterBtn) {
          enterBtn.hidden = true;
        }
      }
    }
    drawFx(dt);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ── 첫 방문 안내 ─────────────────────────────────────── */
  function hideCoach() {
    const c = $("#coach");
    if (c) c.hidden = true;
    document.body.classList.remove("coach-open");
  }
  (function coach() {
    if (read(KEY.coach, false)) return;
    if (state.view !== "map") return;
    setTimeout(() => {
      if (anyModalOpen() || state.tour.on || state.mode === "walk") return;
      const c = $("#coach"); if (c) { c.hidden = false; document.body.classList.add("coach-open"); }
    }, 1500);
  })();
  if ($("#coach")) {
    $("#coach").addEventListener("click", (e) => {
      if (e.target.closest("[data-close-coach]")) { hideCoach(); write(KEY.coach, true); }
    });
  }
  if ($("#coachTour")) {
    $("#coachTour").addEventListener("click", () => { write(KEY.coach, true); hideCoach(); startTour(); });
  }

  /* ── 전체 렌더 ────────────────────────────────────────── */
  function renderAll() {
    renderWorld();
    renderStats();
    renderDistrictChips();
    renderMinimap();
  }

  $("#terrain").innerHTML = terrainSVG();
  renderAll();
  updateAvatar();
  setView(read(KEY.view, "map") === "deck" ? "deck" : "map", false);
  if (location.hash === "#work") setView("deck", false);

  /* QA 훅 */
  window.__KV = {
    state, sites: allSites, focusSite, startTour, stopTour, enterWalk, exitWalk,
    setView, openDetail, openForm, panTo, applyCam, goToSite, opensInNewTab,
    greetPoint, startTourWalk, goTourStep, arriveAtStop,
    applyTime, applyWeather, phaseOfNow, phaseNow, loadWeather,
    get cam() { return state.cam; },
    get tour() { return state.tour; },
    get fx() { return fxKind; },
    get weather() { return state.wx; }
  };
})();
