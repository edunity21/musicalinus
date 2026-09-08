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

const STORY_VERSION = 'story v1.3.0 (2026-09-08) 예시자료';

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
  { key: 'ens1',    name: '앙상블A', line: '중3 교실의 다양한 개성과 고민을 가진 친구 (모둠이 이름을 붙입니다)', color: '#B96BD8' },
  { key: 'ens2',    name: '앙상블B', line: '중3 교실의 다양한 개성과 고민을 가진 친구 (모둠이 이름을 붙입니다)', color: '#00C2C7' }
];
const castOf = k => CAST.find(c => c.key === k) || null;
const castName = k => (castOf(k) ? castOf(k).name : (k === 'all' ? '전원' : k || ''));

/* ---------------------------------------------------------------------------
 *  2. 제작 역할 — 모둠 안에서 나누어 맡습니다
 *     한 사람이 배역 하나 + 제작 역할 하나를 맡습니다.
 *     기본은 다섯 자리(대본·작사·작곡·편곡·발표)입니다. 학급 30명이면 6모둠 × 5명.
 * -------------------------------------------------------------------------*/
const JOBS = [
  { key: 'script', name: '대본 리더', icon: '✎',
    duty: '막 제목·시간대·무대 배경을 정하고, 장면 지문(무대 지시)을 씁니다. 대사 순서도 정리합니다.',
    owns: ['막 설정', '지문', '대사 순서'],
    hint: ['이 막은 하루의 어느 시간인가?',
           '무대에 무엇이 놓여 있어야 관객이 그 장소를 알아볼까?',
           '인물은 무엇을 하다가 서로 만나는가?'] },
  { key: 'lyric',  name: '작사 리더', icon: '✍',
    duty: '넘버의 가사를 씁니다. 어느 인물이 어느 줄을 부르는지 파트를 나눕니다.',
    owns: ['넘버 제목', '가사'],
    hint: ['이 막의 감정을 한 낱말로 하면 무엇인가?',
           '그 낱말이 가사 어느 줄에 들어가는가?',
           '누가 혼자 부르고, 어디서부터 다 같이 부르는가?'] },
  { key: 'compose', name: '작곡 리더', icon: '♪',
    duty: 'Suno에 넣을 프롬프트 네 칸(장르·분위기·악기·보컬 구성)을 채웁니다.',
    owns: ['Suno 프롬프트'],
    hint: ['이 막의 감정에 맞는 빠르기는 느린가 빠른가?',
           '가장 먼저 들려야 할 악기는 무엇인가?',
           '보컬 구성이 가사의 파트 배분과 맞는가?'] },
  { key: 'arrange', name: '편곡 리더', icon: '≋',
    duty: '넘버의 구성(전주–벌스–후렴–브릿지)을 짜고, 만든 데모 두 개를 견주어 하나를 고릅니다.',
    owns: ['넘버 구성', '데모 비교'],
    hint: ['어느 부분에서 사람이 늘어나고, 어디서 가장 커지는가?',
           '데모 A와 B 가운데 우리 막의 감정에 맞는 것은?',
           '고른 이유를 「음악 요소 때문에」로 말할 수 있는가?'] },
  { key: 'stage',   name: '발표 리더', icon: '▲',
    duty: '배역을 배정하고 등·퇴장, 소품, 조명 큐를 적습니다. 모둠 작품을 최종 제출합니다.',
    owns: ['연출 노트', '제출'],
    hint: ['누가 어느 인물을 맡는가?',
           '인물은 무대 어디로 들어오고 어디로 나가는가?',
           '꼭 있어야 할 소품 하나는 무엇인가?'] },
  /* 여섯 번째 자리. 다섯 자리가 다 찬 모둠에서만 열립니다.
     학급이 30명이면(6모둠 × 5명) 학생 화면에 아예 나타나지 않습니다. */
  { key: 'script2', name: '공동 대본', icon: '✎',
    duty: '대본 리더와 함께 지문과 대사를 씁니다. 다섯 자리가 다 찬 모둠에만 열리는 여섯 번째 자리입니다.',
    owns: ['지문', '대사 순서'], optional: true }
];
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
      scene: '아침의 소음과 등교',
      logline: '늦잠에서 깨어난 지후가 서툰 꿈이 적힌 메모지를 주머니에 넣고 집을 나선다.',
      dir: ['요란하고 기계적인 알람 소리가 무대를 가득 채운다. 지후가 괴로워하며 이불을 뒤집어쓴다.'],
      lines: [
        { who: 'jihoo',  text: '(이불 속에서 기어 나오며) 아, 진짜… 알람 소리가 무슨 전쟁 선포 같아. 5분만 더…' },
        { who: 'minseo', text: '야! 이지후! 아침부터 왜 이렇게 영혼이 가출했냐? 얼굴에 「나 졸림」이라고 써 붙였네!' },
        { who: 'jihoo',  text: '아, 깜짝이야! 강민서, 너는 아침부터 에너지가 어디서 그렇게 넘쳐나냐?' },
        { who: 'minseo', text: '야, 오늘이 무슨 날인지 잊었어? 1교시 수학인 거 알지?' }
      ],
      numberTitle: '중3의 아침',
      lyrics: [
        { who: 'jihoo',  text: '아침 일찍 울리는 알람 소리에' },
        { who: 'jihoo',  text: '지친 몸을 일으켜 겨우 눈을 떠' },
        { who: 'minseo', text: '야, 지후! 오늘 1교시 수학인 거 알지?' },
        { who: 'minseo', text: '벌써부터 칠판이 흐릿해 보여' },
        { who: '',       text: '우리는 중학교 3학년, 매일이 아슬아슬해' }
      ],
      prompt: {
        genre: 'K-Pop Musical, Bright upbeat J-Rock, Orchestral Pop',
        mood:  'Energetic, hopeful yet slightly overwhelmed, youthful, emotional pre-chorus',
        inst:  'Acoustic guitar introduction, driving drums, soaring strings, electric guitar chord riffs',
        vocal: 'Male solo (mellow, emotional) → Male solo 2 (energetic, bright) → Full high-school chorus (unison, powerful harmony)'
      }
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
      scene: '칠판 뒤의 그림자',
      logline: '성적표 앞에서 무너진 유나에게 민서가 장난을 걸고, 지후가 조심스럽게 사이에 선다.',
      dir: ['2교시가 끝나는 종이 울린다. 유나는 자리에 앉아 성적표를 매섭게 노려보고 있다. 손이 미세하게 떨린다.'],
      lines: [
        { who: 'yuna',   text: '(성적표를 꽉 쥐며) 지난번보다 또 2점 떨어졌어… 이 숫자 하나가 대체 내 미래를 어떻게 결정짓는 걸까?' },
        { who: 'minseo', text: '에이, 유나야! 반장! 얼굴 좀 풀어라. 1점 떨어진 게 인생 망하는 것도 아닌데 왜 그래?' },
        { who: 'yuna',   text: '(날카롭게) 너한테는 1점이 장난이지? 난 지금 숨이 안 쉬어지는데 넌 맨날 싱글벙글이니까 짜증 나.' },
        { who: 'jihoo',  text: '유나야, 너무 민서 탓하지 마. 나도 마음은 자꾸 창밖 구름을 따라 날아가 버려. 그게 너무 무서워.' }
      ],
      numberTitle: '칠판 위의 걱정들',
      lyrics: [
        { who: 'yuna',   text: '모의고사 성적표에 긴 한숨 내쉬고' },
        { who: 'yuna',   text: '빨간 줄 그어진 점수를 바라봐' },
        { who: 'yuna',   text: '내가 진짜 원하는 게 뭔지도 모른 채' },
        { who: 'jihoo',  text: '시험지 위에 빽빽하게 적힌 질문들, 여기 적힌 게 정말 정답일까' },
        { who: '',       text: '괜찮아, 아직은 정답을 모른대도' }
      ],
      prompt: {
        genre: 'Dramatic Musical Ballad, Contemporary Pop',
        mood:  'Melancholic, anxious, building up to powerful emotional resolution, cinematic',
        inst:  'Piano arpeggio, cello, slow acoustic drums, epic strings swell in chorus',
        vocal: 'Female solo (clear, emotional, desperate) → Male solo (soft, resonant) → Duet → High school choir (heavy harmony)'
      }
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
    onstage: ['minseo', 'yuna', 'jihoo', 'ens1', 'ens2'],
    sample: {
      scene: '3소박의 열기',
      logline: '종이 울리자 운동장과 급식실이 뒤집힌다. 45분 동안만은 모두가 주인공이다.',
      dir: ['4교시 종료 종소리가 울리자마자 암전되었던 무대가 밝아지며 학생들이 괴성을 지르며 운동장으로 쏟아져 나온다.'],
      lines: [
        { who: 'minseo', text: '(공을 가로채며) 이지후! 멍 때리지 말고 패스! 이 순간만큼은 전 세계가 다 우리 거야!' },
        { who: 'jihoo',  text: '(무릎을 잡고 숨을 헐떡이며) 아, 아깝다! 강민서, 넌 축구할 때 보면 진짜 딴 사람 같다.' },
        { who: 'yuna',   text: '얘들아! 냄새 대박이야. 오늘 돈가스에 소스 따로 달라고 해야 해!' },
        { who: 'ens1',   text: '와! 대박! 오늘 하루의 스트레스 급식으로 다 푼다!' }
      ],
      numberTitle: '3소박의 열기',
      lyrics: [
        { who: 'minseo', text: '점심시간 종소리는 우리들의 해방 공간' },
        { who: 'minseo', text: '운동장에 모여 먼지 날리며' },
        { who: 'minseo', text: '축구공 하나로 온 세상을 다 누벼!' },
        { who: 'jihoo',  text: '우울했던 교실에도 환호성이 터지지' },
        { who: '',       text: '별거 아닌 순간도 특별해지는 마법' }
      ],
      prompt: {
        genre: 'Funk Pop, High-energy Musical Theatre, Brass Ensemble',
        mood:  'Extremely cheerful, funky, celebratory, rhythmic, clapping sounds',
        inst:  'Slap bass, bright brass section (trumpet, saxophone), funky electric guitar, upbeat drums',
        vocal: 'Male solo (groovy) → Male solo 2 → Group chant and call-and-response → High-energy ensemble harmony'
      }
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
      scene: 'ME 프로젝트(뮤직 에세이) 수업',
      logline: '점수가 없는 수업 앞에서, 평범한 하루가 노래가 될 수 있다는 것을 처음 알게 된다.',
      dir: ['학생들이 각자 태블릿과 헤드폰을 하나씩 쥐고 앉아 있다. 선생님이 무대 중앙에 서서 아이들을 맞이한다.'],
      lines: [
        { who: 'teacher', text: '자, 여러분. 이번 학기 가장 중요한 ME 프로젝트, 뮤직 에세이 수업이에요. 다들 태블릿 전원 켰나요?' },
        { who: 'yuna',    text: '선생님, 이 프로젝트도 수행평가에 반영되는 거죠? 정확한 평가 기준이 어떻게 되나요?' },
        { who: 'teacher', text: '(인자하게 미소 지으며) 이 수업엔 그런 기준이 없단다. 오직 너희들의 솔직한 진심만 있으면 돼.' },
        { who: 'jihoo',   text: '저는… 제 평범한 일상을 노래하고 싶어요. 생각해보니 이 평범함이 꽤 소중하고 따뜻한 것 같거든요.' }
      ],
      numberTitle: '나를 위한 에세이',
      lyrics: [
        { who: 'jihoo',  text: '학교 복도 끝 창문 너머로' },
        { who: 'jihoo',  text: '부드러운 봄 햇살이 내 어깨를 두드려' },
        { who: 'jihoo',  text: '정신없이 흘러가는 이 평범한 일상이' },
        { who: 'jihoo',  text: '사실은 정말 귀하고 예쁜 것이란 걸' },
        { who: 'yuna',   text: '「괜찮아, 오늘도 너는 잘 해냈어」' }
      ],
      prompt: {
        genre: 'Acoustic Pop Ballad, Lo-fi Indie, Warm Musical-style',
        mood:  'Introspective, warm, comforting, emotional, self-accepting',
        inst:  'Gentle acoustic piano, acoustic guitar picking, soft synth pad, ambient shaker',
        vocal: 'Male solo (pure, conversational tone) → Soft backing vocals (male/female harmony) → Gradual crescendo in chorus'
      }
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
      scene: '고등학교 검색창과 두려움',
      logline: '검색창 앞에서 각자의 두려움이 드러나고, 다른 길인데 같은 자리에 서 있음을 알게 된다.',
      dir: ['지후와 민서가 나란히 걸으며 스마트폰을 들여다보고 있다. 두 사람의 그림자가 길게 늘어져 있다.'],
      lines: [
        { who: 'minseo', text: '(한숨을 푹 쉬며) 체육고 입시 요강을 보는데 실기 비중이 70%래. 나 고등학교 갈 수는 있냐?' },
        { who: 'jihoo',  text: '나도 그래. 다들 유치원 때부터 피아노 친 애들이 태반이래. 내가 헛꿈을 꾸는 건지 무서워졌어.' },
        { who: 'yuna',   text: '난 엄마가 지정해 준 특목고 커트라인을 보는데, 심장이 쿵쾅거려서 꺼버렸어. 내가 기계가 된 것 같아.' },
        { who: 'jihoo',  text: '우리, 겉으로는 다 다른 길을 가는 것 같아도… 결국 똑같은 두려움 앞에 서 있네.' }
      ],
      numberTitle: '고등학교 검색창',
      lyrics: [
        { who: 'minseo', text: '노을빛으로 붉게 물든 학원 가는 길' },
        { who: 'minseo', text: '무거운 문제집 사이로 내 꿈을 작게 적어봐' },
        { who: 'yuna',   text: '설레는 마음 한 칸, 두려운 마음 한 칸이' },
        { who: 'yuna',   text: '매일 밤 풍선처럼 자꾸만 커져가' },
        { who: '',       text: '너와 내가 여기 함께라서 다시 용기를 내' }
      ],
      prompt: {
        genre: 'Emotional Rock Ballad, Teen-Angst Musical Pop',
        mood:  'Heavy-hearted, anxious yet consoling, powerful electric guitar chorus, cinematic catharsis',
        inst:  'Electric guitar distortion, heavy drum backbeat, synth bass, dramatic string orchestra',
        vocal: 'Male duet (soft/husky) → Female solo (powerful belting) → Trio blend → Full ensemble chorus'
      }
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
    onstage: ['yuna', 'jihoo', 'minseo', 'teacher', 'ens1', 'ens2'],
    sample: {
      scene: '피날레 — 찬란한 3학년',
      logline: '무대가 끝나고 숨을 몰아쉬며, 지나온 시간이 헛되지 않았음을 서로에게 증명한다.',
      dir: ['축제 무대 공연을 막 마친 듯, 거친 숨을 몰아쉬며 감격에 겨운 아이들. 유나가 눈물이 고인 눈으로 대형 스크린을 바라본다.'],
      lines: [
        { who: 'yuna',    text: '얘들아… 우리가 보낸 이 중3의 시간들이, 정말 의미가 있었을까? 졸업하면 다 잊혀지는 건 아닐까?' },
        { who: 'jihoo',   text: '(낡은 메모지를 꺼내 보여주며) 아니, 절대 잊혀지지 않아. 이 노래들이 우리가 여기 뜨겁게 존재했다는 걸 증명해 주고 있어.' },
        { who: 'minseo',  text: '(어깨를 꽉 감싸 안으며) 이지후 말이 백번 맞아! 우리는 영원한 3소박이잖아!' },
        { who: 'teacher', text: '너희들의 찬란한 에세이는 이제 겨우 첫 페이지를 넘겼을 뿐이란다. 다음 페이지를 써 내려가렴.' }
      ],
      numberTitle: '피날레 — 우리의 3학년이 빛나게',
      lyrics: [
        { who: '', text: '우리는 중학교 3학년, 거친 세상의 첫 관문' },
        { who: '', text: '가장 반짝이는 청춘의 소중한 한 페이지' },
        { who: '', text: '평범하고 지루했던 하루하루가 모여서' },
        { who: '', text: '가장 아름다운 기억의 꽃을 피우네' },
        { who: '', text: '우리의 뜨거운 3학년이 영원히 빛나게!' }
      ],
      prompt: {
        genre: 'Grand Finale Musical Pop, Uplifting Orchestral Anthem, Broadway style',
        mood:  'Triumphant, nostalgic, deeply emotional, explosive joy, celebratory',
        inst:  'Full symphonic orchestra (timpani, brass, strings), piano, triumphant drums, acoustic guitar backing',
        vocal: 'All-cast unison → High-pitch soprano belt → Male ad-libs → Massive multi-layered choir harmony'
      }
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
