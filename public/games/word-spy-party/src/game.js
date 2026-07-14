export const DEFAULT_PLAYER_COUNT = 3;
export const MIN_PLAYER_COUNT = 3;
export const MAX_PLAYER_COUNT = 10;
export const PLAYER_COUNT = DEFAULT_PLAYER_COUNT;
export const TARGET_WORD_PAIR_COUNT = 10_000;

const WORD_CATEGORIES = Object.freeze([
  {
    id: "fruit",
    category: "과일",
    hint: "달고 신선한 과일",
    words: ["사과", "배", "귤", "오렌지", "자몽", "레몬", "라임", "포도", "청포도", "복숭아", "자두", "살구", "체리", "딸기", "블루베리", "라즈베리", "수박", "멜론", "참외", "키위", "망고", "파인애플", "바나나", "파파야", "코코넛", "감", "무화과", "석류", "리치", "용과"],
  },
  {
    id: "vegetable",
    category: "채소",
    hint: "요리에 자주 쓰는 채소",
    words: ["당근", "오이", "양파", "대파", "마늘", "생강", "감자", "고구마", "토마토", "가지", "호박", "애호박", "브로콜리", "콜리플라워", "양배추", "상추", "깻잎", "시금치", "청경채", "무", "배추", "파프리카", "피망", "셀러리", "버섯", "연근", "우엉", "아스파라거스", "완두콩", "옥수수"],
  },
  {
    id: "bunsik",
    category: "분식",
    hint: "분식집에서 만날 수 있는 메뉴",
    words: ["김밥", "떡볶이", "순대", "튀김", "라면", "쫄면", "우동", "어묵", "만두", "호떡", "붕어빵", "군고구마", "돈가스", "오므라이스", "유부초밥", "컵밥", "라볶이", "비빔만두", "김말이", "계란빵", "닭꼬치", "토스트", "주먹밥", "냉면", "칼국수", "잔치국수", "비빔국수", "떡국", "수제비", "물만두"],
  },
  {
    id: "western-food",
    category: "양식",
    hint: "레스토랑에서 자주 보는 양식 메뉴",
    words: ["파스타", "피자", "라자냐", "리조또", "뇨키", "브루스케타", "포카치아", "카프레제", "미네스트로네", "티라미수", "판나코타", "카르보나라", "볼로네제", "알리오올리오", "마르게리타", "칼조네", "라비올리", "파니니", "스테이크", "햄버거", "샌드위치", "오믈렛", "그라탕", "크로켓", "수프", "샐러드", "미트볼", "로스트치킨", "수비드", "바게트"],
  },
  {
    id: "dessert",
    category: "디저트",
    hint: "달콤한 후식",
    words: ["케이크", "마카롱", "쿠키", "브라우니", "도넛", "와플", "팬케이크", "푸딩", "젤리", "아이스크림", "셔벗", "타르트", "에클레어", "크레이프", "카스텔라", "머핀", "스콘", "몽블랑", "파르페", "빙수", "약과", "찹쌀떡", "다쿠아즈", "카눌레", "바클라바", "애플파이", "치즈케이크", "초콜릿", "생크림빵", "크루아상"],
  },
  {
    id: "drink",
    category: "음료",
    hint: "마실 수 있는 음료",
    words: ["물", "탄산수", "콜라", "사이다", "레모네이드", "오렌지주스", "포도주스", "사과주스", "토마토주스", "아이스티", "녹차", "홍차", "보리차", "옥수수차", "우유", "두유", "요구르트", "스무디", "쉐이크", "에이드", "핫초코", "식혜", "수정과", "막걸리", "맥주", "와인", "사케", "칵테일", "모히토", "라씨"],
  },
  {
    id: "sport",
    category: "스포츠",
    hint: "몸을 움직이는 운동 종목",
    words: ["축구", "농구", "야구", "배구", "탁구", "테니스", "배드민턴", "골프", "럭비", "핸드볼", "하키", "수영", "다이빙", "서핑", "스키", "스노보드", "스케이트", "사이클", "육상", "마라톤", "복싱", "유도", "태권도", "펜싱", "양궁", "사격", "승마", "체조", "클라이밍", "볼링"],
  },
  {
    id: "animal",
    category: "동물",
    hint: "육지에서 볼 수 있는 동물",
    words: ["강아지", "고양이", "토끼", "햄스터", "고슴도치", "앵무새", "금붕어", "거북이", "말", "소", "돼지", "양", "염소", "닭", "오리", "사슴", "여우", "늑대", "곰", "호랑이", "사자", "표범", "코끼리", "기린", "얼룩말", "원숭이", "판다", "코알라", "캥거루", "하마"],
  },
  {
    id: "marine-life",
    category: "해양 생물",
    hint: "바다에서 떠올리기 쉬운 생물",
    words: ["고래", "돌고래", "상어", "가오리", "문어", "오징어", "해파리", "불가사리", "게", "새우", "바닷가재", "조개", "홍합", "전복", "굴", "멍게", "해삼", "성게", "갈치", "고등어", "참치", "연어", "광어", "우럭", "도미", "농어", "복어", "해마", "바다거북", "말미잘"],
  },
  {
    id: "transport",
    category: "교통수단",
    hint: "사람이나 물건을 이동시키는 탈것",
    words: ["버스", "지하철", "택시", "기차", "고속철도", "트램", "모노레일", "비행기", "헬리콥터", "선박", "페리", "요트", "카누", "카약", "자전거", "전동킥보드", "오토바이", "승용차", "트럭", "밴", "캠핑카", "구급차", "소방차", "경찰차", "스쿨버스", "리무진", "케이블카", "곤돌라", "열기구", "우주선"],
  },
  {
    id: "stationery",
    category: "문구",
    hint: "책상 위에서 쓰는 문구류",
    words: ["연필", "볼펜", "만년필", "형광펜", "색연필", "사인펜", "지우개", "자", "가위", "풀", "테이프", "스테이플러", "클립", "압정", "노트", "수첩", "파일", "바인더", "포스트잇", "봉투", "편지지", "스케치북", "도화지", "칠판", "분필", "화이트보드", "마커", "계산기", "컴퍼스", "각도기"],
  },
  {
    id: "instrument",
    category: "악기",
    hint: "소리를 내고 연주하는 악기",
    words: ["기타", "피아노", "바이올린", "첼로", "비올라", "콘트라베이스", "플루트", "클라리넷", "오보에", "바순", "색소폰", "트럼펫", "트롬본", "호른", "튜바", "드럼", "팀파니", "심벌즈", "하모니카", "아코디언", "우쿨렐레", "하프", "오르간", "신시사이저", "실로폰", "마림바", "장구", "꽹과리", "가야금", "해금"],
  },
  {
    id: "color",
    category: "색",
    hint: "물건을 표현할 때 쓰는 색",
    words: ["빨강", "주황", "노랑", "초록", "파랑", "남색", "보라", "분홍", "하양", "검정", "회색", "갈색", "베이지", "민트", "청록", "자주", "와인색", "금색", "은색", "코랄", "라벤더", "아이보리", "카키", "올리브", "네이비", "하늘색", "연두", "살구색", "밤색", "에메랄드"],
  },
  {
    id: "clothing",
    category: "옷",
    hint: "몸에 걸치는 옷과 패션 소품",
    words: ["티셔츠", "셔츠", "블라우스", "니트", "후드티", "맨투맨", "재킷", "코트", "패딩", "조끼", "청바지", "슬랙스", "반바지", "치마", "원피스", "정장", "한복", "운동복", "잠옷", "양말", "장갑", "목도리", "모자", "벨트", "넥타이", "스카프", "레깅스", "트렌치코트", "카디건", "점퍼"],
  },
  {
    id: "furniture",
    category: "가구",
    hint: "집이나 공간에 놓는 가구",
    words: ["의자", "소파", "책상", "식탁", "침대", "옷장", "서랍장", "책장", "선반", "협탁", "화장대", "거울", "탁자", "벤치", "스툴", "리클라이너", "바테이블", "캐비닛", "신발장", "수납장", "파티션", "행거", "매트리스", "쿠션", "러그", "커튼", "블라인드", "조명", "스탠드", "식기장"],
  },
  {
    id: "device",
    category: "전자기기",
    hint: "전기로 작동하는 기기",
    words: ["휴대폰", "태블릿", "노트북", "데스크톱", "모니터", "키보드", "마우스", "프린터", "스캐너", "카메라", "캠코더", "이어폰", "헤드폰", "스피커", "마이크", "스마트워치", "게임기", "리모컨", "공유기", "충전기", "보조배터리", "드론", "전자책", "프로젝터", "텔레비전", "라디오", "내비게이션", "공기청정기", "로봇청소기", "전기포트"],
  },
  {
    id: "place",
    category: "여행지",
    hint: "나들이나 여행에서 갈 수 있는 장소",
    words: ["해변", "산", "호수", "강", "계곡", "섬", "숲", "공원", "캠핑장", "리조트", "호텔", "게스트하우스", "박물관", "미술관", "공연장", "시장", "카페거리", "놀이공원", "동물원", "수족관", "온천", "사찰", "성당", "궁궐", "전망대", "등대", "항구", "공항", "기차역", "광장"],
  },
  {
    id: "job",
    category: "직업",
    hint: "사람들이 하는 다양한 일",
    words: ["의사", "간호사", "약사", "교사", "교수", "변호사", "판사", "검사", "경찰관", "소방관", "군인", "요리사", "제빵사", "디자이너", "개발자", "작가", "기자", "아나운서", "배우", "가수", "댄서", "감독", "사진가", "화가", "건축가", "엔지니어", "연구원", "회계사", "통역사", "비행사"],
  },
  {
    id: "plant",
    category: "꽃과 식물",
    hint: "화분이나 자연에서 볼 수 있는 식물",
    words: ["장미", "튤립", "해바라기", "백합", "국화", "카네이션", "수국", "라일락", "목련", "벚꽃", "매화", "진달래", "철쭉", "동백", "코스모스", "안개꽃", "프리지아", "히아신스", "민들레", "제라늄", "아이리스", "데이지", "팬지", "난초", "선인장", "다육식물", "몬스테라", "고무나무", "대나무", "소나무"],
  },
  {
    id: "weather",
    category: "날씨와 자연현상",
    hint: "하늘과 자연에서 일어나는 현상",
    words: ["비", "눈", "바람", "안개", "구름", "번개", "천둥", "우박", "서리", "이슬", "무지개", "폭풍", "태풍", "홍수", "가뭄", "지진", "화산", "파도", "조수", "일출", "일몰", "노을", "오로라", "한파", "폭염", "장마", "미세먼지", "황사", "소나기", "진눈깨비"],
  },
  {
    id: "snack",
    category: "간식",
    hint: "가볍게 집어 먹는 간식",
    words: ["감자칩", "팝콘", "프레첼", "크래커", "초코바", "젤리빈", "마시멜로", "껌", "사탕", "캐러멜", "육포", "견과류", "군밤", "과일칩", "고구마말랭이", "누룽지", "뻥튀기", "쌀과자", "웨하스", "홈런볼", "초코파이", "오징어채", "김부각", "호두과자", "쿠키스틱", "츄러스", "치즈볼", "콘칩", "쫀드기", "새우깡"],
  },
  {
    id: "sports-gear",
    category: "운동용품",
    hint: "운동할 때 쓰는 장비",
    words: ["축구공", "농구공", "야구공", "배구공", "테니스라켓", "배드민턴라켓", "골프채", "야구배트", "글러브", "골대", "농구대", "요가매트", "덤벨", "바벨", "줄넘기", "헬멧", "보호대", "운동화", "수영모", "수경", "스키폴", "스케이트화", "서핑보드", "스노보드", "클라이밍화", "탁구채", "볼링공", "양궁활", "펜싱검", "샌드백"],
  },
  {
    id: "reading",
    category: "읽을거리",
    hint: "읽거나 넘겨볼 수 있는 콘텐츠",
    words: ["소설", "시집", "에세이", "만화", "동화", "전기", "역사서", "과학책", "여행기", "요리책", "추리소설", "판타지", "SF", "로맨스", "스릴러", "호러", "자기계발서", "경제서", "철학서", "예술서", "사진집", "사전", "문제집", "교과서", "가이드북", "잡지", "신문", "논문", "희곡", "웹툰"],
  },
]);

