/* ============================================================================
 *  story.js — 학급 뮤지컬의 '뼈대'
 *  버전: story v1.0.0 (2026-09-07)
 *
 *  여기 있는 것은 예시 대본 『찬란하게 빛나는 우리들의 중3 에세이』의 뼈대입니다.
 *  · 등장인물과 여섯 막의 시간대·장소는 학급 전체가 함께 씁니다.
 *  · 각 모둠은 이 뼈대 위에 자기 막 하나(대본 + 넘버 하나)를 새로 씁니다.
 *  · 예시 대사·예시 가사는 '이 정도 분량과 결'을 보여 주는 견본일 뿐이며,
 *    학생 화면에서는 접혀 있는 [예시 보기] 안에만 나타납니다. 베끼면 안 됩니다.
 *
 *  ★ 고치고 싶을 때
 *    - 인물을 바꾸려면  CAST  를
 *    - 막의 시간대·장소를 바꾸려면  ACTS  를
 *    - 넘버 장르 보기를 바꾸려면  ACTS[n].numberHint 를 고치세요.
 *    학생·교사 화면이 같이 바뀝니다.
 * ==========================================================================*/

const STORY_VERSION = 'story v1.6.0 (2026-09-09) 정원5';

/* 작품 기본값. 교사 화면에서 학급마다 바꿀 수 있습니다. */
const SHOW = {
  title: '찬란하게 빛나는 우리들의 중3 에세이',
  subtitle: 'Musicalinus 우리 안의 뮤지컬',
  genre: '청소년 창작 뮤지컬 (6막 6넘버)',
  target: '중학교 3학년'
};

/* ---------------------------------------------------------------------------
 *  1. 등장인물 — 학급 공통
 *     key 는 저장에 쓰는 이름이라 바꾸면 이미 쓴 대사와 연결이 끊깁니다.
 * -------------------------------------------------------------------------*/
const CAST = [
  { key: 'jihoo',   name: '지후',   line: '감수성이 풍부하고 음악으로 자신을 표현하고 싶어 하는 주인공', color: '#5B7CFA' },
  { key: 'minseo',  name: '민서',   line: '운동과 급식을 인생의 활력소로 삼는 절친. 쾌활하지만 속이 깊다', color: '#F2C14E' },
  { key: 'yuna',    name: '유나',   line: '성적에 민감하고 완벽을 추구하지만 내면에 예술적 갈망을 품은 반장', color: '#F06292' },
  { key: 'teacher', name: '선생님', line: '아이들의 진심을 끌어내 주는 따뜻한 조력자',                     color: '#48C9B0' },
  { key: 'ens1',    name: '앙상블',  line: '중3 교실의 다양한 개성과 고민을 가진 친구 (모둠이 이름을 붙입니다)', color: '#B96BD8' }
];
const castOf = k => CAST.find(c => c.key === k) || null;
const castName = k => (castOf(k) ? castOf(k).name : (k === 'all' ? '전원' : k || ''));

/* ---------------------------------------------------------------------------
 *  2. 제작 역할 — 모둠 안에서 나누어 맡습니다
 *     한 사람이 배역 하나 + 제작 역할 하나를 맡습니다.
 * -------------------------------------------------------------------------*/
const JOBS = [
  { key: 'script', name: '대본 리더', icon: '✎',
    duty: '막 제목·시간대·무대 배경을 정하고, 장면 지문(무대 지시)을 씁니다. 대사 순서도 정리합니다.',
    owns: ['막 설정', '지문', '대사 순서'] },
  { key: 'lyric',  name: '작사 리더', icon: '✍',
    duty: '넘버의 가사를 씁니다. 어느 인물이 어느 줄을 부르는지 파트를 나눕니다.',
    owns: ['넘버 제목', '가사'] },
  { key: 'compose', name: '작곡 리더', icon: '♪',
    duty: 'Suno에 넣을 프롬프트 네 칸(장르·분위기·악기·보컬 구성)을 채웁니다.',
    owns: ['Suno 프롬프트'] },
  { key: 'arrange', name: '편곡 리더', icon: '≋',
    duty: '넘버의 구성(전주–벌스–후렴–브릿지)을 짜고, 만든 데모 두 개를 견주어 하나를 고릅니다.',
    owns: ['넘버 구성', '데모 비교'] },
  { key: 'stage',   name: '발표 리더', icon: '▲',
    duty: '배역을 배정하고 등·퇴장, 소품, 조명 큐를 적습니다. 모둠 작품을 최종 제출합니다.',
    owns: ['연출 노트', '제출'] },

  /* ★ v1.6 — 예비 자리. 학생 화면에는 나타나지 않습니다.
     31명이 넘는 학급에서 선생님이 여섯 번째로 넣어 줄 때만 씁니다. */
  { key: 'script2', name: '공동 대본', icon: '✎+', teacherOnly: true,
    duty: '대본 리더와 함께 지문과 대사 순서를 다듬습니다. 모둠이 여섯 명일 때만 쓰는 자리입니다.',
    owns: ['막 설정 돕기', '지문 돕기'] }
];

