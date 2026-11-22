# 🏡 쿠사리 타운 (Kusari Village)

쿠사리님이 만든 웹앱들을 한눈에 모아보고, 앞으로 늘어나는 사이트도 쉽게 입주시킬 수 있는 정적 웹앱입니다.
빌드 도구·CDN·외부 라이브러리 없이 `index.html` 하나로 열립니다.

## 바로 열기

```
kusari-village/index.html
```

로컬에서 그냥 더블클릭해도 되고, 폴더를 통째로 Vercel·GitHub Pages·Netlify에 올려도 그대로 동작합니다.

## 구성

```
kusari-village/
├─ index.html                     마을 화면
├─ data/sites.js                  ★ 기본 입주 명단 (여기 한 줄만 추가)
├─ assets/
│  ├─ css/style.css               전체 스타일 (낮 / 노을 테마 토큰 포함)
│  ├─ js/app.js                   마을 지도·앱 덱·모달·저장 로직
│  └─ buildings/                  건물 일러스트 12종 (WebP, 약 640KB)
└─ README.md
```

## 새 사이트를 기본 명단에 추가하기

`data/sites.js` 의 `sites` 배열에 한 줄만 넣으면 코드 수정 없이 마을에 세워집니다.

```js
{ id: "my-new-app", name: "나의 새 앱", url: "https://my-new-app.vercel.app/", repo: "my-new-app",
  district: "creative", building: "cafe", desc: "한 줄 소개", tags: ["태그1", "태그2"] },
```

- `district` : `travel`(여행 지구) · `creative`(창작 골목) · `work`(업무·리서치 광장) · `sprout`(새싹 개발지)
- `building` : `travel-hub` `hanok` `lighthouse` `lodge` `train-station` `film-lab` `atelier` `library` `archive-hall` `cafe` `greenhouse` `observatory`
- `repo` : GitHub 저장소 이름 (`MinseoHaeseoFa/<repo>` 로 연결) 또는 전체 URL

## 화면에서 바로 입주시키기

1. 오른쪽 위 **＋ 새 건물 입주** 를 누릅니다.
2. 이름·주소·한 줄 소개·태그를 적고, 지구와 건물 모양(12종)을 고릅니다.
3. **입주시키기** 를 누르면 마을 지도와 앱 덱에 즉시 반영됩니다.

이렇게 추가한 건물은 브라우저 `localStorage` 에 보관되어 다시 열어도 남아 있습니다.
`[📋 JSON 내보내기]` 로 전체 명단(기본 + 새로 입주한 건물)을 내려받아 백업하거나
`data/sites.js` 로 옮겨 기본 명단에 편입시킬 수 있습니다.

## 기능

- **마을 지도** : 4개 지구(여행 지구 · 창작 골목 · 업무·리서치 광장 · 새싹 개발지)에 건물 타일과 오솔길·가로수·표지판. 마지막 점선 부지(+)를 누르면 그 지구에 바로 입주.
- **건물 상세** : 건물 그림, 한 줄 소개, 태그, ⭐ 즐겨찾기 핀, 🚀 사이트 열기(새 탭), GitHub 바로가기. 직접 입주시킨 건물은 수정·철거 가능.
- **앱 덱** : 지구 필터(전체 · 여행 · 창작 · 업무 · ⭐즐겨찾기) + 검색 + 카드 목록.
- **낮 / 노을 테마** : 상단 토글로 마을 분위기 전환(설정 유지).
- **반응형** : PC 1440px · 모바일 390px 모두 가로 스크롤 없이 동작.

## 저장 키

| 키 | 내용 |
| --- | --- |
| `kusari-village:v1:custom-sites` | 화면에서 입주시킨 건물 |
| `kusari-village:v1:favorites` | 즐겨찾기 핀 목록 |
| `kusari-village:v1:theme` | `day` / `sunset` |
| `kusari-village:v1:view` | `map` / `deck` |

## 검수

Playwright로 PC(1440×900)·모바일(390×844)에서 이미지 로드, 콘솔 에러, 가로 오버플로우,
필터·검색·상세·즐겨찾기·입주·수정·철거·내보내기까지 42개 항목을 확인했습니다.
결과와 스크린샷은 `downloads/kusari-village-qa/` 에 있습니다.