function buildWordPairs() {
  const pairs = [];
  for (const group of WORD_CATEGORIES) {
    for (let firstIndex = 0; firstIndex < group.words.length - 1; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < group.words.length; secondIndex += 1) {
        pairs.push(
          Object.freeze({
            id: `${group.id}-${String(firstIndex + 1).padStart(2, "0")}-${String(secondIndex + 1).padStart(2, "0")}`,
            category: group.category,
            hint: group.hint,
            words: Object.freeze([group.words[firstIndex], group.words[secondIndex]]),
          }),
        );
        if (pairs.length === TARGET_WORD_PAIR_COUNT) {
          return Object.freeze(pairs);
        }
      }
    }
  }
  throw new Error(`Need at least ${TARGET_WORD_PAIR_COUNT} word pairs.`);
}

export const WORD_PAIRS = buildWordPairs();

function pickIndex(length, rng) {
  const value = Number(rng());
  const normalized = Number.isFinite(value) ? value : 0;
  return Math.min(length - 1, Math.max(0, Math.floor(normalized * length)));
}

function normalizePlayerCount(playerCount) {
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYER_COUNT || playerCount > MAX_PLAYER_COUNT) {
    throw new Error(`Player count must be an integer from ${MIN_PLAYER_COUNT} to ${MAX_PLAYER_COUNT}.`);
  }
  return playerCount;
}