/* ★ v1.6 — 학생이 스스로 고를 수 있는 다섯 자리. 자리 고르는 화면은 이것만 보여 줍니다. */
const STUDENT_JOBS = JOBS.filter(j => !j.teacherOnly);
const jobOf = k => JOBS.find(j => j.key === k) || null;
const jobName = k => (jobOf(k) ? jobOf(k).name : '');

/* 어떤 제작 역할이 어떤 칸을 고칠 수 있는지. 서버(Code.gs)에도 같은 표가 있습니다. */
const FIELD_OWNER = {
  actTitle:   ['script', 'script2'],
  actTime:    ['script', 'script2'],
  actPlace:   ['script', 'script2'],
  sceneTitle: ['script', 'script2'],
  logline:    ['script', 'script2'],
  numberTitle:['lyric'],
  lyrics:     ['lyric'],
  prompt:     ['compose'],
  structure:  ['arrange'],
  demo:       ['arrange'],
  staging:    ['stage'],
  castMap:    ['stage']
};

/* ---------------------------------------------------------------------------
 *  3. 여섯 막의 뼈대
 *     모둠은 이 가운데 하나를 맡습니다. time·place 는 시작값이고 모둠이 고칩니다.
 * -------------------------------------------------------------------------*/
const ACTS = [
  {
    no: 1,
    time: '08:00 AM',
    title: '시작되는 우리의 스토리',
    place: '지후의 방과 등교 버스 정류장. 무대 좌측에 헝클어진 침대와 책상, 우측에 낡은 버스 표지판.',
    beat: '하루가 열린다. 알람, 늦잠, 서툰 꿈이 적힌 메모지, 그리고 등굣길에서 만나는 친구.',
    ask: '아침의 소음 속에서 우리가 몰래 품고 있는 것은 무엇인가?',
    numberHint: { title: '중3의 아침', genre: 'K-Pop Musical / 밝고 힘찬 J-Rock' },
    onstage: ['jihoo', 'minseo', 'ens1'],
    sample: {
      dialogue: '지후 — (이불 속에서 기어 나오며) 아, 진짜… 알람 소리가 무슨 전쟁 선포 같아.',
      lyric: '아침 일찍 울리는 알람 소리에 / 지친 몸을 일으켜 겨우 눈을 떠'
    }
  },
  {
    no: 2,
    time: '10:30 AM',
    title: '교실, 꿈과 현실 사이',
    place: '교실. 정면 거대한 칠판에 「기말고사 D-30」과 수행평가 목록이 빼곡하다.',
    beat: '성적표 앞에서 마음이 무너진다. 서로 다른 무게의 걱정이 부딪치고, 조심스레 이해가 시작된다.',
    ask: '숫자로 매겨지지 않는 것을 우리는 어떻게 지킬 수 있을까?',
    numberHint: { title: '칠판 위의 걱정들', genre: 'Dramatic Musical Ballad' },
    onstage: ['yuna', 'jihoo', 'minseo'],
    sample: {
      dialogue: '유나 — (성적표를 꽉 쥐며) 지난번보다 또 2점 떨어졌어… 이 숫자 하나가 대체 내 미래를 어떻게 결정짓는 걸까?',
      lyric: '내가 진짜 원하는 게 뭔지도 모른 채 / 숫자 뒤에 숨어 울고 있는 나'
    }
  },
  {
    no: 3,
    time: '12:40 PM',
    title: '우리들의 해방구, 점심시간',
    place: '활기찬 운동장과 급식실 경계. 한쪽에 축구 골대, 다른 쪽에 대형 급식 식판 모형.',
    beat: '종이 울리자 세상이 뒤집힌다. 뛰고, 먹고, 웃는 45분 동안만은 모두가 주인공이다.',
    ask: '별것 아닌 순간이 특별해지는 마법은 어디에서 오는가?',
    numberHint: { title: '3소박의 열기', genre: 'Funk Pop / Brass Ensemble' },
    onstage: ['minseo', 'yuna', 'jihoo', 'ens1'],
    sample: {
      dialogue: '민서 — (공을 가로채며) 이지후! 멍 때리지 말고 패스! 이 순간만큼은 전 세계가 다 우리 거야!',
      lyric: '점심시간 종소리는 우리들의 해방 공간 / 운동장에 모여 먼지 날리며'
    }
  },
  {
    no: 4,
    time: '02:20 PM',
    title: '음악실, 나(ME)를 찾는 시간',
    place: '현대적인 음악실. 벽면에 전자 패드, 학생마다 태블릿과 헤드폰. 선생님이 무대 중앙에 선다.',
    beat: '점수가 없는 수업이 시작된다. 평범한 하루가 노래가 될 수 있다는 것을 처음 알게 된다.',
    ask: '평가받지 않는 창작 앞에서 우리는 무엇을 쓰게 되는가?',
    numberHint: { title: '나를 위한 에세이', genre: 'Acoustic Pop Ballad / Lo-fi' },
    onstage: ['teacher', 'jihoo', 'minseo', 'yuna'],
    sample: {
      dialogue: '선생님 — 이 수업엔 평가 기준이 없단다. 오직 너희들의 솔직한 진심만 있으면 돼.',
      lyric: '정답도 없고 판단도 없는 이곳에서 / 내 마음의 깊은 바다를 들여다보네'
    }
  },
  {
    no: 5,
    time: '06:00 PM',
    title: '고민하는 노을녘',
    place: '붉은 노을이 드리운 하교길. 무대 뒤 스크린에 스마트폰 화면과 고등학교 커트라인이 깜빡인다.',
    beat: '검색창 앞에서 각자의 두려움이 드러난다. 다른 길을 가는데 같은 자리에 서 있음을 알게 된다.',
    ask: '아직 정답을 모른다는 것을 우리는 서로에게 어떻게 말할 수 있을까?',
    numberHint: { title: '고등학교 검색창', genre: 'Emotional Rock Ballad' },
    onstage: ['minseo', 'jihoo', 'yuna'],
    sample: {
      dialogue: '지후 — 겉으로는 다 다른 길을 가는 것 같아도… 결국 똑같은 두려움 앞에 서 있네.',
      lyric: '우리의 걸음과 속도는 서로 다를지라도 / 우리가 도착할 곳은 분명히 아름다울 거야'
    }
  },
  {
    no: 6,
    time: '축제의 밤',
    title: '영원히 빛날 우리들의 페이지',
    place: '졸업 전 마지막 학교 축제 무대. 대형 영상으로 1년간의 사진과 직접 만든 리릭 비디오가 상영된다.',
    beat: '무대가 끝나고 숨을 몰아쉰다. 지나온 시간이 헛되지 않았음을 서로에게 증명한다. (피날레)',
    ask: '오늘의 우리는 먼 훗날의 우리에게 무엇을 남기는가?',
    numberHint: { title: '피날레 — 우리의 3학년이 빛나게', genre: 'Grand Finale / Broadway Anthem' },
    onstage: ['yuna', 'jihoo', 'minseo', 'teacher', 'ens1'],
    sample: {
      dialogue: '민서 — 우리가 어느 고등학교를 가든, 미래에 뭐가 되든 간에! 이 기억은 우리 뼈에 새겨졌다고!',
      lyric: '평범하고 지루했던 하루하루가 모여서 / 가장 아름다운 기억의 꽃을 피우네'
    }
  }
];
const actOf = n => ACTS.find(a => a.no === Number(n)) || null;

