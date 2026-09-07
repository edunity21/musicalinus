/* ============================================================================
 *  config.js — ★ 여기 세 줄만 고치면 됩니다 ★
 *  MUSICALINUS 제작소 · 승평중학교 음악과
 * ==========================================================================*/

/* ★ 1. Apps Script 웹앱 주소.
      Code.gs 를 배포한 뒤 받은 /exec 주소를 그대로 붙여 넣으세요. */
const SERVER_URL = 'https://script.google.com/macros/s/AKfycbyjnJEC8JWgunbhP0gtvw3blVm3YSAdBYAjfbmJmBPz49wbPHXpU5llMj-cHuFAbzp0/exec';

/* ★ 2. 구글 클라이언트 ID.
      음악 산업 탐구(musicjob)에서 쓰던 것을 그대로 써도 됩니다.
      승인된 자바스크립트 원본이 https://edunity21.github.io 로 되어 있으면 통합니다. */
const GOOGLE_CLIENT_ID = '432757752918-5i46ftsts6163gtqvrulquiu0n0sklaq.apps.googleusercontent.com';

/* ★ 3. 허용할 학교 계정 도메인 (앞에 @ 없이) */
const ALLOWED_DOMAIN = 'ai.jne.kr';

/* --------------------------------------------------------------------------
 *  아래는 필요할 때만 고치세요.
 * ------------------------------------------------------------------------*/

/* 학급 목록. 학번 두 번째 자리로 반을 판별합니다. (예: 3301 → 3학년 3반 1번) */
const CLASS_LIST = ['3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8', '3-9'];

/* 학급마다 모둠 몇 개인지. 여섯 모둠 = 여섯 막입니다.
   ※ 이 숫자를 바꾸면 Code.gs 의 GROUP_COUNT 와 story.js 의 ACTS 길이도 함께 맞춰야 합니다. */
const GROUP_COUNT = 6;

/* 서버 상태를 몇 초마다 확인할지. (너무 짧으면 구글 할당량을 많이 씁니다) */
const POLL_SECONDS = 20;

/* 모둠원이 고친 내용을 몇 초마다 받아올지. */
const SYNC_SECONDS = 12;

/* 교사 화면 자동 로그아웃 시간(분). */
const TEACHER_IDLE_MINUTES = 20;