function pickCandidatePairs(options) {
  const blockedPairIds = new Set(options.excludedPairIds ?? []);
  if (options.previousPairId) {
    blockedPairIds.add(options.previousPairId);
  }
  const blockedWords = new Set(options.excludedWords ?? []);

  const pairsWithoutUsedWords = WORD_PAIRS.filter(
    (pair) => !blockedPairIds.has(pair.id) && pair.words.every((word) => !blockedWords.has(word)),
  );
  if (pairsWithoutUsedWords.length) {
    return { pairs: pairsWithoutUsedWords, historyReset: false };
  }

  const pairsWithoutUsedPairIds = WORD_PAIRS.filter((pair) => !blockedPairIds.has(pair.id));
  if (pairsWithoutUsedPairIds.length) {
    return { pairs: pairsWithoutUsedPairIds, historyReset: blockedWords.size > 0 };
  }

  return {
    pairs: WORD_PAIRS,
    historyReset: blockedPairIds.size > 0 || blockedWords.size > 0,
  };
}

export function generateRound(options = {}) {
  const { rng = Math.random, previousPairId, playerCount = DEFAULT_PLAYER_COUNT } = options;
  const normalizedPlayerCount = normalizePlayerCount(playerCount);
  const { pairs, historyReset } = pickCandidatePairs({
    previousPairId,
    excludedPairIds: options.excludedPairIds,
    excludedWords: options.excludedWords,
  });
  const pair = pairs[pickIndex(pairs.length, rng)];
  const majorityWordIndex = pickIndex(pair.words.length, rng);
  const majorityWord = pair.words[majorityWordIndex];
  const oddWord = pair.words[majorityWordIndex === 0 ? 1 : 0];
  const oddPlayerIndex = pickIndex(normalizedPlayerCount, rng);

  const assignments = Array.from({ length: normalizedPlayerCount }, (_, index) => {
    const isOdd = index === oddPlayerIndex;
    return {
      playerNumber: index + 1,
      word: isOdd ? oddWord : majorityWord,
      isOdd,
    };
  });

  return {
    pairId: pair.id,
    category: pair.category,
    hint: pair.hint,
    playerCount: normalizedPlayerCount,
    historyReset,
    majorityWord,
    oddWord,
    oddPlayerIndex,
    assignments,
  };
}
