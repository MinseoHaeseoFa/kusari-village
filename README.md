# 🏡 쿠사리 타운 v3 (Kusari Village) — 풀스크린 2.5D 마을 · Depth 계층

쿠사리님이 만든 웹앱 9곳이 **하나의 연속된 2.5D 마을**에 모여 사는 정적 웹앱입니다.
빌드 도구·CDN·외부 라이브러리 없이 `index.html` 하나로 열립니다.

- **초록 마을 지도가 브라우저 화면을 가득 채우는 배경**입니다. 베이지색 판·테두리·바깥 여백 없이 `100vw × 100dvh` 전체가 마을이고,
  헤더·지구 칩·조작 도크·미니맵은 그 위에 떠 있는 플로팅 UI입니다. 줌·이동을 어디까지 해도 지도 밖 배경이 드러나지 않습니다(cover 클램핑).
- **건물을 누르면 설명 모달 없이 그 사이트로 바로 이동**합니다(같은 탭). 손가락으로 끌어 지도를 옮긴 직후의 손 떼임은 클릭으로 보지 않습니다.
- **1단계(본부·독립 사이트) 5곳**과 **2단계(본부 하위 별관) 4곳**의 계층을 지도·목록·상세에서 모두 드러냅니다.
- 강과 다리, 오솔길, 잔디, 가로수, 꽃밭이 이어진 한 장의 마을 지도 위에서 **끌어서 이동 / 확대·축소 / 자동 투어 / 직접 걷기 / 낮·노을**을 즐길 수 있습니다.
- 클레이 미니어처 건물 12종을 투명 배경 WebP로 얹었습니다.

## 바로 열기

```
kusari-village/index.html
```

로컬에서 더블클릭해도 되고, 폴더를 통째로 Vercel·GitHub Pages·Netlify에 올려도 그대로 동작합니다.

## 구성

```
kusari-village/
├─ index.html                     마을(풀스크린) + 앱 덱 + 상세/입주 시트
├─ data/sites.js                  ★ 입주 명단·좌표·계층(tier/parent)
├─ assets/
│  ├─ css/style.css               전체 스타일 (낮 / 노을 토큰, 2.5D 지도, 반응형)
│  ├─ js/app.js                   카메라·지도 렌더·투어·걷기·계층·저장 로직
│  ├─ buildings/                  건물 그림 12종 (투명 배경 WebP)
│  │  └─ raw/                     원본(크림 배경) — 재가공용, 사이트에서는 미사용
└─ README.md
```

## 화면

### 1) 마을 지도 (풀스크린)

| 조작 | 방법 |
| --- | --- |
| 사이트 열기 | **건물(또는 명패)을 누르면 그 사이트로 바로 이동** (같은 탭) |
| 이동 | 마우스·손가락으로 끌기 |
| 확대·축소 | 도크의 `＋`/`−`, 마우스 휠, 모바일 두 손가락 |
| 화면 채우기 | 도크의 `⌂` — 지도가 화면을 덮는 최소 배율(cover)까지 물러납니다 |
| 구역 이동 | 상단 지구 칩, 우측 하단 **미니맵**(건물 점·약도 클릭) |
| 자동 투어 | 도크 `▶ 자동 투어` — 입구 → 여행 본부 → 별관 4곳 → 창작 골목 → 업무 광장 → 화면 채우기 (11단계, 언제든 정지) |
| 직접 걷기 | 도크 `🚶 직접 걷기` — 방향키·WASD, 모바일은 조이스틱·화면 탭. 건물 앞에서 `Enter` 또는 **들어가기** 버튼 = 그 사이트로 이동 |
| 낮 / 노을 | 도크 `☀️ 낮` ↔ `🌅 노을` — 지도 전체에 노을 틴트·지는 해·반딧불·미니맵 톤까지 함께 전환 (설정 유지) |

### 2) 앱 덱 (`#work`, 🎴 탭)

