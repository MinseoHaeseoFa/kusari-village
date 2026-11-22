# 🏡 쿠사리 타운 v2 (Kusari Village) — 2.5D 마을 · Depth 계층

쿠사리님이 만든 웹앱 9곳이 **하나의 연속된 2.5D 마을**에 모여 사는 정적 웹앱입니다.
빌드 도구·CDN·외부 라이브러리 없이 `index.html` 하나로 열립니다.

- **1단계(본부·독립 사이트) 5곳**과 **2단계(본부 하위 별관) 4곳**의 계층을 지도·목록·상세에서 모두 드러냅니다.
- 강과 다리, 오솔길, 잔디, 가로수, 꽃밭이 이어진 한 장의 마을 지도 위에서 **끌어서 이동 / 확대·축소 / 자동 투어 / 직접 걷기 / 낮·노을**을 즐길 수 있습니다.
- 기존 클레이 미니어처 건물 12종을 그대로 사용하며, 배경을 투명하게 다듬어 마을 잔디·광장 위에 자연스럽게 얹었습니다.

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
| 이동 | 마우스·손가락으로 끌기 (확대 상태에서) |
| 확대·축소 | 도크의 `＋`/`−`, 마우스 휠, 모바일 두 손가락 |
| 전체 보기 | 도크의 `⌂` |
| 구역 이동 | 상단 지구 칩, 우측 하단 **미니맵**(건물 점·약도 클릭) |
| 자동 투어 | 도크 `▶ 자동 투어` — 입구 → 여행 본부 → 별관 4곳 → 창작 골목 → 업무 광장 → 전체 보기 (11단계, 언제든 정지) |
| 직접 걷기 | 도크 `🚶 직접 걷기` — 방향키·WASD, 모바일은 조이스틱·화면 탭. 건물 앞에서 `Enter` 또는 **들어가기** 버튼 |
| 낮 / 노을 | 도크 `☀️ 낮` ↔ `🌅 노을` — 하늘·지는 해·가로등 불빛·반딧불 분위기 전환 (설정 유지) |

### 2) Depth(계층) 표현

- **1단계** 건물은 큰 부지·큰 스케일(340 / 290px)과 굵은 명패(`1단계` + `여행 지구 본부 · 하위 4개 연결`)로 섭니다.
- **2단계** 별관은 한 단계 작은 스케일(205px)로 본부 주변에 배치하고, **점선 오솔길 + 흐르는 방향 점**으로 본부와 직접 연결합니다. 명패도 점선 테두리·`2단계` 칩으로 구분됩니다.
- **건물 상세**
  - 본부를 열면 `🔗 연결된 하위 사이트 (2단계 4)` 목록에서 바로 이동·열기
  - 별관을 열면 `⬆️ 상위 허브: 나의 여행 지도` 배지에서 본부로 복귀
- **앱 덱(`#work`)** — 대등한 9개 나열이 아니라 `1단계 5장` 카드 + `나의 여행 지도` 카드 안의 `└─ 연결된 하위 사이트 2단계 4` 트리(접기/펼치기).

### 3) 새 건물 입주

1. 상단 `＋ 새 건물 입주`(또는 새싹 개발지의 `새 부지`)를 누릅니다.
2. **사이트 계층**을 고릅니다.
   - `1단계 · 독립 사이트` → 지구를 골라 큰 부지에 입주 (나중에 이 건물을 본부로 삼을 수 있습니다)
   - `2단계 · 본부 하위 연결` → **상위 본부**를 고르면 본부 옆 빈 위성 부지에 **연결선과 함께 자동 배치**됩니다
3. 이름·주소·소개·태그와 건물 모양(12종)을 고르고 `입주시키기`.

새로 입주한 건물은 브라우저 `localStorage` 에 보관됩니다. `[📋 JSON 내보내기]` 로 전체 명단(계층·좌표 포함)을 백업할 수 있습니다.

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

v1(`kusari-village:v1:*`) 데이터가 있으면 새로 입주시킨 건물과 즐겨찾기·테마를 자동으로 이어받습니다.

## 접근성·성능

- 모든 건물은 `<button>` 이며 `Enter`/`Space` 로 열립니다. 모달은 포커스 트랩·`Esc` 닫기를 지원합니다.
- `prefers-reduced-motion` 에서 애니메이션을 끕니다.
- 이미지 12종 모두 `decoding="async"`, 필요 시점 로딩. 외부 요청 0건(폰트 포함 시스템 폰트).

## 검수

Playwright로 PC(1440×900)·모바일(390×844)에서 **49개 항목**을 확인했습니다.
지도 렌더·드래그·휠/버튼 줌·미니맵 이동·자동 투어 시작/전환/정지·걷기 이동/건물 진입·낮↔노을·
1단계/2단계 크기·연결선·상세 상하위 링크·덱 트리(├─/└─)·2단계 신규 입주 자동 배치·
건물/빈 부지 실제 클릭(끌기 후 오작동 없음)·JSON 내보내기·
콘솔 에러 0·이미지 100% 로드·가로 오버플로우 0.

결과와 스크린샷은 `downloads/kusari-village-v2-qa/` 에 있습니다.
(`pc-map.png` `pc-sunset-tour.png` `pc-work-hierarchy.png` `pc-tour.png` `pc-walk.png`
`pc-detail-hub.png` `pc-detail-child.png` `pc-add-tier2.png` `mobile-map.png` `mobile-tour.png`
`mobile-walk.png` `mobile-deck.png` `qa-report.json` `exported-sites.json`)