/* ---------------------------------------------------------------------------
 *  4. Suno 프롬프트 네 칸 — 예시 대본에 실린 형식 그대로
 * -------------------------------------------------------------------------*/
const PROMPT_FIELDS = [
  { key: 'genre',  label: 'Genre', ko: '장르',
    ph: '예) K-Pop Musical, Bright upbeat J-Rock, Orchestral Pop',
    help: '두세 개를 쉼표로 잇습니다. 한 개만 쓰면 밋밋해집니다.' },
  { key: 'mood',   label: 'Mood', ko: '분위기',
    ph: '예) Energetic, hopeful yet slightly overwhelmed, youthful',
    help: '감정을 형용사로 씁니다. 우리 막의 감정과 맞는지 확인하세요.' },
  { key: 'inst',   label: 'Instruments', ko: '악기',
    ph: '예) Acoustic guitar intro, driving drums, soaring strings',
    help: '가장 먼저 들리는 악기부터 씁니다.' },
  { key: 'vocal',  label: 'Vocal Structure', ko: '보컬 구성',
    ph: '예) Male solo (mellow) → Male solo 2 (bright) → Full chorus',
    help: '가사의 파트 배분과 어긋나면 안 됩니다. → 로 순서를 잇습니다.' }
];

/* 넘버 구성(편곡 리더) 기본 얼개 */
const STRUCTURE_PARTS = ['전주', '벌스 1', '프리코러스', '후렴', '벌스 2', '브릿지', '마지막 후렴', '아웃트로'];