- `1단계 5장` 카드 + `나의 여행 지도` 카드 안의 `└─ 연결된 하위 사이트 2단계 4` 트리(접기/펼치기).
- 카드의 `열기 ↗`·하위 사이트 `열기 ↗` 는 **모두 같은 탭(_self)** 에서 열립니다.
- 소개·GitHub·즐겨찾기·계층(상하위)을 보려면 카드의 작은 **`ℹ️ 정보`** 버튼을 누릅니다.
  상세 시트의 `🚀 사이트 열기` 도 같은 탭에서 이동합니다(GitHub 저장소만 새 탭).

### 3) Depth(계층) 표현

- **1단계** 건물은 큰 부지·큰 스케일(340 / 290px)과 굵은 명패(`1단계` + `여행 지구 본부 · 하위 4개 연결`)로 섭니다.
- **2단계** 별관은 한 단계 작은 스케일(205px)로 본부 주변에 배치하고, **점선 오솔길 + 흐르는 방향 점**으로 본부와 직접 연결합니다. 명패도 점선 테두리·`2단계` 칩으로 구분됩니다.
- 상세 시트에서는 본부의 `🔗 연결된 하위 사이트` 목록, 별관의 `⬆️ 상위 허브` 배지를 볼 수 있습니다.

### 4) 새 건물 입주

1. 상단 `＋ 새 건물 입주`(또는 새싹 개발지의 `새 부지`)를 누릅니다.
2. **사이트 계층**을 고릅니다.
   - `1단계 · 독립 사이트` → 지구를 골라 큰 부지에 입주 (나중에 이 건물을 본부로 삼을 수 있습니다)
   - `2단계 · 본부 하위 연결` → **상위 본부**를 고르면 본부 옆 빈 위성 부지에 **연결선과 함께 자동 배치**됩니다
3. 이름·주소·소개·태그와 건물 모양(12종)을 고르고 `입주시키기`.

새로 입주한 건물은 브라우저 `localStorage` 에 보관되고 앱 덱에도 카드가 생깁니다(정보 → `✏️ 정보 수정` / `🗑 철거`).
`[📋 JSON 내보내기]` 로 전체 명단(계층·좌표 포함)을 백업할 수 있습니다.

## 기본 입주 명단 (data/sites.js)

| 계층 | 사이트 | 건물 | 주소 |
| --- | --- | --- | --- |
| 1단계 · 여행 지구 본부 | 나의 여행 지도 | travel-hub | https://my-travel-map-kohl.vercel.app/ |
| 2단계 · 본부 별관 | 대한민국 Trail Log | hanok | https://korea-travel-map-ebon.vercel.app/ |
| 2단계 · 본부 별관 | 세계 여행 Trail Log | lighthouse | https://world-travel-map-blush.vercel.app/ |
| 2단계 · 본부 별관 | 100대 명산 Trail Log | lodge | https://mountain-travel-map.vercel.app/ |
| 2단계 · 본부 별관 | 나의 여행 플래너 | train-station | https://my-travel-planner-kohl.vercel.app/ |
| 1단계 · 창작 골목 | 인생이라는 필름 | film-lab | https://life-film-photo-guide.vercel.app/ |
| 1단계 · 창작 골목 | 나만의 프롬프트 스튜디오 | atelier | https://my-prompt-studio-mu.vercel.app/ |
| 1단계 · 업무 광장 | 감사 그레이존 사례 DB | library | https://audit-grayzone-db.vercel.app/ |
| 1단계 · 업무 광장 | KITECH-Audit 포털 | archive-hall | https://kitech-audit.vercel.app/ |

### 한 줄 추가하기

`data/sites.js` 의 `sites` 배열에 넣으면 코드 수정 없이 마을에 세워집니다.

```js
{ id: "my-new-app", name: "나의 새 앱", url: "https://my-new-app.vercel.app/", repo: "my-new-app",
  district: "creative", building: "cafe", tier: 1, parent: null, pos: [1700, 980],
  role: "창작 골목 · 독립 사이트", desc: "한 줄 소개", tags: ["태그1", "태그2"] },
```

- `tier` : `1`(독립·본부) / `2`(본부 하위) · `parent` : `tier: 2` 일 때 상위 본부의 `id`
- `pos` : 마을 지도(2400 × 1660) 위 발밑 좌표 `[x, y]` — 생략하면 빈 부지에 자동 배치
- `district` : `travel` · `creative` · `work` · `sprout`
- `building` : `travel-hub` `hanok` `lighthouse` `lodge` `train-station` `film-lab` `atelier` `library` `archive-hall` `cafe` `greenhouse` `observatory`
- `repo` : GitHub 저장소 이름 (`MinseoHaeseoFa/<repo>`) 또는 전체 URL

