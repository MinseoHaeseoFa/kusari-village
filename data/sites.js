/* ============================================================
   🏡 쿠사리 타운 · 기본 입주 명단 (KUSARI VILLAGE · sites)
   ------------------------------------------------------------
   새 사이트를 기본 입주시키려면 아래 sites 배열에
   한 줄만 추가하면 됩니다. 나머지 코드는 건드리지 않아도 됩니다.

   { id, name, url, repo, district, building, desc, tags }

   · district : travel | creative | work | sprout
   · building : presets 배열의 id (건물 그림 12종)
   · repo     : GitHub 저장소 이름 (MinseoHaeseoFa/<repo>) 또는 전체 주소
   ============================================================ */
window.KUSARI_TOWN = {
  version: 1,
  updated: "2026-11-22",

  /* ── 지구 ─────────────────────────────────────── */
  districts: [
    {
      id: "travel",
      name: "여행 지구",
      en: "Travel District",
      emoji: "🧭",
      desc: "지도와 기록, 플래너가 모여 있는 마을 북쪽 길",
      accent: "#C1663B",
      tint: "#FBEEE0",
      lawn: "#F4E7D2"
    },
    {
      id: "creative",
      name: "창작 골목",
      en: "Creative Alley",
      emoji: "📸",
      desc: "필름과 프롬프트가 오가는 골목, 햇살이 오래 머무는 곳",
      accent: "#B06A8A",
      tint: "#FAECF1",
      lawn: "#F3E4EA"
    },
    {
      id: "work",
      name: "업무·리서치 광장",
      en: "Work & Research Plaza",
      emoji: "🏛️",
      desc: "감사 자료와 포털이 나란히 선 광장",
      accent: "#6C8272",
      tint: "#ECF1E8",
      lawn: "#E4EBDE"
    },
    {
      id: "sprout",
      name: "새싹 개발지",
      en: "Sprouting Plots",
      emoji: "🌱",
      desc: "새로 입주한 사이트가 한 칸씩 자리를 잡는 땅",
      accent: "#8A9A4E",
      tint: "#F1F3E1",
      lawn: "#E9EDD3"
    }
  ],

  /* ── 건물 프리셋 12종 ─────────────────────────── */
  presets: [
    { id: "travel-hub",   name: "중앙 여행자 안내소", en: "Central Travel Hub", img: "assets/buildings/travel-hub.webp" },
    { id: "hanok",        name: "한옥 게스트하우스",   en: "Hanok Guesthouse",   img: "assets/buildings/hanok.webp" },
    { id: "lighthouse",   name: "항구 등대 & 터미널",  en: "Harbour Lighthouse", img: "assets/buildings/lighthouse.webp" },
    { id: "lodge",        name: "알프스풍 산장 롯지",  en: "Alpine Lodge",       img: "assets/buildings/lodge.webp" },
    { id: "train-station",name: "빈티지 기차역",       en: "Vintage Station",    img: "assets/buildings/train-station.webp" },
    { id: "film-lab",     name: "아날로그 필름 현상소",en: "Film Lab",           img: "assets/buildings/film-lab.webp" },
    { id: "atelier",      name: "햇살 가득한 아틀리에",en: "Sunlit Atelier",     img: "assets/buildings/atelier.webp" },
    { id: "library",      name: "법률·감사 도서관",    en: "Audit Library",      img: "assets/buildings/library.webp" },
    { id: "archive-hall", name: "모던 연구 아카이브",  en: "Research Archive",   img: "assets/buildings/archive-hall.webp" },
    { id: "cafe",         name: "아기자기한 카페",     en: "Cozy Corner Cafe",   img: "assets/buildings/cafe.webp" },
    { id: "greenhouse",   name: "온실 공방",           en: "Greenhouse Workshop",img: "assets/buildings/greenhouse.webp" },
    { id: "observatory",  name: "작은 천문대",         en: "Little Observatory", img: "assets/buildings/observatory.webp" }
  ],

  /* ── 기본 입주 사이트 9곳 ─────────────────────── */
  sites: [
    { id: "my-travel-map",      name: "나의 여행 지도",         url: "https://my-travel-map-kohl.vercel.app/",    repo: "my-travel-map",        district: "travel",   building: "travel-hub",    desc: "다녀온 국내·세계 여행지를 색으로 채워가는 나만의 지도 허브", tags: ["여행 허브", "색칠 지도", "모아보기"] },
    { id: "korea-travel-map",   name: "대한민국 Trail Log",     url: "https://korea-travel-map-ebon.vercel.app/", repo: "korea-travel-map",     district: "travel",   building: "hanok",         desc: "전국 167개 시·군의 명소를 따라가며 남기는 국내 여행 기록", tags: ["국내 여행", "167개 시·군", "Trail Log"] },
    { id: "world-travel-map",   name: "세계 여행 Trail Log",    url: "https://world-travel-map-blush.vercel.app/",repo: "world-travel-map",     district: "travel",   building: "lighthouse",    desc: "세계 지도를 한 칸씩 채우며 쌓는 해외 여행의 발자취", tags: ["세계 여행", "국가별 기록", "Trail Log"] },
    { id: "mountain-travel-map",name: "100대 명산 Trail Log",   url: "https://mountain-travel-map.vercel.app/",   repo: "mountain-travel-map",  district: "travel",   building: "lodge",         desc: "100대 명산 완등을 향한 산행 기록과 산행지 안내", tags: ["100대 명산", "등산 기록", "Trail Log"] },
    { id: "my-travel-planner",  name: "나의 여행 플래너",       url: "https://my-travel-planner-kohl.vercel.app/",repo: "my-travel-planner",    district: "travel",   building: "train-station", desc: "출발·귀환 교통부터 숙소와 동선까지, 7개 탭으로 짜는 여행 계획", tags: ["여행 계획", "숙소·동선", "모바일 최적화"] },
    { id: "life-film-photo-guide", name: "인생이라는 필름",     url: "https://life-film-photo-guide.vercel.app/", repo: "life-film-photo-guide",district: "creative", building: "film-lab",      desc: "촬영 팁 100장과 실제 사진으로 배우는 인생 사진 가이드", tags: ["사진", "촬영 가이드", "100장"] },
    { id: "my-prompt-studio",   name: "나만의 프롬프트 스튜디오",url: "https://my-prompt-studio-mu.vercel.app/",  repo: "my-prompt-studio",     district: "creative", building: "atelier",       desc: "린니·HSH·유나 세 화풍의 이미지·영상 프롬프트를 한 화면에서 만드는 작업실", tags: ["프롬프트", "이미지·영상", "창작"] },
    { id: "audit-grayzone-db",  name: "감사 그레이존 사례 DB",  url: "https://audit-grayzone-db.vercel.app/",     repo: "audit-grayzone-db",    district: "work",     building: "library",       desc: "공공·출연연 감사 그레이존 판단 사례 710건을 4단계로 정리한 DB", tags: ["내부감사", "사례 710건", "판단 기준"] },
    { id: "kitech-audit",       name: "KITECH-Audit 포털",      url: "https://kitech-audit.vercel.app/",          repo: "KITECH-Audit",         district: "work",     building: "archive-hall",  desc: "지능형 감사 지원 도구와 자료를 한곳에 모은 통합 포털", tags: ["KITECH", "감사 포털", "통합 자료"] }
  ]
};