/* ---------------------------------------------------------------------------
 *  5. 완성 기준 — 진행률 막대와 제출 검사에 함께 씁니다.
 *     min 은 '이만큼은 써야 제출할 수 있다'는 최소값입니다.
 * -------------------------------------------------------------------------*/
const CHECKS = [
  { id: 'actTitle',    job: 'script',  label: '막 제목',        min: 2,  hint: '우리 막에 이름을 붙였나요?' },
  { id: 'actPlace',    job: 'script',  label: '무대 배경',      min: 30, hint: '관객이 무대를 그릴 수 있을 만큼 적었나요?' },
  { id: 'castMap',     job: 'stage',   label: '배역 배정',      min: 3,  hint: '모둠원이 각자 어떤 인물을 맡는지 정했나요?' },
  { id: 'stageDir',    job: 'script',  label: '장면 지문',      min: 2,  hint: '지문이 두 줄 이상 있나요?' },
  { id: 'lines',       job: 'all',     label: '대사',           min: 12, hint: '대사가 열두 줄 이상 있나요?' },
  { id: 'linesEach',   job: 'all',     label: '모둠원 참여',    min: 1,  hint: '모둠원 모두가 자기 배역 대사를 한 줄 이상 썼나요?' },
  { id: 'numberTitle', job: 'lyric',   label: '넘버 제목',      min: 2,  hint: '넘버에 이름을 붙였나요?' },
  { id: 'lyrics',      job: 'lyric',   label: '가사',           min: 8,  hint: '가사가 여덟 줄 이상 있나요?' },
  { id: 'prompt',      job: 'compose', label: 'Suno 프롬프트',  min: 4,  hint: '네 칸을 모두 채웠나요?' },
  { id: 'structure',   job: 'arrange', label: '넘버 구성',      min: 3,  hint: '구성을 세 마디 이상 짰나요?' },
  { id: 'staging',     job: 'stage',   label: '연출 노트',      min: 20, hint: '등·퇴장과 소품을 적었나요?' }
];

/* ---------------------------------------------------------------------------
 *  6. 새 모둠 문서의 빈 서식
 * -------------------------------------------------------------------------*/
function emptyWork(actNo) {
  const a = actOf(actNo) || ACTS[0];
  return {
    actNo: a.no,
    actTitle: a.title,
    actTime: a.time,
    actPlace: a.place,
    sceneTitle: '',
    logline: '',
    castMap: {},          /* 배역key → 학번 */
    lines: [],            /* {id, kind:'dir'|'say', who, text, by, at} */
    numberTitle: a.numberHint.title,
    lyrics: [],           /* {id, who, text, by, at} */
    prompt: { genre: '', mood: '', inst: '', vocal: '' },
    structure: '',
    demo: { a: '', b: '', pick: '', why: '', link: '' },
    staging: '',
    submitted: false,
    submittedAt: '',
    rev: 0
  };
}