## 저장 키

| 키 | 내용 |
| --- | --- |
| `kusari-village:v2:custom-sites` | 화면에서 입주시킨 건물 (계층·좌표 포함) |
| `kusari-village:v2:favorites` | 즐겨찾기 핀 |
| `kusari-village:v2:theme` | `day` / `sunset` |
| `kusari-village:v2:view` | `map` / `deck` |
| `kusari-village:v2:coach-seen` | 첫 방문 안내 확인 여부 |

키 이름은 v2 그대로입니다 — v3 로 올려도 이미 입주시킨 건물·즐겨찾기·테마가 그대로 이어집니다.
(v1 `kusari-village:v1:*` 데이터도 계속 자동 이어받습니다.)

## v3 에서 고친 것 — 안드로이드 흰/베이지 사각형 깜빡임

모바일 크롬(안드로이드) GPU 합성에서 사각형 타일이 남던 원인을 지도 레이어 구조에서 제거했습니다.

- `world` 레이어의 `will-change:transform`, `border-radius:88px`, `overflow:hidden`, 큰 `box-shadow` 제거 → 지도는 화면을 덮는 단순 변환 레이어
- 지도 레이어 안의 `filter / backdrop-filter / mix-blend-mode / will-change` **전부 제거**
  - 건물 그림 `drop-shadow`, 노을 `sepia(...)` 월드 필터, 유리 효과(`backdrop-filter`) → 반투명 틴트·그림자 요소로 대체
  - 지형 SVG의 `feGaussianBlur` 필터 → 부드러운 방사형 라디안 그라디언트로 교체
- 명패·말풍선의 **역스케일(`scale(1/zoom)`) 별도 합성 레이어 제거** — 지도 좌표계 크기로 그려 한 레이어에서 함께 라스터화
- 카메라 이동 때마다 CSS 변수(`--inv`)를 다시 쓰던 매 프레임 스타일 무효화 제거, `data-zoom` 속성도 값이 바뀔 때만 갱신
- 최대 확대 2.0배로 제한해 거대 텍스처 타일링 부담 축소, 최소 배율은 cover 로 고정

## 접근성·성능

- 모든 건물은 `<button>` 이며 `Enter`/`Space` 로 그 사이트로 이동합니다. 모달은 포커스 트랩·`Esc` 닫기를 지원합니다.
- `prefers-reduced-motion` 에서 애니메이션을 끕니다.
- 이미지 12종 모두 `decoding="async"`. 외부 요청 0건(폰트 포함 시스템 폰트).

## 검수 (v3)

Playwright(Chromium)로 PC **1440×900** · 모바일 **390×844**(Android UA, DPR 2)에서 확인했습니다.

| 항목 | 결과 |
| --- | --- |
| 풀스크린 초록 배경 (낮·노을·확대·이동·최소 배율) | 지도가 매 상태에서 화면을 완전히 덮음 · 가로 오버플로 0px |
| 지도 레이어 위험 속성 | `filter` / `backdrop-filter` / `mix-blend-mode` / `will-change` **0건**, 지형 SVG 필터 **0건** |
| 건물 이미지 | 9/9 로드, 깨진 이미지 0 |
| 건물 클릭 | 같은 탭 이동 확인(`location.href` → 사이트 URL, 탭 1개 유지), 끌기 후 손 떼임은 이동 안 함 |
| 앱 덱 링크 | 사이트·하위 4개 링크에 `target` 없음(_self), `ℹ️ 정보` 버튼 5개 유지 |
| 상세 시트 · 입주 폼 · 빈 부지 · 자동 투어 · 걷기 · 낮↔노을 | 정상 동작 |
| 콘솔 에러 · 4xx/5xx 응답 | 0건 |

스크린샷과 상세 리포트는 `downloads/kusari-village-v3-qa/` 에 있습니다.
(`qa-report.json`, `desktop-01~11-*.png`, `mobile-01~14-*.png`)
