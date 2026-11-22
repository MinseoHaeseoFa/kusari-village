/* ============================================================
   🏡 쿠사리 타운 v2 — app.js
   2.5D 마을 지도 · Depth(1단계/2단계) 계층 · 카메라/투어/걷기
   기본 명단(data/sites.js) + 내가 입주시킨 건물(localStorage)
   ============================================================ */
(function () {
  "use strict";

  const CFG = window.KUSARI_TOWN || { world: { w: 2400, h: 1660 }, districts: [], presets: [], sites: [] };
  const W = CFG.world || { w: 2400, h: 1660 };
  const DISTRICTS = CFG.districts || [];
  const PRESETS = CFG.presets || [];
  const GH_USER = "MinseoHaeseoFa";

  const KEY = {
    custom: "kusari-village:v2:custom-sites",
    fav: "kusari-village:v2:favorites",
    theme: "kusari-village:v2:theme",
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
    cam: { cx: W.w / 2, cy: W.h / 2, s: 0.55 },
    walk: { x: 1180, y: 1500, vx: 0, vy: 0, target: null, face: 1, moving: false, last: 0 },
    nearId: null,
    tour: { on: false, i: 0, timer: null },
    hoverDistrict: null
  };

  const BASE_SITES = (CFG.sites || []).map((s) => Object.assign({}, s, { custom: false }));

  function allSites() { return BASE_SITES.concat(state.custom); }
  function siteById(id) { return allSites().find((s) => s.id === id) || null; }
  function isFav(id) { return state.favs.indexOf(id) > -1; }
  function childrenOf(id) { return allSites().filter((s) => s.tier === 2 && s.parent === id); }
  function isHub(site) { return childrenOf(site.id).length > 0; }
  function roleOf(site) {
    if (site.role) return site.role;
    if (site.tier === 2) {
      const p = siteById(site.parent);
      return "2단계 · " + (p ? p.name : "본부") + " 하위";
    }
    return districtOf(site.district).name + " · 독립 사이트";
  }
  function widthOf(site) {
    if (site.w) return site.w;
    return site.tier === 2 ? 200 : 290;
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
  let minScale = 0.3;
  let camAnim = null;

  const isNarrow = () => vw < 760;
  function fitScale() { return Math.min(vw / W.w, vh / W.h); }
  function dZoom(base) { return Math.max(minScale, base * (isNarrow() ? 0.62 : 1)); }

  function clampCam() {
    const visW = vw / state.cam.s, visH = vh / state.cam.s;
    if (visW >= W.w) state.cam.cx = W.w / 2;
    else state.cam.cx = clamp(state.cam.cx, visW / 2, W.w - visW / 2);
    if (visH >= W.h) state.cam.cy = W.h / 2;
    else state.cam.cy = clamp(state.cam.cy, visH / 2, W.h - visH / 2);
  }

  let miniViewEl = null;
  function applyCam() {
    state.cam.s = clamp(state.cam.s, minScale, 2.6);
    clampCam();
    const s = state.cam.s;
    const tx = vw / 2 - state.cam.cx * s;
    const ty = vh / 2 - state.cam.cy * s;
    world.style.transform = "translate3d(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px,0) scale(" + s.toFixed(4) + ")";
    world.style.setProperty("--inv", Math.min(1 / s, 2.2).toFixed(4));
    world.dataset.zoom = s < 0.34 ? "tiny" : (s < 0.66 ? "far" : (s < 1.06 ? "mid" : "near"));
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
    const to = { cx: cx, cy: cy, s: clamp(s || state.cam.s, minScale, 2.6) };
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
    minScale = fitScale() * 0.98;
    applyCam();
  }
  window.addEventListener("resize", () => { resize(); });

  /* 초기 카메라 */
  (function initCam() {
    const fit = fitScale();
    minScale = fit * 0.98;
    if (isNarrow()) {
      state.cam.s = Math.max(fit, (vh / W.h) * 1.01);
      state.cam.cx = 1010; state.cam.cy = 760;
    } else {
      state.cam.s = fit * 1.12;
      state.cam.cx = 1180; state.cam.cy = 1460;
    }
    applyCam();
    setTimeout(() => {
      if (isNarrow()) panTo(1010, 780, Math.max(fit, (vh / W.h) * 1.01), 1000);
      else panTo(W.w / 2, W.h / 2, fit, 1100);
    }, 120);
  })();

  /* ── 드래그 · 휠 · 핀치 ───────────────────────────────── */
  const pointers = new Map();
  let dragging = false, dragMoved = 0, lastMid = null, pinchDist = 0, pinchS = 1;

  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
    if (e.target.closest(".bld")) { /* 건물 클릭도 드래그 가능 */ }
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
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
        const nextS = clamp(pinchS * (dist / pinchDist), minScale, 2.6);
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
    const s1 = clamp(s0 * Math.exp(-e.deltaY * 0.0016), minScale, 2.6);
    const wx = state.cam.cx + (px - vw / 2) / s0;
    const wy = state.cam.cy + (py - vh / 2) / s0;
    state.cam.s = s1;
    state.cam.cx = wx - (px - vw / 2) / s1;
    state.cam.cy = wy - (py - vh / 2) / s1;
    applyCam();
  }, { passive: false });

  /* ── 지형(터레인) ─────────────────────────────────────── */
  const RIVER = "M -80 1024 C 260 994 520 1064 860 1056 C 1040 1052 1140 1028 1240 1042 C 1420 1066 1600 1084 1800 1058 C 2000 1032 2200 1012 2480 1036";
  const ROADS = [
    "M 1180 1640 L 1180 1046",
    "M 1180 1040 C 1180 884 1180 776 1104 664",
    "M 1180 1116 C 1062 1180 942 1232 842 1272 C 762 1304 664 1316 592 1324",
    "M 1180 1476 C 1300 1458 1424 1398 1524 1368 C 1652 1330 1780 1324 1904 1314",
    "M 1140 672 C 1300 684 1432 702 1562 702 C 1682 702 1762 708 1812 732",
    "M 1812 732 C 1900 792 1950 852 1998 894"
  ];

  const TREES = [
    [150, 300, 1.0], [108, 520, 0.8], [206, 762, 0.9], [112, 1132, 0.85], [166, 1352, 0.9],
    [318, 262, 0.85], [432, 146, 1.0], [648, 132, 0.9], [864, 112, 0.82], [1122, 104, 0.88],
    [1382, 112, 0.95], [1624, 96, 0.9], [1862, 124, 1.0], [2104, 172, 0.9], [2286, 318, 0.95],
    [2342, 566, 1.0], [2368, 846, 0.85], [2312, 1196, 0.9], [2226, 1436, 1.0], [2058, 1578, 0.9],
    [1782, 1600, 0.85], [1518, 1610, 0.8], [1272, 1614, 0.8], [974, 1610, 0.9], [742, 1608, 0.85],
    [524, 1606, 0.9], [352, 1502, 0.8], [1486, 560, 0.62], [1560, 980, 0.7], [2050, 980, 0.72],
    [330, 1042, 0.6], [960, 250, 0.6], [1060, 246, 0.55], [1300, 1082, 0.6], [946, 1146, 0.6]
  ];
  const BUSHES = [
    [238, 618, 0.9], [252, 918, 0.8], [352, 1236, 0.85], [1024, 1252, 0.8], [1470, 1210, 0.8],
    [1960, 1180, 0.85], [2148, 620, 0.9], [1636, 260, 0.85], [842, 236, 0.8], [586, 226, 0.8],
    [1722, 962, 0.75], [860, 1078, 0.8], [1288, 700, 0.7], [1120, 780, 0.7], [232, 828, 0.7]
  ];
  const FLOWERS = [
    [300, 700, 0.9], [330, 742, 0.75], [268, 760, 0.8], [1080, 1452, 0.9], [1128, 1498, 0.8],
    [1236, 1494, 0.85], [1180, 1526, 0.75], [880, 640, 0.8], [1150, 640, 0.8], [1616, 806, 0.9],
    [1652, 842, 0.8], [2020, 1024, 0.85], [472, 1474, 0.8], [900, 1440, 0.8], [2140, 500, 0.8]
  ];
  const LAMPS = [
    [1108, 1128, 1.0], [1256, 1000, 1.0], [1006, 732, 0.9], [1288, 860, 0.85],
    [356, 1226, 0.85], [876, 1290, 0.85], [1646, 760, 0.85], [1904, 1002, 0.85],
    [1076, 1444, 0.9], [1300, 1430, 0.9], [1180, 1236, 0.8]
  ];
  const BENCHES = [[458, 1188, 0.9], [712, 1246, 0.85], [1146, 726, 0.8], [1520, 618, 0.8], [1888, 1120, 0.85]];
  const ROCKS = [[404, 986, 0.9], [560, 1102, 0.8], [1320, 966, 0.85], [1478, 1108, 0.9], [1980, 1116, 0.8], [880, 1118, 0.75]];
  const REEDS = [[300, 1002, 0.9], [332, 1012, 0.8], [1490, 1074, 0.9], [1524, 1086, 0.8], [2140, 1024, 0.9], [710, 1064, 0.85]];
  const BOATS = [[522, 1042, 1.0], [1668, 1054, 0.9]];

  function signSvg(x, y, label, bg, stroke, fg) {
    return `<g>
      <ellipse cx="${x}" cy="${y + 64}" rx="17" ry="5" fill="#3F5B45" opacity=".18"/>
      <rect x="${x - 7}" y="${y}" width="14" height="64" rx="6" fill="#B08A57"/>
      <rect x="${x - 84}" y="${y - 56}" width="168" height="46" rx="11" fill="${bg}" stroke="${stroke}" stroke-width="2.8"/>
      <rect x="${x - 77}" y="${y - 49}" width="154" height="32" rx="8" fill="#FFF" opacity=".38"/>
      <text x="${x}" y="${y - 25}" text-anchor="middle" font-size="21" font-weight="900" fill="${fg}" font-family="var(--font)">${label}</text>
    </g>`;
  }

  function svgUse(kind, x, y, s, extra) {
    const w = kind === "tree" || kind === "tree--warm" ? 64 : 56;
    const h = kind === "tree" || kind === "tree--warm" ? 84 : 44;
    return `<use href="#s-${kind}" x="${x - (w * s) / 2}" y="${y - h * s}" width="${w * s}" height="${h * s}" ${extra || ""}/>`;
  }

  function terrainSVG() {
    const zones = DISTRICTS.map((d) => {
      const z = d.zone;
      if (!z) return "";
      return `<ellipse cx="${z.cx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}" fill="${d.accent}" opacity=".05"/>
        <ellipse cx="${z.cx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}" fill="none" stroke="${d.accent}" stroke-opacity=".18"
          stroke-width="3.5" stroke-dasharray="22 24"/>`;
    }).join("");

    const roadSvg = ROADS.map((d) => `
      <path d="${d}" fill="none" stroke="#BFA87F" stroke-opacity=".5" stroke-width="58" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#E7D8B8" stroke-width="48" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#F6EBD4" stroke-width="34" stroke-linecap="round"/>
    `).join("");

    return `
    <defs>
      <linearGradient id="gGrass" x1="0" y1="0" x2="0.35" y2="1">
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
      <filter id="blur18" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18"/></filter>
      <filter id="blur40" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="40"/></filter>
      <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#4A3A26" flood-opacity=".28"/>
      </filter>
    </defs>

    <!-- 잔디 바탕 -->
    <rect width="${W.w}" height="${W.h}" fill="#7FA55C"/>
    <rect width="${W.w}" height="${W.h}" fill="url(#gGrass)"/>
    <rect width="${W.w}" height="${W.h}" fill="url(#pGrass)"/>

    <!-- 완만한 언덕 -->
    <ellipse cx="360" cy="150" rx="620" ry="330" fill="url(#gHill)" filter="url(#blur40)"/>
    <ellipse cx="2080" cy="230" rx="560" ry="300" fill="url(#gHill)" filter="url(#blur40)"/>
    <ellipse cx="2200" cy="1420" rx="520" ry="280" fill="url(#gHill)" filter="url(#blur40)"/>
    <ellipse cx="240" cy="1240" rx="420" ry="300" fill="url(#gHill)" filter="url(#blur40)"/>
    <ellipse cx="1200" cy="1590" rx="700" ry="220" fill="url(#gMeadow)" filter="url(#blur40)"/>
    <ellipse cx="1500" cy="700" rx="420" ry="300" fill="url(#gMeadow)" filter="url(#blur40)"/>

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

    <!-- 오솔길 -->
    ${roadSvg}

    <!-- 광장 -->
    <ellipse cx="1010" cy="608" rx="298" ry="150" fill="#6F8B4E" opacity=".22" filter="url(#blur18)"/>
    <ellipse cx="1010" cy="606" rx="244" ry="120" fill="url(#gPlaza)"/>
    <ellipse cx="1010" cy="606" rx="244" ry="120" fill="url(#pStone)" opacity=".42"/>
    <ellipse cx="1010" cy="606" rx="244" ry="120" fill="none" stroke="#BFA981" stroke-width="5"/>
    <ellipse cx="1010" cy="606" rx="204" ry="102" fill="none" stroke="#BFA981" stroke-opacity=".5" stroke-width="3" stroke-dasharray="14 16"/>

    <ellipse cx="592" cy="1326" rx="336" ry="152" fill="#6F8B4E" opacity=".22" filter="url(#blur18)"/>
    <ellipse cx="592" cy="1324" rx="338" ry="154" fill="url(#gPlaza)"/>
    <ellipse cx="592" cy="1324" rx="338" ry="154" fill="url(#pStone)" opacity=".4"/>
    <ellipse cx="592" cy="1324" rx="338" ry="154" fill="none" stroke="#BFA981" stroke-width="5"/>

    <ellipse cx="1180" cy="1508" rx="176" ry="82" fill="url(#gPlaza)" opacity=".92"/>
    <ellipse cx="1180" cy="1508" rx="176" ry="82" fill="url(#pStone)" opacity=".45"/>

    <ellipse cx="1830" cy="796" rx="300" ry="120" fill="#E9DCC2" opacity=".75" transform="rotate(-24 1830 796)"/>
    <ellipse cx="1830" cy="796" rx="300" ry="120" fill="url(#pStone)" opacity=".4" transform="rotate(-24 1830 796)"/>

    <ellipse cx="1740" cy="1348" rx="300" ry="156" fill="#B4CB86" opacity=".5"/>
    <g opacity=".28" stroke="#8AA75C" stroke-width="5" fill="none" stroke-linecap="round">
      <path d="M1490 1310 q 60 -14 120 0"/><path d="M1490 1352 q 60 -14 120 0"/><path d="M1490 1394 q 60 -14 120 0"/>
      <path d="M1730 1288 q 60 -14 120 0"/><path d="M1730 1330 q 60 -14 120 0"/><path d="M1730 1372 q 60 -14 120 0"/>
    </g>

    <!-- 다리 -->
    <g>
      <ellipse cx="1180" cy="1052" rx="124" ry="44" fill="#37503C" opacity=".3" filter="url(#blur18)"/>
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

    <!-- 입구 아치 -->
    <g>
      <ellipse cx="1180" cy="1570" rx="160" ry="26" fill="#37503C" opacity=".3" filter="url(#blur18)"/>
      <rect x="1064" y="1436" width="32" height="140" rx="14" fill="#D3B486"/>
      <rect x="1064" y="1436" width="11" height="140" rx="5" fill="#C6A575"/>
      <rect x="1264" y="1436" width="32" height="140" rx="14" fill="#D3B486"/>
      <rect x="1285" y="1436" width="11" height="140" rx="5" fill="#C6A575"/>
      <rect x="1050" y="1424" width="60" height="19" rx="9" fill="#E4CBA3"/>
      <rect x="1250" y="1424" width="60" height="19" rx="9" fill="#E4CBA3"/>
      <path d="M1080 1438 C1080 1374 1132 1352 1180 1352 C1228 1352 1280 1374 1280 1438 L1248 1438 C1248 1396 1218 1380 1180 1380 C1142 1380 1112 1396 1112 1438 Z" fill="#D9B98A"/>
      <path d="M1080 1438 C1080 1374 1132 1352 1180 1352 C1228 1352 1280 1374 1280 1438 L1248 1438 C1248 1396 1218 1380 1180 1380 C1142 1380 1112 1396 1112 1438 Z" fill="none" stroke="#B99567" stroke-width="4"/>
      <rect x="1116" y="1378" width="128" height="54" rx="13" fill="#FFF9EA" stroke="#B99567" stroke-width="4"/>
      <text x="1180" y="1402" text-anchor="middle" font-size="24" font-weight="900" fill="#7A5330" font-family="var(--font)">쿠사리 타운</text>
      <text x="1180" y="1421" text-anchor="middle" font-size="10.5" font-weight="800" letter-spacing="2.2" fill="#B08A57" font-family="var(--font)">KUSARI VILLAGE</text>
      <circle cx="1180" cy="1346" r="8.5" fill="#E4C48E" stroke="#B99567" stroke-width="3"/>
      <path d="M1180 1355 v-17" stroke="#B99567" stroke-width="3"/>
      <g opacity=".92">
        <path d="M1098 1352 l-26 24 26 4z" fill="#C97E52"/>
        <path d="M1262 1352 l26 24 -26 4z" fill="#C97E52"/>
      </g>
    </g>

    <!-- 지구 표지판 -->
    ${signSvg(1074, 952, "🧭 여행 지구", "#FBEFD8", "#C9AC80", "#8A6034")}
    ${signSvg(1600, 884, "📸 창작 골목", "#FBE9F0", "#D3A6BC", "#9C5C79")}
    ${signSvg(742, 1148, "🏛️ 업무 광장", "#E9F0E7", "#A3B9A5", "#4E6A58")}
    ${signSvg(1436, 1492, "🌱 새싹 개발지", "#F1F5DE", "#B4C68B", "#6A7A38")}

    <!-- 지구 표지판 글씨 크기 보정용 여백 -->
    <!-- 장식 -->
    ${TREES.map(([x, y, s]) => svgUse(x % 3 === 0 ? "tree--warm" : "tree", x, y, s)).join("")}
    ${BUSHES.map(([x, y, s]) => svgUse("bush", x, y, s)).join("")}
    ${FLOWERS.map(([x, y, s]) => svgUse("flower", x, y, s)).join("")}
    ${LAMPS.map(([x, y, s]) => svgUse("lamp", x, y, s)).join("")}
    ${BENCHES.map(([x, y, s]) => svgUse("bench", x, y, s)).join("")}
    ${ROCKS.map(([x, y, s]) => svgUse("rock", x, y, s)).join("")}
    ${REEDS.map(([x, y, s]) => svgUse("reed", x, y, s)).join("")}
    ${BOATS.map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s})"><use href="#s-boat" x="-40" y="-30" width="80" height="44"/></g>`).join("")}

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
      <button type="button" class="bld" data-id="${esc(site.id)}" data-tier="${tier}" data-hub="${hub}"
              style="--x:${p.x};--y:${p.y};--w:${w};z-index:${Math.round(p.y)}"
              aria-label="${esc(site.name)}. ${esc(role)}. 자세히 보기">
        <span class="bld__pad" aria-hidden="true"></span>
        <img class="bld__img" src="${esc(preset.img)}" alt="${esc(preset.name)} 건물 그림"
             width="${preset.w || 760}" height="${preset.h || 700}" decoding="async">
        ${isFav(site.id) ? '<span class="bld__fav" aria-hidden="true">★</span>' : ""}
        ${hub ? '<span class="bubble" data-hub-bubble></span>' : '<span class="bubble"></span>'}
        <span class="bld__plate">
          <span class="bld__tier">${tier === 1 ? "1단계" : "2단계"}</span>
          <span class="bld__name">${esc(site.name)}</span>
          <span class="bld__role">${esc(role)}</span>
        </span>
      </button>`;
  }

  function addPlotHtml(d) {
    const z = d.zone || { cx: W.w / 2, cy: W.h / 2 };
    const spots = (d.slots || []).slice(0, 2);
    return spots.map(([x, y], i) => `
      <button type="button" class="bld bld--plot" data-add="${esc(d.id)}" data-tier="1"
              style="--x:${x};--y:${y};--w:170;z-index:${Math.round(y)}"
              aria-label="${esc(d.name)} 빈 부지에 새 건물 입주">
        <span class="plotpad" aria-hidden="true"><b>＋</b><em>새 부지 ${i + 1}</em></span>
        <span class="bld__plate bld__plate--plot">
          <span class="bld__name">새 건물 입주</span>
          <span class="bld__role">눌러서 이 자리에</span>
        </span>
      </button>`).join("");
  }

  function renderWorld() {
    bldsEl.innerHTML = allSites().map(bldHtml).join("") + addPlotHtml(districtOf("sprout"));
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
      if (dragMoved > 6) return;
      const add = e.target.closest("[data-add]");
      if (add) { stopTour(); openForm("add", null, add.dataset.add); return; }
      const b = e.target.closest(".bld[data-id]");
      if (!b) return;
      if (state.mode === "walk") {
        const site = siteById(b.dataset.id);
        if (site) openDetail(site.id);
        return;
      }
      openDetail(b.dataset.id);
    };
    bldsEl.onkeydown = (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const b = e.target.closest(".bld[data-id]");
      if (b && e.target === b) { e.preventDefault(); openDetail(b.dataset.id); }
    };
  }

  /* ── 상단 요약 · 지구 칩 ──────────────────────────────── */
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
  }

  function renderDistrictChips() {
    const nav = $("#districtChips");
    if (!nav) return;
    nav.innerHTML = DISTRICTS.map((d) => {
      const n = allSites().filter((s) => s.district === d.id).length;
      const short = esc(d.name.replace(" 지구", "").replace(" 골목", "").replace(" 광장", "").replace(" 개발지", ""));
      return `<button type="button" class="hud__chip" data-district="${esc(d.id)}">
        <span aria-hidden="true">${d.emoji}</span><span class="hud__long">${esc(d.name)}</span><span class="hud__short">${short}</span> <b>${n}</b></button>`;
    }).join("") + `<span class="hud__depth" title="1단계 본부 아래에 2단계 사이트가 매달립니다"><i>2</i> 별관은 본부에 연결</span>`;

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

  /* ── 테마 ─────────────────────────────────────────────── */
  function applyTheme(t, persist) {
    const theme = t === "sunset" ? "sunset" : "day";
    document.documentElement.dataset.theme = theme;
    const ico = $("#themeIco"), lab = $("#themeLabel"), btn = $("#themeBtn");
    if (ico) ico.textContent = theme === "sunset" ? "🌅" : "☀️";
    if (lab) lab.textContent = theme === "sunset" ? "노을" : "낮";
    if (btn) {
      btn.setAttribute("aria-pressed", String(theme === "sunset"));
      btn.setAttribute("aria-label", theme === "sunset" ? "낮으로 바꾸기" : "노을로 바꾸기");
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "sunset" ? "#2B2337" : "#EFE3CD");
    if (persist) write(KEY.theme, theme);
  }
  applyTheme(read(KEY.theme, null) || read(KEY.v1theme, null) || "day", false);
  if ($("#themeBtn")) {
    $("#themeBtn").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "sunset" ? "day" : "sunset";
      applyTheme(next, true);
      toast(next === "sunset" ? "🌅 노을이 내려앉았어요 — 가로등에 불이 켜집니다" : "☀️ 맑은 낮이에요");
    });
  }

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
        <span class="tree__role">2단계 · ${esc(roleOf(child))}</span>
      </span>
      <span class="tree__acts">
        <a class="tree__open" href="${esc(child.url)}" target="_blank" rel="noopener" aria-label="${esc(child.name)} 열기">열기 ↗</a>
        <button type="button" class="tree__open" data-open="${esc(child.id)}">자세히</button>
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
              <span class="tierbadge">1단계 · 본부</span>
              <h3 class="card__name" style="margin-top:5px">${esc(hub.name)}</h3>
            </div>
            <button type="button" class="card__star${fav ? " is-on" : ""}" data-fav="${esc(hub.id)}" aria-pressed="${fav}" aria-label="${esc(hub.name)} 즐겨찾기">★</button>
          </div>
          <span class="card__dist" style="color:${d.accent}"><i></i>${d.emoji} ${esc(d.name)}</span>
          <p class="card__desc">${esc(hub.desc || "아직 소개 글이 없어요.")}</p>
          <div class="card__foot">
            <a class="card__open" href="${esc(hub.url)}" target="_blank" rel="noopener">열기 ↗</a>
            ${repo ? `<a class="card__repo" href="${esc(repo)}" target="_blank" rel="noopener" aria-label="GitHub 저장소">${GH_ICON}</a>` : ""}
            <button type="button" class="card__more" data-open="${esc(hub.id)}">자세히</button>
          </div>
        </div>
        ${showTree ? `<div class="tree">
          <button type="button" class="tree__head" data-fold-tree aria-expanded="true">
            <span class="tree__mark">└─</span> 연결된 하위 사이트
            <span class="tree__count">2단계 ${allKids.length}</span>
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
              <span class="tierbadge${site.tier === 2 ? " tierbadge--2" : ""}">${site.tier === 2 ? "2단계 · 별관" : "1단계 · 독립"}</span>
              <h3 class="card__name" style="margin-top:5px">${esc(site.name)}</h3>
            </div>
            <button type="button" class="card__star${fav ? " is-on" : ""}" data-fav="${esc(site.id)}" aria-pressed="${fav}" aria-label="${esc(site.name)} 즐겨찾기">★</button>
          </div>
          <span class="card__dist" style="color:${d.accent}"><i></i>${d.emoji} ${esc(d.name)}</span>
          ${parent ? `<span class="card__parentlink" style="margin-top:4px">⬆️ ${esc(parent.name)}</span>` : ""}
          <p class="card__desc">${esc(site.desc || "아직 소개 글이 없어요.")}</p>
          <div class="card__foot">
            <a class="card__open" href="${esc(site.url)}" target="_blank" rel="noopener">열기 ↗</a>
            ${repo ? `<a class="card__repo" href="${esc(repo)}" target="_blank" rel="noopener" aria-label="GitHub 저장소">${GH_ICON}</a>` : ""}
            <button type="button" class="card__more" data-open="${esc(site.id)}">자세히</button>
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
        <p class="depthbox__title">🔗 연결된 하위 사이트 <span class="depthbox__count">2단계 ${kids.length}</span></p>
        <ul class="depthbox__list">
          ${kids.map((k, i) => {
            const kp = presetOf(k.building);
            return `<li class="depthbox__item">
              <span class="depthbox__branch" aria-hidden="true">${i === kids.length - 1 ? "└─" : "├─"}</span>
              <span class="depthbox__thumb"><img src="${esc(kp.img)}" alt="" width="30" height="30" loading="lazy"></span>
              <button type="button" class="depthbox__name" data-goto="${esc(k.id)}">${esc(k.name)}<span class="depthbox__role">${esc(roleOf(k))}</span></button>
              <a class="depthbox__open" href="${esc(k.url)}" target="_blank" rel="noopener">열기 ↗</a>
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
            <span class="tierbadge">1단계 본부</span>
            <b>${esc(parent.name)}</b>
            <span class="arrow">→</span>
          </button>
        </div>`;
      }
    }
    return `<div class="depthbox">
      <p class="depthbox__title">🌿 1단계 · 독립 사이트</p>
      <p style="margin:0;font-size:11.5px;line-height:1.6;color:var(--ink-soft)">다른 본부에 매달리지 않고 홀로 서는 사이트예요. 이 건물을 본부로 삼아 2단계 사이트를 이어 붙일 수 있습니다.</p>
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
    $("#detailTier").textContent = site.tier === 2 ? "2단계 · 별관" : (isHub(site) ? "1단계 · 본부" : "1단계 · 독립");
    $("#detailTier").style.background = site.tier === 2 ? "var(--t2)" : "var(--t1)";
    $("#detailPin").hidden = !fav;
    $("#detailBuilding").textContent = preset.name + " · " + preset.en;
    $("#detailTitle").textContent = site.name;
    $("#detailDesc").textContent = site.desc || "아직 소개 글이 없어요. 정보를 수정해 한 줄 소개를 남겨 보세요.";
    $("#detailTags").innerHTML = (site.tags || []).map((t, i) => `<li><span class="tag${i % 2 ? " tag--soft" : ""}">${esc(t)}</span></li>`).join("");
    $("#detailDepth").innerHTML = depthBoxHtml(site);
    $("#detailUrl").textContent = shortUrl(site.url);
    $("#detailUrl").href = site.url;
    $("#detailOpen").href = site.url;

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
      if (tier === 2 && !parent) { inValidate("2단계로 입주하려면 상위 본부를 골라 주세요."); return; }
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
          w: tier === 2 ? 200 : 275,
          role: tier === 2
            ? "2단계 · " + (siteById(parent) ? siteById(parent).name : "본부") + " 하위"
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
    toast("📋 사이트 " + sites.length + "곳(1단계 " + payload.tier1 + " · 2단계 " + payload.tier2 + ")을 JSON으로 내보냈어요");
  }
  if ($("#exportBtn")) $("#exportBtn").addEventListener("click", exportJson);
  if ($("#formExportBtn")) $("#formExportBtn").addEventListener("click", exportJson);

  /* ── 자동 투어 ────────────────────────────────────────── */
  const tourCap = $("#tourCap");

  function tourStops() {
    const stops = [{
      key: "entrance", cx: 1180, cy: 1400, s: 0.95,
      title: "마을 입구", desc: "어서 오세요, 쿠사리 타운입니다. 강을 건너 오솔길을 따라 여행 지구 본부로 올라가 볼까요?"
    }];
    const order = ["travel", "creative", "work", "sprout"];
    order.forEach((did) => {
      allSites().filter((s) => s.district === did && s.tier !== 2).forEach((hub) => {
        const kids = childrenOf(hub.id);
        stops.push({
          key: hub.id, site: hub, s: kids.length ? 0.82 : 0.95,
          title: hub.name,
          desc: (kids.length ? "1단계 본부 · 하위 " + kids.length + "개 연결 — " : "1단계 독립 사이트 — ") + (hub.desc || roleOf(hub))
        });
        kids.forEach((k) => stops.push({
          key: k.id, site: k, s: 1.02,
          title: k.name,
          desc: "2단계 · " + hub.name + "에서 이어진 별관 — " + (k.desc || roleOf(k))
        }));
      });
    });
    stops.push({ key: "overview", cx: W.w / 2, cy: W.h / 2, s: fitScale(), title: "마을 한 바퀴 완료", desc: "1단계 5곳과 2단계 4곳, 모두 둘러봤어요. 미니맵이나 지구 칩으로 원하는 곳을 다시 찾아가세요." });
    return stops;
  }

  function siteFocus(site, s) {
    const p = sitePos(site);
    const preset = presetOf(site.building);
    const w = widthOf(site);
    const h = (w * (preset.h || 700)) / (preset.w || 760);
    const cy = Math.max(330, p.y - h * 0.52);
    return { cx: p.x, cy, s: s || (site.tier === 2 ? 1.0 : 0.9) };
  }
  function focusSite(site, dur) {
    const f = siteFocus(site);
    panTo(f.cx, f.cy, dZoom(f.s), dur == null ? 900 : dur);
  }

  function showBubble(siteId, text) {
    $$(".bld--tour").forEach((el) => el.classList.remove("bld--tour"));
    const el = bldsEl.querySelector('.bld[data-id="' + siteId + '"]');
    if (!el) return;
    const b = $(".bubble", el);
    if (b) b.textContent = text;
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

    if (st.site) {
      const f = siteFocus(st.site);
      panTo(f.cx, f.cy, dZoom(f.s), 1200);
      showBubble(st.site.id, st.site.tier === 2 ? "2단계 · 별관" : (isHub(st.site) ? "1단계 · 본부 · 하위 " + childrenOf(st.site.id).length + "개" : "1단계 · 독립 사이트"));
      const openBtn = $("#tourOpen");
      openBtn.style.display = "";
      openBtn.onclick = () => window.open(st.site.url, "_blank", "noopener");
    } else {
      $$(".bld--tour").forEach((el) => el.classList.remove("bld--tour"));
      panTo(st.cx, st.cy, dZoom(st.s), 1300);
      $("#tourOpen").style.display = "none";
    }
    const dwell = st.site ? (st.site.tier === 2 ? 2800 : 3600) : 3400;
    state.tour.timer = setTimeout(nextTourStep, dwell);
  }

  function stopTour(finished) {
    if (!state.tour.on) return;
    state.tour.on = false;
    clearTimeout(state.tour.timer);
    tourCap.hidden = true;
    $$(".bld--tour").forEach((el) => el.classList.remove("bld--tour"));
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

  /* ── 걷기 모드 ────────────────────────────────────────── */
  const avatar = $("#avatar");
  const keys = new Set();
  function enterWalk() {
    stopTour();
    if (state.view !== "map") setView("map", true);
    state.mode = "walk";
    document.body.dataset.mode = "walk";
    stage.classList.add("is-walk");
    state.walk.x = 1180; state.walk.y = 1300;
    state.walk.target = null;
    state.walk.vx = 0; state.walk.vy = 0;
    $("#walkBtn").setAttribute("aria-pressed", "true");
    $("#walkHint").hidden = false;
    $("#joy").hidden = false;
    $("#coach").hidden = true;
    panTo(1180, 1240, dZoom(1.08), 800);
    
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
  if ($("#walkEnterBtn")) $("#walkEnterBtn").addEventListener("click", () => { if (state.nearId) openDetail(state.nearId); });

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
      if (e.key === "Enter" && state.nearId) { e.preventDefault(); openDetail(state.nearId); return; }
      if (KEYMAP[e.key]) { keys.add(e.key); e.preventDefault(); state.walk.target = null; return; }
    } else {
      if (e.key === "+" || e.key === "=") { zoomBy(1.25); return; }
      if (e.key === "-") { zoomBy(0.8); return; }
      if (e.key === "0") { panTo(W.w / 2, W.h / 2, fitScale(), 700); return; }
      if (e.key === "t" || e.key === "T") { if (state.tour.on) stopTour(); else startTour(); return; }
      if (e.key === "w" || e.key === "W") { enterWalk(); return; }
    }
  });
  document.addEventListener("keyup", (e) => { if (KEYMAP[e.key]) keys.delete(e.key); });
  window.addEventListener("blur", () => keys.clear());

  function zoomBy(f) {
    stopTourIfUser();
    const s = clamp(state.cam.s * f, minScale, 2.6);
    panTo(state.cam.cx, state.cam.cy, s, 240);
  }
  if ($("#zoomIn")) $("#zoomIn").addEventListener("click", () => zoomBy(1.3));
  if ($("#zoomOut")) $("#zoomOut").addEventListener("click", () => zoomBy(1 / 1.3));
  if ($("#zoomFit")) $("#zoomFit").addEventListener("click", () => {
    stopTourIfUser();
    if (isNarrow()) panTo(W.w / 2, W.h / 2, fitScale(), 760);
    else panTo(W.w / 2, W.h / 2, fitScale(), 760);
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
    if (state.mode === "walk") {
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
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ── 첫 방문 안내 ─────────────────────────────────────── */
  function hideCoach() { const c = $("#coach"); if (c) c.hidden = true; }
  (function coach() {
    if (read(KEY.coach, false)) return;
    if (state.view !== "map") return;
    setTimeout(() => {
      if (anyModalOpen() || state.tour.on || state.mode === "walk") return;
      const c = $("#coach"); if (c) c.hidden = false;
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
  setView(read(KEY.view, "map") === "deck" ? "deck" : "map", false);
  if (location.hash === "#work") setView("deck", false);

  /* QA 훅 */
  window.__KV = {
    state, sites: allSites, focusSite, startTour, stopTour, enterWalk, exitWalk,
    setView, openDetail, openForm, panTo, applyCam,
    get cam() { return state.cam; },
    get tour() { return state.tour; }
  };
})();
