/* ============================================================
   🏡 쿠사리 빌리지 v8 · 기본 입주 명단 (KUSARI VILLAGE · sites · 15곳)
   ------------------------------------------------------------
   마을은 하나의 연속된 2.5D 지도입니다. 좌표(pos)는 마을 지도
   (2400 × 1900) 위에서 건물이 서는 발밑 지점 [x, y] 입니다.

   { id, name, url, repo, newTab, district, building, tier, parent,
     pos, role, desc, tags }

   · newTab   : true 면 새 탭(_blank)으로 엽니다. 우리가 직접 컨트롤할 수
              없는 외부 사이트(노션 등)에 씁니다. 우리가 만든 자체 웹앱은
              repo 가 있으므로 같은 탭에서 이동합니다. (repo 가 없으면
              newTab 을 쓰지 않아도 새 탭으로 열립니다)

   · district : travel | creative | work | sprout
   · building : presets 배열의 id (건물 그림 13종)
   · tier     : 1 = 본부(독립 사이트) / 2 = 별관(본부 하위 연결)
              ※ tier 값은 내부 구분용입니다. 화면에는 `본부`·`별관`으로만 보입니다.
   · parent   : tier 2 일 때 상위 본부 사이트의 id
   · pos      : [x, y] 마을 지도 위 발밑 좌표 (생략하면 자동 배치)
   · role     : 명패·카드에 들어가는 한 줄 소개 (예: "본부. 잊지 못할 여행의 기록")
   · sign     : 지구 표지판이 서는 지도 좌표 [x, y] (district 쪽에만 씁니다)
   ============================================================ */
window.KUSARI_TOWN = {
  version: 8,
  updated: "2026-11-27",
  world: { w: 2400, h: 1900 },

  /* ── 지구 ─────────────────────────────────────── */
  districts: [
    {
      id: "travel",
      name: "여행 지구",
      en: "Travel District",
      emoji: "🧭",
      desc: "나의 여행 지도 본부와 4개 별관이 모인 마을 북서쪽 언덕",
      accent: "#C1663B",
      accent2: "#E9B98C",
      tint: "#FDEFDF",
      /* 서쪽으로 옮기고 반경을 줄여 본부 1 + 별관 4 + 다음 1채만 감싸는 구역으로 조였다.
         (구역 680×450 → 490×490, 면적 약 22% 축소) */
      zone: { cx: 600, cy: 560, rx: 490, ry: 490 },
      look: { cx: 620, cy: 600, s: 0.86 },
      /* 여행 지구 남쪽 길목 — 다음 여행 앱이 들어올 서쪽 빈 터는 slots 에 남긴다 */
      sign: [610, 860],
      slots: [[140, 570]]
    },
    {
      id: "creative",
      name: "창작 골목",
      en: "Creative Alley",
      emoji: "📸",
      desc: "필름과 프롬프트가 오가는 골목, 햇살이 오래 머무는 곳",
      accent: "#B06A8A",
      accent2: "#E7B4C9",
      tint: "#FBEAF1",
      /* 4채(인생이라는 필름 · 프롬프트 스튜디오 · SlideFix Pro · 영상 편집 템플릿 스튜디오)가
         서는 골목. 여행 지구가 서쪽으로 비켜준 만큼 골목 구역을 마을 중앙까지 넓게 펼쳤다.
         (구역 490×360 → 615×430, 면적 약 51% 확대) */
      zone: { cx: 1725, cy: 690, rx: 615, ry: 430 },
      look: { cx: 1650, cy: 700, s: 0.72 },
      /* 골목 남서쪽 입구 — 마을 중앙 길에서 골목으로 들어서는 자리 */
      sign: [1600, 896],
      /* 다음 건물이 들어올 빈 자리 — 골목 서쪽 입구 안쪽과 북쪽 풀밭 세 곳 */
      slots: [[1230, 600], [1500, 360], [1790, 335]]
    },
    {
      id: "work",
      name: "업무 광장",
      en: "Work Plaza",
      emoji: "🏛️",
      desc: "감사 자료와 포털, 개인정보 도구가 넓게 펼쳐진 돌바닥 광장",
      accent: "#5E7A6A",
      accent2: "#A9C0AA",
      tint: "#EAF0E7",
      /* 남서~남중앙 돌바닥 광장을 최대한 넓혔다. (구역 560×370 → 530×400, 돌바닥 486×350 → 480×380)
         입주 자리는 4열 × 2줄(윗줄 4칸 · 아랫줄 2칸). 5곳이 서고(윗줄 3 + 아랫줄 2),
         [965, 1425] 가 다음 입주 몫으로 비어 있다.
         (동쪽 끝은 대문 아치와 부딪히지 않게 x≈1040 에서 멈춘다 — 아랫줄 동쪽 칸은 두지 않고,
          아랫줄 서쪽 칸은 업무 광장 표지판 자리로 비워 둔다) */
      zone: { cx: 620, cy: 1510, rx: 530, ry: 400 },
      look: { cx: 620, cy: 1450, s: 0.78 },
      sign: [160, 1600],
      /* 자리 격자(4열 × 2줄). 지금은 [965,1425] 만 비어 있고, 나머지는 이미 5채가 섰다
         (감사보고서 자동화가 2026-11-27 에 [700,1780] 을 채웠다). */
      slots: [[170, 1425], [435, 1425], [700, 1425], [965, 1425], [435, 1780], [700, 1780]]
    },
    {
      id: "sprout",
      name: "영감 놀이터",
      en: "Idea Playground",
      emoji: "💡",
      desc: "새 아이디어와 새 사이트가 놀이처럼 자리를 잡는 땅",
      accent: "#7E8F45",
      accent2: "#C4D18E",
      tint: "#F2F5E2",
      zone: { cx: 1740, cy: 1440, rx: 460, ry: 300 },
      look: { cx: 1740, cy: 1380, s: 0.9 },
      /* 표지판을 구역 남서쪽 길목으로 내려 `쿠사리 AI 팀 회의실` 명패와 겹치지 않게 했다 */
      sign: [1500, 1660],
      slots: [[1400, 1300], [1990, 1320], [2010, 1640]]
    }
  ],

  /* ── 건물 프리셋 13종 ─────────────────────────── */
  presets: [
    { id: "travel-hub",   name: "중앙 여행자 안내소", en: "Central Travel Hub", img: "assets/buildings/travel-hub.webp", w: 760, h: 675 },
    { id: "hanok",        name: "한옥 게스트하우스",   en: "Hanok Guesthouse",   img: "assets/buildings/hanok.webp",       w: 760, h: 608 },
    { id: "lighthouse",   name: "항구 등대 & 터미널",  en: "Harbour Lighthouse", img: "assets/buildings/lighthouse.webp",  w: 760, h: 673 },
    { id: "lodge",        name: "알프스풍 산장 롯지",  en: "Alpine Lodge",       img: "assets/buildings/lodge.webp",       w: 760, h: 608 },
    { id: "train-station",name: "빈티지 기차역",       en: "Vintage Station",    img: "assets/buildings/train-station.webp", w: 760, h: 693 },
    { id: "film-lab",     name: "아날로그 필름 현상소",en: "Film Lab",           img: "assets/buildings/film-lab.webp",    w: 760, h: 683 },
    { id: "atelier",      name: "햇살 가득한 아틀리에",en: "Sunlit Atelier",     img: "assets/buildings/atelier.webp",     w: 760, h: 760 },
    { id: "library",      name: "법률·감사 도서관",    en: "Audit Library",      img: "assets/buildings/library.webp",     w: 760, h: 760 },
    { id: "privacy-vault",name: "개인정보 안심 금고",  en: "Privacy Vault",      img: "assets/buildings/privacy-vault.webp", w: 760, h: 760 },
    { id: "archive-hall", name: "모던 연구 아카이브",  en: "Research Archive",   img: "assets/buildings/archive-hall.webp", w: 760, h: 608 },
    { id: "cafe",         name: "아기자기한 카페",     en: "Cozy Corner Cafe",   img: "assets/buildings/cafe.webp",        w: 760, h: 760 },
    { id: "greenhouse",   name: "온실 공방",           en: "Greenhouse Workshop",img: "assets/buildings/greenhouse.webp",  w: 760, h: 760 },
    { id: "observatory",  name: "작은 천문대",         en: "Little Observatory", img: "assets/buildings/observatory.webp", w: 760, h: 760 }
  ],

  /* ── 기본 입주 사이트 15곳 ────────────────────── */
  sites: [
    /* 본부 · 여행 지구 본부 (별관 4개를 거느림) */
    { id: "my-travel-map", name: "나의 여행 지도", url: "https://my-travel-map-kohl.vercel.app/", repo: "my-travel-map",
      district: "travel", building: "travel-hub", tier: 1, parent: null, pos: [650, 605], w: 300,
      role: "본부. 잊지 못할 여행의 기록",
      desc: "다녀온 국내·세계 여행지를 색으로 채워가는 나만의 지도 허브. 아래 4개 Trail Log와 플래너가 모두 이 본부에서 이어집니다.",
      tags: ["여행 허브", "색칠 지도", "본부"] },

    /* 별관 · 나의 여행 지도 산하 4곳 */
    { id: "korea-travel-map", name: "대한민국 Trail Log", url: "https://korea-travel-map-ebon.vercel.app/", repo: "korea-travel-map",
      district: "travel", building: "hanok", tier: 2, parent: "my-travel-map", pos: [390, 300], w: 170,
      role: "별관. 나의 대한민국 여행 기록",
      desc: "전국 167개 시·군의 명소를 따라가며 남기는 국내 여행 기록. 나의 여행 지도에서 이어집니다.",
      tags: ["국내 여행", "167개 시·군", "Trail Log"] },

    { id: "world-travel-map", name: "세계 여행 Trail Log", url: "https://world-travel-map-blush.vercel.app/", repo: "world-travel-map",
      district: "travel", building: "lighthouse", tier: 2, parent: "my-travel-map", pos: [870, 880], w: 170,
      role: "별관. 나의 세계 여행 기록",
      desc: "세계 지도를 한 칸씩 채우며 쌓는 해외 여행의 발자취. 나의 여행 지도에서 이어집니다.",
      tags: ["세계 여행", "국가별 기록", "Trail Log"] },

    { id: "mountain-travel-map", name: "100대 명산 Trail Log", url: "https://mountain-travel-map.vercel.app/", repo: "mountain-travel-map",
      district: "travel", building: "lodge", tier: 2, parent: "my-travel-map", pos: [920, 300], w: 170,
      role: "별관. 나의 명산 완등 기록",
      desc: "100대 명산 완등을 향한 산행 기록과 산행지 안내. 나의 여행 지도에서 이어집니다.",
      tags: ["100대 명산", "등산 기록", "Trail Log"] },

    { id: "my-travel-planner", name: "나의 여행 플래너", url: "https://my-travel-planner-kohl.vercel.app/", repo: "my-travel-planner",
      district: "travel", building: "train-station", tier: 2, parent: "my-travel-map", pos: [350, 880], w: 170,
      role: "별관. 여행 계획은 스마트하게",
      desc: "출발·귀환 교통부터 숙소와 동선까지, 7개 탭으로 짜는 여행 계획. 나의 여행 지도에서 이어집니다.",
      tags: ["여행 계획", "숙소·동선", "Trail Log"] },

    /* 본부 · 창작 골목 독립 사이트 4곳 */
    { id: "video-template-studio", name: "영상 편집 템플릿 스튜디오", url: "https://video-template-studio-six.vercel.app/", repo: "video-template-studio",
      district: "creative", building: "cafe", tier: 1, parent: null, pos: [1483, 690], w: 215,
      role: "본부. 영상 편집 템플릿 DB",
      desc: "인스타 릴스와 CapCut의 영상 편집 템플릿을 용도·클립 수·툴별로 모아 두고 내 템플릿도 쌓는 카탈로그.",
      tags: ["영상 편집", "CapCut", "템플릿 DB"] },

    { id: "life-film-photo-guide", name: "인생이라는 필름", url: "https://life-film-photo-guide.vercel.app/", repo: "life-film-photo-guide",
      district: "creative", building: "film-lab", tier: 1, parent: null, pos: [1780, 700], w: 258,
      role: "본부. 인생 사진 촬영 가이드",
      desc: "촬영 팁 100장과 실제 사진으로 배우는 인생 사진 가이드. 창작 골목의 독립 사이트입니다.",
      tags: ["사진", "촬영 가이드", "100장"] },

    { id: "my-prompt-studio", name: "나만의 프롬프트 스튜디오", url: "https://my-prompt-studio-mu.vercel.app/", repo: "my-prompt-studio",
      district: "creative", building: "atelier", tier: 1, parent: null, pos: [2060, 900], w: 258,
      role: "본부. 이미지·영상 프롬프트 작업실",
      desc: "린니·HSH·유나 세 화풍의 이미지·영상 프롬프트를 한 화면에서 만드는 작업실.",
      tags: ["프롬프트", "이미지·영상", "창작"] },

    { id: "slidefix-pro", name: "SlideFix Pro", url: "https://sliderfix-pro.vercel.app/", repo: "sliderfix-pro", newTab: true,
      district: "creative", building: "greenhouse", tier: 1, parent: null, pos: [2050, 530], w: 215,
      role: "본부. 이미지·PDF 깨진 글자 복원",
      desc: "이미지나 PDF 속 깨진 한글·오타를 드래그 한 번으로 지우고 새 글자로 복원하는 에디터.",
      tags: ["슬라이드 수정", "OCR", "PDF·이미지"] },

    /* 본부 · 업무 광장 독립 사이트 4곳 */
    { id: "audit-grayzone-db", name: "감사 그레이존 사례 DB", url: "https://audit-grayzone-db.vercel.app/", repo: "audit-grayzone-db",
      district: "work", building: "library", tier: 1, parent: null, pos: [170, 1425], w: 240,
      role: "본부. 감사 그레이존 판단 사례 DB",
      desc: "공공·출연연 감사 그레이존 판단 사례 710건을 4단계로 정리한 DB.",
      tags: ["내부감사", "사례 710건", "판단 기준"] },

    { id: "kitech-audit", name: "KITECH-Audit 포털", url: "https://kitech-audit.vercel.app/", repo: "KITECH-Audit",
      district: "work", building: "archive-hall", tier: 1, parent: null, pos: [435, 1425], w: 240,
      role: "본부. 지능형 감사 지원 포털",
      desc: "지능형 감사 지원 도구와 자료를 한곳에 모은 통합 포털.",
      tags: ["KITECH", "감사 포털", "통합 자료"] },

    { id: "daily-audit-briefing", name: "감사 모닝 브리핑", url: "https://shinuc.notion.site/Daily-Audit-Briefing-412b1bd442e380efae37e2bbf1b7e955", repo: null, newTab: true,
      district: "work", building: "observatory", tier: 1, parent: null, pos: [435, 1780], w: 240,
      role: "본부. 감사 동향, 사례 브리핑 아카이브",
      desc: "매일 아침 9시 공공·출연연 감사 동향과 주요 사례를 정리해 쌓는 노션 모닝 브리핑 아카이브.",
      tags: ["모닝 브리핑", "공공·출연연", "노션"] },

    /* 본부 · 업무 광장 네 번째 입주민 (개인정보 도구) */
    { id: "hwpx-masker", name: "민감정보 안심마스커", url: "https://hwpx-masker.vercel.app/", repo: "hwpx-masker", newTab: true,
      district: "work", building: "privacy-vault", tier: 1, parent: null, pos: [700, 1425], w: 240,
      role: "본부. HWPX 개인정보만 골라 가리기",
      desc: "한글(HWPX) 문서의 주민번호·전화·계좌·주소·성명을 브라우저 안에서만 가립니다. 표·서식은 그대로, 서버 전송 없음.",
      tags: ["개인정보", "HWPX 마스킹", "브라우저 처리"] },

    /* 본부 · 업무 광장 다섯 번째 입주민 (문서 자동화) */
    { id: "audit-report", name: "감사보고서 자동화", url: "https://audit-report-chi.vercel.app/", repo: "audit-report", newTab: true,
      district: "work", building: "greenhouse", tier: 1, parent: null, pos: [740, 1780], w: 240,
      role: "본부. 감사처분심의위원회 결과보고서 HWPX",
      desc: "감사 팩트를 넣으면 감사처분심의위원회 결과보고서 서식 그대로의 .hwpx를 만드는 문서 공방. 입력값·파일은 브라우저 안에서만 처리됩니다.",
      tags: ["감사보고서", "HWPX 자동 생성", "브라우저 처리"] },

    /* 본부 · 영감 놀이터 첫 입주민 */
    { id: "ai-team-room", name: "쿠사리 AI 팀 회의실", url: "https://ai-team-room-457.pages.dev/", repo: "ai-team-room",
      district: "sprout", building: "cafe", tier: 1, parent: null, pos: [1690, 1470], w: 258,
      role: "본부. AI 팀 협업 회의",
      desc: "쿠사리님과 김비서·뮤즈·제미나이·클로드가 방별로 모여 협업하는 팀 회의실.",
      tags: ["AI 회의실", "팀 협업", "실시간"] }
  ]
};
