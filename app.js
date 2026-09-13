/* ============================================================================
 *  app.js — MUSICALINUS 제작소 · 학생 화면
 *  버전: student v1.0.0 (2026-09-07)
 *
 *  큰 흐름
 *    구글 로그인 → 학번·비밀번호 확인 → (모둠·역할이 없으면) 자리 고르기 →
 *    본 화면: 뼈대 · 막 설계 · 장면 대본 · 넘버 · 파일 · 미리보기/제출
 *
 *  저장은 '내가 담당한 칸만' 서버에 보냅니다. 모둠원이 각자 보낸 것을
 *  서버가 하나로 합쳐 주기 때문에 서로의 글이 지워지지 않습니다.
 * ==========================================================================*/

const APP_VERSION = 'student v2.1.0 (2026-09-13) 화면녹음';

/* ---------------------------------------------------------------------------
 *  0. 지금 상태
 * -------------------------------------------------------------------------*/
const S = {
  sid: '', name: '', cls: '', group: 0, job: '', role: '',
  work: null, members: [], state: null, videos: [], videoForm: null,
  dirty: {}, lineOps: [], lyricOps: [],
  saving: false, lastSent: '', renderedRev: -1, tab: 'story',
  pollTimer: null, syncTimer: null, saveTimer: null
};
/* ★ v1.6 — counts 는 여섯 모둠의 인원을 담습니다. timer 는 8초마다 그것을 새로 받습니다. */
const JOIN = { group: 0, job: '', role: '', counts: null, timer: null, busy: false };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const lsKey = () => 'mus_' + S.cls + '_' + S.sid;

/* ===========================================================================
 *  1. 로그인
 * =========================================================================*/

window.addEventListener('DOMContentLoaded', function () {
  $('#verLine').textContent = [APP_VERSION, STORY_VERSION, COMMON_VERSION].join(' · ');
  console.log('[MUSICALINUS]', APP_VERSION, STORY_VERSION, COMMON_VERSION);

  if (!SERVER_URL) {
    $('#gateMsg').innerHTML = '<span class="err">config.js 의 SERVER_URL 이 비어 있습니다. 선생님께 알려 주세요.</span>';
  }
  Auth.render($('#gsiBtn'), onLogin);

  $('#btnEnterMe').addEventListener('click', () => enter(S.sid, S.name, $('#inPwMe').value));
  $('#btnEnter').addEventListener('click', () => enter($('#inSid').value.trim(), $('#inName').value.trim(), $('#inPw').value));
  $('#inPwMe').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnEnterMe').click(); });
  $('#inPw').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnEnter').click(); });
  $('#lnkManual').addEventListener('click', e => {
    e.preventDefault();
    $('#stepMe').classList.add('off'); $('#step2').classList.remove('off'); $('#inSid').focus();
  });
  $('#btnJoin').addEventListener('click', doJoin);
  $('#btnJoinAny').addEventListener('click', doJoinAny);   /* v1.6 */
  bindApp();
  bindFiles();
});

async function onLogin(payload) {
  $('#whoLine').textContent = (payload.email || '') + ' 로 로그인했습니다.';
  gmsg('명렬표에서 확인하는 중…');
  const res = await apiPost('whoAmI', { idToken: Auth.idToken }, 12000);
  if (!res.ok) { gmsg('<span class="err">' + esc(errText(res)) + '</span>'); return; }

  if (res.linked) {
    S.sid = res.sid; S.name = res.name; S.cls = res.cls;
    S.group = res.group || 0; S.job = res.job || ''; S.role = res.role || '';
    $('#meCard').innerHTML =
      '<div class="me-no">' + esc(res.sid) + '</div>' +
      '<div class="me-name">' + esc(res.name) + '</div>' +
      '<div class="me-sub">' + esc(res.cls) + (res.group ? ' · ' + res.group + '모둠 ' + esc(jobName(res.job)) : '') + '</div>' +
      '<div class="me-ok">✓ 명렬표에서 찾았습니다</div>';
    $('#step1').classList.add('off');
    $('#stepMe').classList.remove('off');
    $('#inPwMe').focus();
    gmsg('');
  } else {
    $('#step1').classList.add('off');
    $('#step2').classList.remove('off');
    $('#inSid').focus();
    gmsg('처음 들어오는 계정입니다. 학번과 이름을 넣어 주세요.');
  }
}

function gmsg(html) { $('#gateMsg').innerHTML = html || ''; }

async function enter(sid, name, pw) {
  if (!/^\d{4}$/.test(String(sid))) { gmsg('<span class="err">학번 네 자리를 넣어 주세요.</span>'); return; }
  if (!Auth.alive()) { gmsg('<span class="err">로그인이 만료되었습니다. 새로고침 뒤 다시 로그인해 주세요.</span>'); return; }
  gmsg('확인하는 중…');

  const res = await apiPost('gate', { idToken: Auth.idToken, sid: sid, name: name, pw: pw });
  if (!res.ok) { gmsg('<span class="err">' + esc(errText(res)) + '</span>'); return; }

  S.sid = res.sid; S.name = res.name; S.cls = res.cls; S.state = res.state;
  S.videoForm = res.videoForm || S.videoForm;
  S.group = res.group || 0; S.job = res.job || ''; S.role = res.role || '';

  if (!S.group || !S.job || !S.role) { openJoin(); return; }
  await startApp();
}

/* ===========================================================================
 *  2. 모둠·역할 고르기
 * =========================================================================*/

function openJoin() {
  $('#gate').classList.add('hidden');
  $('#join').classList.remove('hidden');
  $('#joinWho').innerHTML = esc(S.cls) + ' ' + esc(S.name) + ' · 먼저 우리 모둠과 내가 맡을 일을 고릅니다.';

  /* ① 모둠(=막) 카드. 인원은 loadCounts 가 채웁니다. */
  $('#joinActs').innerHTML = ACTS.map(a =>
    '<button class="actcard" type="button" data-g="' + a.no + '" aria-pressed="false">' +
      '<div class="an">' + a.no + '모둠 · 제' + a.no + '막' +
        '<span class="seat" data-seat="' + a.no + '">…</span></div>' +
      '<div class="at">' + esc(a.title) + '</div>' +
      '<div class="ap">' + esc(a.time) + '</div>' +
      '<div class="ax">♪ ' + esc(a.numberHint.title) + ' · ' + esc(a.numberHint.genre) + '</div>' +
    '</button>').join('');
  $$('#joinActs .actcard').forEach(b => b.addEventListener('click', () => {
    if (b.disabled) return;
    JOIN.group = Number(b.dataset.g);
    $$('#joinActs .actcard').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    paintTaken();
  }));

  /* ② 제작 역할 — ★ v1.6: 학생이 고를 수 있는 다섯 자리만 보여 줍니다.
     '공동 대본' 은 선생님이 넣어 주는 예비 자리라 여기에 없습니다. */
  $('#joinJobs').innerHTML = STUDENT_JOBS.map(j =>
    '<button type="button" data-j="' + j.key + '" aria-pressed="false">' + j.icon + ' ' + esc(j.name) + '</button>').join('');
  $$("#joinJobs button").forEach(b => b.addEventListener('click', () => {
    if (b.disabled) return;
    JOIN.job = b.dataset.j;
    $$("#joinJobs button").forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    $('#joinJobDuty').textContent = jobOf(JOIN.job) ? jobOf(JOIN.job).duty : '';
  }));

  /* ③ 배역 */
  $('#joinRoles').innerHTML = CAST.map(c =>
    '<button type="button" data-r="' + c.key + '" aria-pressed="false">' + esc(c.name) + '</button>').join('');
  $$('#joinRoles button').forEach(b => b.addEventListener('click', () => {
    if (b.disabled) return;
    JOIN.role = b.dataset.r;
    $$('#joinRoles button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    const c = castOf(JOIN.role);
    $('#joinRoleLine').textContent = c ? c.line : '';
  }));

  loadCounts(true);
  clearInterval(JOIN.timer);
  JOIN.timer = setInterval(() => loadCounts(false), (typeof SEAT_POLL_SECONDS === 'number' ? SEAT_POLL_SECONDS : 8) * 1000);
}

function joinMsg(html, bad) {
  $('#joinMsg').innerHTML = html ? (bad ? '<span class="err">' + html + '</span>' : html) : '';
}

/* ---------------------------------------------------------------------------
 *  ★ v1.6 — 여섯 모둠의 인원을 한 번에 받아 옵니다. 8초마다 스스로 다시 받습니다.
 *  다 찬 모둠은 눌리지 않게 잠급니다.
 * -------------------------------------------------------------------------*/
async function loadCounts(loud) {
  if (loud) joinMsg('모둠 자리를 확인하는 중…');
  const res = await apiPost('groupCounts', { idToken: Auth.idToken, sid: S.sid, cls: S.cls }, 15000);
  if (!res.ok) { if (loud) joinMsg(esc(errText(res)), true); return; }
  JOIN.counts = res;
  if (loud) joinMsg('');
  paintCounts();
  paintTaken();
}

function paintCounts() {
  const r = JOIN.counts;
  if (!r) return;
  const size = r.size || (typeof GROUP_SIZE === 'number' ? GROUP_SIZE : 5);
  let left = 0;
  r.groups.forEach(g => {
    const tag = $('#joinActs .seat[data-seat="' + g.group + '"]');
    if (tag) {
      tag.textContent = g.n + '/' + size;
      tag.className = 'seat' + (g.full ? ' full' : (g.n >= size - 1 ? ' near' : ''));
    }
    const card = $('#joinActs .actcard[data-g="' + g.group + '"]');
    if (card) {
      const mine = (g.members || []).some(m => m.sid === S.sid);
      const lock = g.full && !mine;
      card.disabled = lock;
      card.classList.toggle('taken', lock);
      if (lock && JOIN.group === g.group) {
        JOIN.group = 0;
        card.setAttribute('aria-pressed', 'false');
        joinMsg('고르던 모둠이 방금 다 찼습니다. 다른 모둠을 골라 주세요.', true);
      }
    }
    if (!g.full) left += (size - g.n);
  });
  $('#joinLeft').textContent = left ? ('지금 남은 자리 ' + left + '개') : '여섯 모둠이 모두 찼습니다';
  $('#btnJoinAny').disabled = !left;
}

/** 고른 모둠에서 이미 찬 제작 역할·배역을 잠급니다. */
function paintTaken() {
  const r = JOIN.counts;
  const size = (r && r.size) || (typeof GROUP_SIZE === 'number' ? GROUP_SIZE : 5);
  const g = (r && JOIN.group) ? r.groups.find(x => x.group === JOIN.group) : null;
  const mates = g ? (g.members || []).filter(m => m.sid !== S.sid) : [];

  $('#joinMates').innerHTML = !JOIN.group
    ? '<span class="dim">먼저 위에서 모둠을 고르세요.</span>'
    : (mates.length
      ? '<span class="dim" style="width:100%">이미 자리를 잡은 모둠원 ' + mates.length + ' / ' + size + '</span>' +
        mates.map(m => mateChip(m)).join('')
      : '<span class="dim">아직 아무도 들어오지 않았습니다. 첫 번째입니다.</span>');

  $$("#joinJobs button").forEach(b => {
    const t = mates.some(m => m.job === b.dataset.j);
    b.disabled = t;
    if (t && JOIN.job === b.dataset.j) { JOIN.job = ''; b.setAttribute('aria-pressed', 'false'); $('#joinJobDuty').textContent = ''; }
  });
  $$('#joinRoles button').forEach(b => {
    const t = mates.some(m => m.role === b.dataset.r);
    b.disabled = t;
    if (t && JOIN.role === b.dataset.r) { JOIN.role = ''; b.setAttribute('aria-pressed', 'false'); $('#joinRoleLine').textContent = ''; }
  });
}

async function doJoin() {
  if (JOIN.busy) return;
  if (!JOIN.group) { joinMsg('모둠을 고르세요.', true); return; }
  if (!JOIN.job)   { joinMsg('제작 역할을 고르세요.', true); return; }
  if (!JOIN.role)  { joinMsg('배역을 고르세요.', true); return; }
  JOIN.busy = true; $('#btnJoin').disabled = true; $('#btnJoinAny').disabled = true;
  joinMsg('자리를 잡는 중…');

  const res = await apiPost('groupJoin', {
    idToken: Auth.idToken, sid: S.sid, name: S.name,
    group: JOIN.group, job: JOIN.job, role: JOIN.role
  }, 20000);

  JOIN.busy = false; $('#btnJoin').disabled = false;
  if (!res.ok) {
    const who = (res.error === 'JOB_TAKEN' || res.error === 'ROLE_TAKEN') && res.message
      ? ' (' + esc(res.message) + ' 학생이 맡았습니다)' : '';
    joinMsg(esc(errText(res)) + who, true);
    await loadCounts(false);
    return;
  }
  await finishJoin(res);
}

/* ---------------------------------------------------------------------------
 *  ★ v1.6 — [남은 자리 아무거나 받기]
 *  서버가 빈자리를 찾아 앉혀 줍니다. 다툼에서 지면 다음 빈자리로 스스로 다시 시도합니다.
 * -------------------------------------------------------------------------*/
async function doJoinAny() {
  if (JOIN.busy) return;
  JOIN.busy = true; $('#btnJoin').disabled = true; $('#btnJoinAny').disabled = true;
  joinMsg('남은 자리를 찾는 중…');

  let res = null;
  for (let i = 0; i < 4; i++) {
    res = await apiPost('groupJoinAny', { idToken: Auth.idToken, sid: S.sid, name: S.name }, 25000);
    if (res.ok) break;
    if (res.error !== 'BUSY' && res.error !== 'GROUP_FULL') break;
    joinMsg('다른 친구가 먼저 앉았습니다. 다음 빈자리를 찾는 중… (' + (i + 2) + '번째)');
    await sleep(700 + i * 600);
  }

  JOIN.busy = false; $('#btnJoin').disabled = false; $('#btnJoinAny').disabled = false;
  if (!res || !res.ok) { joinMsg(esc(errText(res)), true); await loadCounts(false); return; }
  toast(res.group + '모둠 · ' + jobName(res.job) + ' · ' + castName(res.role) + ' 자리를 받았습니다', 'ok', 4500);
  await finishJoin(res);
}

async function finishJoin(res) {
  clearInterval(JOIN.timer); JOIN.timer = null;
  S.group = res.group; S.job = res.job; S.role = res.role;
  $('#join').classList.add('hidden');
  await startApp();
}

/* ===========================================================================
 *  3. 본 화면 시작
 * =========================================================================*/

async function startApp() {
  $('#gate').classList.add('hidden');
  $('#join').classList.add('hidden');
  $('#app').classList.remove('hidden');

  $('#whoBox').textContent = S.cls + ' ' + S.name;
  $('#subTitle').textContent = S.group + '모둠 · 제' + S.group + '막 · ' + jobName(S.job);
  $('#showTitle').textContent = SHOW.title;
  $('#showSub').textContent = SHOW.subtitle + ' · ' + SHOW.genre + ' · ' + SHOW.target;

  const cached = LS.get(lsKey(), null);
  if (cached && cached.work) S.work = cached.work;

  renderStory();
  await sync(true);
  loadStages(false);     /* ★ v2.0 — 제작 공정은 뒤에서 조용히 받아 둡니다 */
  poll();
  S.pollTimer = setInterval(poll, POLL_SECONDS * 1000);
  S.syncTimer = setInterval(() => sync(false), SYNC_SECONDS * 1000);
  window.addEventListener('beforeunload', flushBeacon);
}

function bindApp() {
  $$('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
  $('#btnGoScene').addEventListener('click', () => showTab('scene'));
  $('#btnLogout').addEventListener('click', () => {
    if (!confirm('나가시겠습니까? 이 기기에 남은 임시 내용이 지워집니다.')) return;
    LS.del(lsKey()); Auth.signOut(); location.reload();
  });
  $('#btnAddLine').addEventListener('click', addLine);
  $('#addText').addEventListener('keydown', e => { if (e.key === 'Enter') addLine(); });
  $('#btnAddLyric').addEventListener('click', addLyric);
  $('#addLyricText').addEventListener('keydown', e => { if (e.key === 'Enter') addLyric(); });
  $('#btnSaveScene').addEventListener('click', () => save(true));
  $('#btnSaveNumber').addEventListener('click', () => save(true));
  $('#btnSyncScene').addEventListener('click', () => sync(true));
  $('#btnSyncNumber').addEventListener('click', () => sync(true));
  $('#btnSubmit').addEventListener('click', doSubmit);
  $('#btnPrint').addEventListener('click', () => window.print());
  $('#btnExport').addEventListener('click', exportText);
  $('#btnCopyPrompt').addEventListener('click', copyPrompt);

  /* 담당 칸들 */
  bindField('#fActTitle', 'actTitle'); bindField('#fActTime', 'actTime');
  bindField('#fActPlace', 'actPlace'); bindField('#fSceneTitle', 'sceneTitle');
  bindField('#fLogline', 'logline');   bindField('#fNumberTitle', 'numberTitle');
  bindField('#fStructure', 'structure'); bindField('#fStaging', 'staging');
  ['#fDemoA', '#fDemoB', '#fDemoPick', '#fDemoWhy', '#fDemoLink'].forEach(sel => {
    const el = $(sel); if (!el) return;
    el.addEventListener('input', onDemo); el.addEventListener('change', onDemo);
  });
}

function bindField(sel, key) {
  const el = $(sel); if (!el) return;
  el.addEventListener('input', () => {
    if (!S.work) return;
    S.work[key] = el.value;
    S.dirty[key] = el.value;
    touch();
  });
}
function onDemo() {
  if (!S.work) return;
  S.work.demo = {
    a: $('#fDemoA').value, b: $('#fDemoB').value, pick: $('#fDemoPick').value,
    why: $('#fDemoWhy').value, link: $('#fDemoLink').value
  };
  S.dirty.demo = S.work.demo;
  touch();
}

function showTab(name) {
  S.tab = name;
  $$('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === name ? 'true' : 'false'));
  $$('.panel').forEach(p => { p.hidden = (p.id !== 'panel-' + name); });
  if (name === 'out') { renderChecks(); renderPreview(); }
  /* ★ v2.0 — 제작·갤러리 탭은 열 때 서버에서 받아옵니다 */
  if (name === 'make' && !MK.loaded) loadStages(true);
  if (name === 'gallery') loadGallery(!MK.gallery);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ===========================================================================
 *  4. 서버와 맞추기
 * =========================================================================*/

async function poll() {
  try {
    const r = await apiGet({ action: 'config', cls: S.cls });
    if (r && r.ok) { S.state = r.state; paintStatus(); }
  } catch (e) { /* 조용히 넘어갑니다 */ }
}

async function sync(loud) {
  if (loud) setSave('받아오는 중…');
  const res = await apiPost('groupState', {
    idToken: Auth.idToken, sid: S.sid, cls: S.cls, group: S.group
  });
  if (!res.ok) { if (loud) toast(errText(res), 'bad'); setSave('연결 안 됨'); return; }
  S.state = res.state; S.members = res.members || [];
  S.videos = res.videos || [];
  S.videoForm = res.videoForm || S.videoForm;
  mergeWork(res.work);
  paintStatus();
  paintAll();
  if (loud) { setSave('받아왔습니다'); toast('모둠원이 쓴 내용을 받아왔습니다', 'ok'); }
}

/** 서버 것을 받되, 내가 지금 고치고 있는 칸은 건드리지 않습니다. */
function mergeWork(server) {
  if (!server) return;
  /* 깊은 복사 — 서버가 준 것을 그대로 들고 있으면 우리가 고친 것이 응답 객체까지 바꿉니다. */
  if (!S.work) { S.work = JSON.parse(JSON.stringify(server)); S.renderedRev = -1; return; }
  const keep = S.dirty;
  const next = JSON.parse(JSON.stringify(server));
  Object.keys(keep).forEach(k => { next[k] = keep[k]; });
  /* 아직 서버에 못 보낸 줄 작업은 화면에서 유지 */
  S.lineOps.forEach(op => { if (op.op === 'add') next.lines = (next.lines || []).concat([opToLine(op)]); });
  S.lyricOps.forEach(op => { if (op.op === 'add') next.lyrics = (next.lyrics || []).concat([opToLine(op)]); });
  S.work = next;
  LS.set(lsKey(), { work: S.work, at: Date.now() });
}
function opToLine(op) {
  return { id: op.id, kind: op.kind || 'lyric', who: op.who, text: op.text, by: S.sid, at: '' };
}

function touch() {
  setSave('쓰는 중…');
  LS.set(lsKey(), { work: S.work, at: Date.now() });
  clearTimeout(S.saveTimer);
  S.saveTimer = setTimeout(() => save(false), 2000);
}

async function save(loud) {
  if (S.saving) { clearTimeout(S.saveTimer); S.saveTimer = setTimeout(() => save(loud), 1500); return; }
  const fields = S.dirty, lineOps = S.lineOps, lyricOps = S.lyricOps;
  if (!Object.keys(fields).length && !lineOps.length && !lyricOps.length) {
    if (loud) toast('바뀐 것이 없습니다', '', 1500);
    return;
  }
  const sig = fingerprint(JSON.stringify([fields, lineOps, lyricOps]));
  S.saving = true; setSave('저장 중…');
  S.dirty = {}; S.lineOps = []; S.lyricOps = [];

  const res = await apiPost('patch', {
    idToken: Auth.idToken, sid: S.sid, fields: fields, lineOps: lineOps, lyricOps: lyricOps
  });
  S.saving = false;

  if (!res.ok) {
    /* 실패하면 되돌려 두고 다음에 다시 보냅니다 */
    Object.keys(fields).forEach(k => { if (S.dirty[k] === undefined) S.dirty[k] = fields[k]; });
    S.lineOps = lineOps.concat(S.lineOps);
    S.lyricOps = lyricOps.concat(S.lyricOps);
    setSave('저장 실패');
    if (loud || res.error === 'ENTRY_CLOSED' || res.error === 'ALREADY_SUBMITTED') toast(errText(res), 'bad', 4200);
    return;
  }
  S.lastSent = sig;
  S.state = res.state || S.state;
  S.members = res.members || S.members;
  mergeWork(res.work);
  paintAll();
  setSave('저장됨 · ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
  if (loud) toast('저장했습니다', 'ok');
}

function flushBeacon() {
  if (!Object.keys(S.dirty).length && !S.lineOps.length && !S.lyricOps.length) return;
  apiBeacon('patch', {
    idToken: Auth.idToken, sid: S.sid,
    fields: S.dirty, lineOps: S.lineOps, lyricOps: S.lyricOps
  });
}

function setSave(t) { const el = $('#saveState'); if (el) el.textContent = t; }

function paintStatus() {
  const bar = $('#statusBar');
  if (!S.state) { bar.className = 'statusbar wait'; bar.textContent = '서버 상태를 확인하는 중…'; return; }
  const st = S.state;
  let cls = 'open', txt = '언제든 쓰고, 다 되면 [우리 막 제출하기]를 누르세요. 낸 뒤에도 고칠 수 있습니다.';
  if (st.entry !== 'open') {          /* 서버가 아직 예전 버전일 때만 나옵니다 */
    cls = 'closed';
    txt = '아직 들어올 수 없습니다. 선생님께 알려 주세요.';
  } else if (st.submit !== 'open') {
    cls = 'wait';
    txt = '지금은 쓰기만 됩니다. 계속 써 두세요.';
  }
  if (st.notice) txt += '  |  ' + st.notice;
  bar.className = 'statusbar ' + cls;
  bar.textContent = txt;
}

/* ===========================================================================
 *  5. 그리기
 * =========================================================================*/

function paintAll() {
  if (!S.work) return;
  paintRoleBars();
  paintActFields();
  paintCastMap();
  paintLines();
  paintLyrics();
  paintPrompt();
  paintArrange();
  paintFiles();
  paintVideos();
  paintMakeBits();       /* ★ v2.0 — 파일 태그·링크 칸의 모둠원 목록 */
  applyLocks();          /* 잠금은 다시 그린 뒤 마지막에 한 번 */
  paintProgress();
  $('#nowName').textContent = '제' + (S.work.actNo || S.group) + '막 · ' + (S.work.actTitle || '(제목 없음)');
  $('#nowThumb').textContent = String(S.work.actNo || S.group);
  if (S.tab === 'out') { renderChecks(); renderPreview(); }
}

function canEdit(field) {
  const owners = FIELD_OWNER[field];
  return !owners || owners.indexOf(S.job) >= 0;
}
function ownerLabel(field) {
  const owners = FIELD_OWNER[field] || [];
  return owners.map(jobName).filter((v, i, a) => a.indexOf(v) === i).join(' · ');
}

function paintRoleBars() {
  const c = castOf(S.role);
  const html =
    '<span class="rb-g">' + S.group + '모둠 · 제' + (S.work.actNo || S.group) + '막</span>' +
    '<span class="rb-sep">|</span>' +
    '<span class="tagpill on">' + (jobOf(S.job) ? jobOf(S.job).icon : '') + ' ' + esc(jobName(S.job)) + '</span>' +
    '<span class="tagpill"><span class="sw" style="background:' + (c ? c.color : '#666') + '"></span>' +
      esc(castName(S.role)) + ' 역</span>' +
    '<span class="dim" style="font-size:.84rem">' + esc(jobOf(S.job) ? jobOf(S.job).duty : '') + '</span>';
  ['#roleBar', '#roleBar2', '#roleBar3', '#roleBar4', '#roleBar5', '#roleBar6']
    .forEach(sel => { const el = $(sel); if (el) el.innerHTML = html; });
  const mates = matesHtml();
  const el = $('#sceneMates'); if (el) el.innerHTML = mates;
}

function mateChip(m) {
  const c = castOf(m.role);
  return '<span class="mate' + (m.sid === S.sid ? ' me' : '') + '">' +
    '<span class="sw" style="background:' + (c ? c.color : '#666') + '"></span>' +
    '<span class="nm">' + esc(m.name) + '</span>' +
    '<span class="jb">' + esc(castName(m.role)) + ' · ' + esc(jobName(m.job)) + '</span></span>';
}
function matesHtml() {
  if (!S.members.length) return '<span class="dim">모둠원 정보를 받아오는 중…</span>';
  const wrote = {};
  (S.work.lines || []).concat(S.work.lyrics || []).forEach(x => { wrote[x.by] = true; });
  return S.members.map(m => {
    const chip = mateChip(m);
    return wrote[m.sid] ? chip : chip.replace('class="mate', 'class="mate idle');
  }).join('') + '<span class="dim" style="font-size:.8rem; align-self:center">흐린 사람은 아직 한 줄도 쓰지 않았습니다</span>';
}

function paintActFields() {
  const w = S.work;
  setVal('#fActTitle', w.actTitle); setVal('#fActTime', w.actTime);
  setVal('#fActPlace', w.actPlace); setVal('#fSceneTitle', w.sceneTitle); setVal('#fLogline', w.logline);
  setVal('#fNumberTitle', w.numberTitle); setVal('#fStructure', w.structure); setVal('#fStaging', w.staging);

  const a = actOf(S.work.actNo || S.group);
  if (a) {
    $('#actAsk').textContent = a.ask;
    $('#actBeat').textContent = a.beat;
    $('#sampleDialogue').textContent = a.sample.dialogue;
    $('#sampleLyric').textContent = a.sample.lyric.split(' / ').join('\n');
  }
}
function setVal(sel, v) {
  const el = $(sel); if (!el) return;
  if (document.activeElement === el) return;      /* 지금 치고 있으면 건드리지 않습니다 */
  el.value = v == null ? '' : v;
}
/** 담당이 아닌 카드는 잠급니다. 다시 그린 뒤에 불러야 합니다. */
function applyLocks() {
  lockCard('#cardAct', '#tagAct', '#lockAct', 'actTitle');
  lockCard('#cardCast', '#tagCast', '#lockCast', 'castMap');
  lockCard('#cardLyric', '#tagLyric', '#lockLyric', 'numberTitle');
  lockCard('#cardPrompt', '#tagPrompt', '#lockPrompt', 'prompt');
  lockCard('#cardArrange', '#tagArrange', '#lockArrange', 'structure');
  lockCard('#cardStage', '#tagStage', '#lockStage', 'staging');
}
function lockCard(cardSel, tagSel, lockSel, field) {
  const card = $(cardSel); if (!card) return;
  const ok = canEdit(field);
  card.classList.toggle('mine', ok);
  /* data-always 가 붙은 것(복사 단추 등)은 누구나 쓸 수 있게 둡니다. */
  const inner = card.querySelectorAll('input:not([data-always]), textarea:not([data-always]), ' +
                                      'select:not([data-always]), button:not([data-always])');
  inner.forEach(el => { el.disabled = !ok; });
  const tag = $(tagSel);
  if (tag) tag.textContent = (ok ? '내 담당 · ' : '담당 아님 · ') + ownerLabel(field);
  const lk = $(lockSel);
  if (lk) lk.textContent = ok ? '' : '이 칸은 ' + ownerLabel(field) + '가 씁니다. 여기서는 읽기만 합니다.';
}

/* ---- 배역 배정 ---------------------------------------------------------*/
function paintCastMap() {
  const ok = canEdit('castMap');
  const map = S.work.castMap || {};
  const opts = m => '<option value="">—</option>' + S.members.map(x =>
    '<option value="' + esc(x.sid) + '"' + (map[m] === x.sid ? ' selected' : '') + '>' +
    esc(x.name) + '</option>').join('');
  const a = actOf(S.work.actNo || S.group);
  const list = a ? a.onstage : CAST.map(c => c.key);
  $('#castMap').innerHTML =
    '<p class="dim" style="font-size:.85rem">이 막에 나오는 인물: ' +
      list.map(k => esc(castName(k))).join(', ') + '</p>' +
    '<div class="row-wrap">' + CAST.map(c =>
      '<label class="field" style="flex:1 1 160px">' +
        '<span><span class="sw" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' +
          c.color + ';margin-right:5px"></span>' + esc(c.name) +
          (list.indexOf(c.key) < 0 ? ' <span class="dim">(이 막에 없음)</span>' : '') + '</span>' +
        '<select class="t-select" data-cast="' + c.key + '"' + (ok ? '' : ' disabled') + '>' + opts(c.key) + '</select>' +
      '</label>').join('') + '</div>';
  if (ok) {
    $$('#castMap select').forEach(sel => sel.addEventListener('change', () => {
      const m = Object.assign({}, S.work.castMap || {});
      const k = sel.dataset.cast;
      if (sel.value) m[k] = sel.value; else delete m[k];
      S.work.castMap = m; S.dirty.castMap = m; touch();
    }));
  }
}

/* ---- 대사·지문 ---------------------------------------------------------*/
function myLine(x) {
  if (x.by === S.sid) return true;
  if (x.kind === 'dir' && S.job === 'script') return true;
  if (x.kind === 'say' && x.who === S.role) return true;
  return false;
}

function paintLines() {
  const box = $('#lineList'); if (!box) return;
  if (box.contains(document.activeElement)) return;   /* 누가 치고 있으면 다시 그리지 않습니다 */
  const lines = S.work.lines || [];
  box.innerHTML = lines.length ? lines.map((x, i) => lineHtml(x, i, lines.length)).join('')
    : '<p class="dim">아직 한 줄도 없습니다. 아래에서 지문이나 대사를 넣어 보세요.</p>';
  wireLines(box, 'line');

  const canDir = (S.job === 'script');
  const myCast = castName(S.role);
  $('#addWho').innerHTML =
    (canDir ? '<option value="__dir">지문 (무대 지시)</option>' : '') +
    '<option value="' + esc(S.role) + '" selected>' + esc(myCast) + ' 대사</option>' +
    (canDir ? CAST.filter(c => c.key !== S.role).map(c =>
      '<option value="' + c.key + '">' + esc(c.name) + ' 대사</option>').join('') : '');
  $('#sceneHint').textContent = canDir
    ? '대본 리더는 지문과 모든 인물의 대사를 넣을 수 있습니다. 다만 다른 사람이 쓴 줄은 고칠 수 없습니다.'
    : '내 배역(' + myCast + ')의 대사만 넣고 고칠 수 있습니다. 지문은 대본 리더가 씁니다.';
  $('#dotScene').textContent = String(lines.filter(x => x.kind === 'say').length);
}

function lineHtml(x, i, n) {
  const mine = myLine(x);
  const c = castOf(x.who);
  const author = (S.members.find(m => m.sid === x.by) || {}).name || '';
  if (x.kind === 'dir') {
    return '<div class="line dir' + (mine ? ' mine' : '') + '" data-id="' + esc(x.id) + '">' +
      '<div class="who"><span class="sw" style="background:#666"></span>지문</div>' +
      '<textarea class="txt" rows="2"' + (mine ? '' : ' readonly') + '>' + esc(x.text) + '</textarea>' +
      opsHtml(mine, i, n, author) + '</div>';
  }
  return '<div class="line' + (mine ? ' mine' : '') + '" data-id="' + esc(x.id) + '">' +
    '<div class="who"><span class="sw" style="background:' + (c ? c.color : '#666') + '"></span>' +
      esc(castName(x.who)) + '</div>' +
    '<textarea class="txt" rows="2"' + (mine ? '' : ' readonly') + '>' + esc(x.text) + '</textarea>' +
    opsHtml(mine, i, n, author) + '</div>';
}
function opsHtml(mine, i, n, author) {
  const canOrder = (S.job === 'script');
  return '<div class="ops no-print">' +
    (canOrder && i > 0     ? '<button class="mini" data-op="up"   title="위로">▲</button>' : '') +
    (canOrder && i < n - 1 ? '<button class="mini" data-op="down" title="아래로">▼</button>' : '') +
    (mine ? '<button class="mini" data-op="del" title="지우기">✕</button>' : '') +
    '<span class="by">' + esc(author) + '</span></div>';
}

function wireLines(box, kind) {
  const listKey = kind === 'line' ? 'lines' : 'lyrics';
  const opsKey  = kind === 'line' ? 'lineOps' : 'lyricOps';
  $$('.txt', box).forEach(t => {
    t.addEventListener('input', () => {
      const id = t.closest('[data-id]').dataset.id;
      const item = (S.work[listKey] || []).find(x => x.id === id);
      if (!item) return;
      item.text = t.value;
      pushOp(opsKey, { op: 'set', id: id, text: t.value });
      touch();
    });
  });
  $$('.mini', box).forEach(b => {
    b.addEventListener('click', () => {
      const row = b.closest('[data-id]');
      const id = row.dataset.id;
      const list = S.work[listKey] || [];
      const i = list.findIndex(x => x.id === id);
      if (i < 0) return;
      if (b.dataset.op === 'del') {
        if (!confirm('이 줄을 지울까요?')) return;
        list.splice(i, 1);
        pushOp(opsKey, { op: 'del', id: id });
      } else {
        const j = b.dataset.op === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return;
        const t = list[i]; list[i] = list[j]; list[j] = t;
        pushOp(opsKey, { op: 'order', ids: list.map(x => x.id) }, true);
      }
      S.work[listKey] = list;
      kind === 'line' ? paintLines() : paintLyrics();
      touch();
    });
  });
}

function pushOp(key, op, replaceOrder) {
  const arr = S[key];
  if (replaceOrder) {
    const i = arr.findIndex(x => x.op === 'order');
    if (i >= 0) { arr[i] = op; return; }
  }
  if (op.op === 'set') {
    const i = arr.findIndex(x => x.op === 'set' && x.id === op.id);
    if (i >= 0) { arr[i] = op; return; }
    const j = arr.findIndex(x => x.op === 'add' && x.id === op.id);
    if (j >= 0) { arr[j].text = op.text; return; }
  }
  arr.push(op);
}

function newId() { return 'x' + Math.random().toString(36).slice(2, 10); }

function addLine() {
  const raw = $('#addText').value.trim();
  if (!raw) { toast('내용을 적어 주세요', 'warn', 1600); return; }
  const pick = $('#addWho').value;
  const isDir = pick === '__dir';
  const op = { op: 'add', id: newId(), kind: isDir ? 'dir' : 'say', who: isDir ? '' : pick, text: raw };
  S.work.lines = (S.work.lines || []).concat([opToLine(op)]);
  S.lineOps.push(op);
  $('#addText').value = '';
  paintLines(); paintProgress(); touch();
  $('#addText').focus();
}

/* ---- 가사 -------------------------------------------------------------*/
function paintLyrics() {
  const box = $('#lyricList'); if (!box) return;
  if (box.contains(document.activeElement)) return;
  const ok = canEdit('lyrics') || S.job === 'lyric';
  const list = S.work.lyrics || [];
  box.innerHTML = list.length ? list.map((x, i) => {
    const c = castOf(x.who);
    const showPart = i === 0 || list[i - 1].who !== x.who;
    return '<div class="lyricline' + (showPart ? ' part' : '') + '" data-id="' + esc(x.id) + '">' +
      '<div class="who">' + (showPart
        ? '<span class="sw" style="background:' + (c ? c.color : '#888') + '"></span>[' + esc(x.who ? castName(x.who) : '전원') + ']'
        : '<span class="dim">〃</span>') + '</div>' +
      '<textarea class="txt" rows="1"' + (ok ? '' : ' readonly') + '>' + esc(x.text) + '</textarea>' +
      '<div class="ops no-print">' +
        (ok && i > 0 ? '<button class="mini" data-op="up">▲</button>' : '') +
        (ok && i < list.length - 1 ? '<button class="mini" data-op="down">▼</button>' : '') +
        (ok ? '<button class="mini" data-op="del">✕</button>' : '') +
      '</div></div>';
  }).join('') : '<p class="dim">아직 가사가 없습니다.</p>';
  wireLines(box, 'lyric');

  $('#addLyricWho').innerHTML =
    '<option value="">전원 (합창)</option>' +
    CAST.map(c => '<option value="' + c.key + '">' + esc(c.name) + '</option>').join('');
  $('#addLyricWho').disabled = !ok;
  $('#addLyricText').disabled = !ok;
  $('#btnAddLyric').disabled = !ok;
  $('#dotNumber').textContent = String(list.length);
}

function addLyric() {
  if (S.job !== 'lyric') { toast('가사는 작사 리더가 씁니다', 'warn'); return; }
  const raw = $('#addLyricText').value.trim();
  if (!raw) return;
  const who = $('#addLyricWho').value;
  const op = { op: 'add', id: newId(), kind: 'lyric', who: who, text: raw };
  S.work.lyrics = (S.work.lyrics || []).concat([opToLine(op)]);
  S.lyricOps.push(op);
  $('#addLyricText').value = '';
  paintLyrics(); paintProgress(); touch();
  $('#addLyricText').focus();
}

/* ---- Suno 프롬프트 -----------------------------------------------------*/
function paintPrompt() {
  const grid = $('#promptGrid'); if (!grid) return;
  const ok = canEdit('prompt');
  const p = S.work.prompt || {};
  if (!grid.contains(document.activeElement)) {
    grid.innerHTML = PROMPT_FIELDS.map(f =>
      '<div class="pfield">' +
        '<div class="pl">' + f.label + '</div>' +
        '<div class="pk">' + esc(f.ko) + '</div>' +
        '<textarea data-p="' + f.key + '" placeholder="' + esc(f.ph) + '"' + (ok ? '' : ' readonly') + '>' +
          esc(p[f.key] || '') + '</textarea>' +
        '<div class="ph">' + esc(f.help) + '</div>' +
      '</div>').join('');
    if (ok) $$('#promptGrid textarea').forEach(t => t.addEventListener('input', () => {
      const np = Object.assign({}, S.work.prompt || {});
      np[t.dataset.p] = t.value;
      S.work.prompt = np; S.dirty.prompt = np;
      renderPromptOut(); touch();
    }));
  }
  renderPromptOut();
}
function renderPromptOut() {
  const p = S.work.prompt || {};
  $('#promptOut').textContent = PROMPT_FIELDS.map(f =>
    f.label + ': ' + (p[f.key] || '—')).join('\n');
}
function copyPrompt() {
  const t = $('#promptOut').textContent;
  navigator.clipboard ? navigator.clipboard.writeText(t).then(
    () => toast('복사했습니다', 'ok'), () => toast('복사하지 못했습니다', 'bad'))
    : toast('이 브라우저는 복사를 지원하지 않습니다', 'warn');
}

function paintArrange() {
  const d = S.work.demo || {};
  setVal('#fDemoA', d.a); setVal('#fDemoB', d.b); setVal('#fDemoWhy', d.why); setVal('#fDemoLink', d.link);
  const sel = $('#fDemoPick');
  if (sel && document.activeElement !== sel) sel.value = d.pick || '';
}

/* ---- 진행률 -----------------------------------------------------------*/
function checkState() {
  const w = S.work || {};
  const lines = w.lines || [], lyr = w.lyrics || [];
  const says = lines.filter(x => x.kind === 'say');
  const dirs = lines.filter(x => x.kind === 'dir');
  const p = w.prompt || {};
  const wrote = {};
  lines.concat(lyr).forEach(x => { wrote[x.by] = true; });
  const idle = S.members.filter(m => !wrote[m.sid]);
  return [
    { k: '막 제목',        ok: (w.actTitle || '').trim().length >= 2,  now: (w.actTitle || '').length, need: 2 },
    { k: '무대 배경',      ok: (w.actPlace || '').trim().length >= 30, now: (w.actPlace || '').length, need: 30, unit: '자' },
    { k: '배역 배정',      ok: Object.keys(w.castMap || {}).length >= 3, now: Object.keys(w.castMap || {}).length, need: 3, unit: '명' },
    { k: '장면 지문',      ok: dirs.length >= 2,  now: dirs.length, need: 2, unit: '줄' },
    { k: '대사',           ok: says.length >= 12, now: says.length, need: 12, unit: '줄' },
    { k: '넘버 제목',      ok: (w.numberTitle || '').trim().length >= 2, now: (w.numberTitle || '').length, need: 2 },
    { k: '가사',           ok: lyr.length >= 8,   now: lyr.length, need: 8, unit: '줄' },
    { k: 'Suno 프롬프트',  ok: !!(p.genre && p.mood && p.inst && p.vocal),
      now: [p.genre, p.mood, p.inst, p.vocal].filter(Boolean).length, need: 4, unit: '칸' },
    { k: '넘버 구성',      ok: (w.structure || '').trim().length >= 10, now: (w.structure || '').length, need: 10, unit: '자' },
    { k: '연출 노트',      ok: (w.staging || '').trim().length >= 20, now: (w.staging || '').length, need: 20, unit: '자' },
    { k: '모둠원 참여',    ok: S.members.length > 0 && idle.length === 0,
      now: S.members.length - idle.length, need: S.members.length || 5, unit: '명',
      extra: idle.length ? idle.map(m => m.name).join(', ') + ' 아직 안 씀' : '' }
  ];
}
function paintProgress() {
  const list = checkState();
  const done = list.filter(x => x.ok).length;
  $('#pgFill').style.width = Math.round(done / list.length * 100) + '%';
  $('#pgTxt').textContent = list.length + '개 중 ' + done + '개 완료';
}
function renderChecks() {
  $('#checkList').innerHTML = checkState().map(x =>
    '<div class="checkitem ' + (x.ok ? 'ok' : 'no') + '">' +
      '<span class="mk">' + (x.ok ? '●' : '○') + '</span>' +
      '<span>' + esc(x.k) + (x.extra ? ' <span class="dim">— ' + esc(x.extra) + '</span>' : '') + '</span>' +
      '<span class="rest">' + (x.unit
        ? x.now + ' / ' + x.need + x.unit
        : (x.ok ? '적었습니다' : '아직 비어 있습니다')) + '</span>' +
    '</div>').join('');
}

/* ---- 미리보기 ---------------------------------------------------------*/
function scriptHtml(w, members) {
  if (!w) return '<p class="dim">아직 내용이 없습니다.</p>';
  const p = w.prompt || {};
  const lines = w.lines || [], lyr = w.lyrics || [];
  const cm = w.castMap || {};
  const nameOf = k => {
    const sid = cm[k];
    const m = (members || []).find(x => x.sid === sid);
    return m ? m.name : (sid || '');
  };
  let h = '<div class="script sc-actwrap">';
  h += '<div class="sc-act">제' + (w.actNo || '') + '막 ｜ ' + esc(w.actTime || '') + ' – ' + esc(w.actTitle || '(제목 없음)') + '</div>';
  if (w.actPlace) h += '<div class="sc-place">무대 배경 ｜ ' + esc(w.actPlace) + '</div>';
  if (w.logline)  h += '<div class="sc-place">' + esc(w.logline) + '</div>';
  if (w.sceneTitle) h += '<div class="sc-scene">장면. ' + esc(w.sceneTitle) + '</div>';
  lines.forEach(x => {
    if (x.kind === 'dir') h += '<div class="sc-dir">' + esc(x.text) + '</div>';
    else h += '<div class="sc-say"><span class="n">' + esc(castName(x.who)) + '</span><span>' + esc(x.text) + '</span></div>';
  });
  if (w.numberTitle || lyr.length) {
    h += '<div class="sc-num">♪ ' + esc(w.numberTitle || '(제목 없음)') + '</div>';
    lyr.forEach((x, i) => {
      const showPart = i === 0 || lyr[i - 1].who !== x.who;
      if (showPart) h += '<div class="sc-part">[' + esc(x.who ? castName(x.who) : '전원 합창') + ']</div>';
      h += '<div class="sc-lyr">' + esc(x.text) + '</div>';
    });
  }
  h += '<div class="sc-box">';
  h += '<div style="font-weight:700;margin-bottom:8px">[ Suno AI 프롬프트 ]</div>';
  PROMPT_FIELDS.forEach(f => {
    h += '<div class="r"><span class="k">' + f.label + '</span><span>' + esc(p[f.key] || '—') + '</span></div>';
  });
  if (w.structure) h += '<div class="r"><span class="k">넘버 구성</span><span>' + esc(w.structure) + '</span></div>';
  if (w.staging)   h += '<div class="r"><span class="k">연출 노트</span><span>' + esc(w.staging) + '</span></div>';
  const castLine = CAST.filter(c => cm[c.key]).map(c => c.name + ' — ' + nameOf(c.key)).join(' · ');
  if (castLine) h += '<div class="r"><span class="k">배역</span><span>' + esc(castLine) + '</span></div>';
  h += '</div></div>';
  return h;
}
function renderPreview() {
  $('#preview').innerHTML = scriptHtml(S.work, S.members);
}

/* ---- 제출 -------------------------------------------------------------*/
async function doSubmit() {
  if (S.job !== 'stage') {
    toast('제출은 발표 리더가 합니다. 발표 리더에게 말해 주세요.', 'warn', 4000);
    return;
  }
  const miss = checkState().filter(x => !x.ok);
  if (miss.length) {
    toast('아직 ' + miss.length + '개 항목이 모자랍니다', 'bad', 4000);
    $('#submitHint').innerHTML = '<span class="err">모자란 것: ' +
      esc(miss.map(x => x.k).join(', ')) + '</span>';
    return;
  }
  if (!confirm('우리 막을 제출할까요?\n제출하면 선생님이 열어 주시기 전까지 고칠 수 없습니다.')) return;

  await save(false);
  const res = await apiPost('submit', { idToken: Auth.idToken, sid: S.sid });
  if (!res.ok) {
    if (res.error === 'INCOMPLETE') {
      $('#submitHint').innerHTML = '<span class="err">모자란 것: ' + esc((res.missing || []).join(', ')) + '</span>';
      toast('아직 다 채우지 못했습니다', 'bad', 4000);
    } else if (res.error === 'NOT_LEADER') {
      toast('제출은 발표 리더만 할 수 있습니다', 'warn', 3500);
    } else {
      toast(errText(res), 'bad', 4200);
    }
    return;
  }
  mergeWork(res.work);
  paintAll();
  $('#submitHint').innerHTML = '<b>제출 완료</b> · ' + esc(res.at);
  toast('제출했습니다. 수고했습니다!', 'ok', 4000);
}

/* ---- 내보내기 ---------------------------------------------------------*/
function exportText() {
  const w = S.work || {};
  const out = [];
  out.push(SHOW.title);
  out.push('제' + (w.actNo || '') + '막 ｜ ' + (w.actTime || '') + ' – ' + (w.actTitle || ''));
  out.push(S.cls + ' ' + S.group + '모둠');
  out.push('모둠원: ' + S.members.map(m => m.name + '(' + castName(m.role) + '/' + jobName(m.job) + ')').join(', '));
  out.push('');
  if (w.actPlace) out.push('무대 배경 ｜ ' + w.actPlace);
  if (w.sceneTitle) out.push('장면. ' + w.sceneTitle);
  out.push('');
  (w.lines || []).forEach(x => {
    if (x.kind === 'dir') out.push('  ' + x.text);
    else out.push(castName(x.who) + '\t' + x.text);
  });
  out.push('');
  out.push('♪ ' + (w.numberTitle || ''));
  (w.lyrics || []).forEach((x, i) => {
    const list = w.lyrics;
    if (i === 0 || list[i - 1].who !== x.who) out.push('[' + (x.who ? castName(x.who) : '전원') + ']');
    out.push('  ' + x.text);
  });
  const p = w.prompt || {};
  out.push('');
  out.push('[ Suno AI 프롬프트 ]');
  PROMPT_FIELDS.forEach(f => out.push(f.label + ': ' + (p[f.key] || '')));
  if (w.structure) { out.push(''); out.push('[ 넘버 구성 ] ' + w.structure); }
  if (w.staging)   { out.push(''); out.push('[ 연출 노트 ] ' + w.staging); }

  const blob = new Blob([out.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = S.cls + '_' + S.group + '모둠_제' + (w.actNo || '') + '막.txt';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

/* ===========================================================================
 *  6. 뼈대 탭 그리기 (한 번만)
 * =========================================================================*/

function renderStory() {
  $('#castList').innerHTML =
    '<div class="mates" style="margin-top:10px">' + CAST.map(c =>
      '<span class="mate' + (c.key === S.role ? ' me' : '') + '">' +
        '<span class="sw" style="background:' + c.color + '"></span>' +
        '<span class="nm">' + esc(c.name) + '</span>' +
        (c.key === S.role ? '<span class="jb">← 내 배역</span>' : '') +
      '</span>').join('') + '</div>' +
    '<ul class="think" style="margin-top:12px">' + CAST.map(c =>
      '<li><b>' + esc(c.name) + '</b> — ' + esc(c.line) + '</li>').join('') + '</ul>';

  $('#actMap').innerHTML = ACTS.map(a => {
    const mine = a.no === S.group;
    return '<div class="actcard" ' + (mine ? 'aria-pressed="true"' : '') + '>' +
      '<div class="an">' + a.no + '모둠 · 제' + a.no + '막' + (mine ? ' · 우리 막' : '') + '</div>' +
      '<div class="at">' + esc(a.title) + '</div>' +
      '<div class="ap">' + esc(a.time) + '</div>' +
      '<div class="ax">' + esc(a.beat) + '</div>' +
      '<div class="ax">♪ ' + esc(a.numberHint.title) + ' · ' + esc(a.numberHint.genre) + '</div>' +
      '<div class="ax" style="color:var(--muted)">묻는 것 — ' + esc(a.ask) + '</div>' +
    '</div>';
  }).join('');
}

/* ===========================================================================
 *  7. 파일 탭 — 음원·그림 올리기 / 동영상은 구글 폼으로
 * =========================================================================*/

const UP = { busy: false, queue: [], open: {} };

function bindFiles() {
  const pick = $('#btnPickFile'), input = $('#fileInput'), zone = $('#dropZone');
  if (!pick) return;
  $('#upMax').textContent = MAX_UPLOAD_MB;
  $('#upCount').textContent = MAX_FILES_PER_GROUP;
  input.setAttribute('accept', ALLOW_UPLOAD);

  pick.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { queueFiles(input.files); input.value = ''; });

  ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); zone.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); zone.classList.remove('over');
  }));
  zone.addEventListener('drop', e => {
    if (e.dataTransfer && e.dataTransfer.files) queueFiles(e.dataTransfer.files);
  });

  $('#btnVideoForm').addEventListener('click', openVideoForm);
  $('#btnVideoRefresh').addEventListener('click', () => sync(true));
}

/* ---- 올리기 -----------------------------------------------------------*/
function queueFiles(list) {
  const files = Array.from(list || []);
  if (!files.length) return;
  const have = (S.work.files || []).length;
  if (have + files.length > MAX_FILES_PER_GROUP) {
    toast('모둠당 ' + MAX_FILES_PER_GROUP + '개까지입니다. 지금 ' + have + '개 있습니다.', 'bad', 4200);
    return;
  }
  files.forEach(f => UP.queue.push(f));
  runQueue();
}

async function runQueue() {
  if (UP.busy) return;
  const f = UP.queue.shift();
  if (!f) { $('#upProgress').classList.add('hidden'); return; }

  if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
    toast('"' + f.name + '" 은 ' + Math.round(f.size / 1024 / 1024) + 'MB 라 너무 큽니다. ' +
          MAX_UPLOAD_MB + 'MB까지만 올릴 수 있습니다. 동영상은 아래 [영상 내기]로 내세요.', 'bad', 6000);
    runQueue(); return;
  }
  const okExt = ALLOW_UPLOAD.split(',').some(e => f.name.toLowerCase().endsWith(e.trim()));
  if (!okExt) {
    toast('"' + f.name + '" 은 올릴 수 없는 종류입니다. (' + ALLOW_UPLOAD + ')', 'bad', 5000);
    runQueue(); return;
  }

  UP.busy = true;
  $('#upProgress').classList.remove('hidden');
  $('#upTxt').textContent = f.name + ' 읽는 중…';
  $('#upFill').style.width = '10%';

  let b64;
  try { b64 = await readBase64(f); }
  catch (e) { toast('파일을 읽지 못했습니다', 'bad'); UP.busy = false; runQueue(); return; }

  $('#upTxt').textContent = f.name + ' 올리는 중…';
  $('#upFill').style.width = '55%';

  const res = await apiPost('upload', {
    idToken: Auth.idToken, sid: S.sid,
    name: tagFileName(f.name), mime: f.type || guessMime(f.name), data: b64
  }, 120000);

  UP.busy = false;
  $('#upFill').style.width = '100%';

  if (!res.ok) {
    const msg = res.error === 'TOO_BIG' ? '파일이 너무 큽니다 (' + res.message + 'MB)'
              : res.error === 'BAD_TYPE' ? '올릴 수 없는 종류입니다'
              : res.error === 'TOO_MANY' ? '파일이 너무 많습니다'
              : res.error === 'DRIVE_FAIL' ? '드라이브에 넣지 못했습니다. 선생님께 알려 주세요.'
              : errText(res);
    toast(msg, 'bad', 5000);
  } else {
    mergeWork(res.work);
    S.members = res.members || S.members;
    paintAll();
    toast(f.name + ' 올렸습니다', 'ok');
  }
  setTimeout(() => { $('#upFill').style.width = '0'; runQueue(); }, 300);
}

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function guessMime(name) {
  const n = name.toLowerCase();
  if (n.endsWith('.mp3')) return 'audio/mpeg';
  if (n.endsWith('.m4a')) return 'audio/x-m4a';
  if (n.endsWith('.wav')) return 'audio/wav';
  if (n.endsWith('.ogg')) return 'audio/ogg';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.pdf')) return 'application/pdf';
  return '';
}

/* ---- 목록 -------------------------------------------------------------*/
function paintFiles() {
  const box = $('#fileList'); if (!box) return;
  const list = (S.work && S.work.files) || [];
  $('#dotFiles').textContent = String(list.length);

  box.innerHTML = list.length ? list.map(f => {
    const mine = f.by === S.sid || S.job === 'stage';
    const icon = f.kind === 'audio' ? '♪' : f.kind === 'image' ? '▣'
               : f.kind === 'video' ? '▶' : '▤';
    const opened = !!UP.open[f.id];
    return '<div class="fileitem" data-fid="' + esc(f.id) + '">' +
      '<div class="top">' +
        '<div class="ic">' + icon + '</div>' +
        '<div class="grow">' +
          '<div class="nm">' + fileTagHtml(f.name) + esc(bareFileName(f.name)) + '</div>' +
          '<div class="sub">' + esc(f.byName || '') + ' · ' +
            Math.max(1, Math.round((f.size || 0) / 1024)) + 'KB · ' + esc(f.at || '') + '</div>' +
        '</div>' +
        '<div class="acts no-print">' +
          (f.kind === 'doc' ? '' :
            '<button class="btn sm" data-op="play">' + (opened ? '접기'
              : (f.kind === 'audio' ? '들어보기' : f.kind === 'video' ? '재생' : '보기')) + '</button>') +
          '<a class="btn sm ghost" href="' + esc(f.url) + '" target="_blank" rel="noopener">새 창</a>' +
          (mine ? '<button class="btn sm danger" data-op="del">지우기</button>' : '') +
        '</div>' +
      '</div>' +
      (opened ? '<iframe class="' + f.kind + '" src="' + esc(f.preview) + '"></iframe>' : '') +
    '</div>';
  }).join('') : '<p class="dim">아직 올린 파일이 없습니다.</p>';

  $$('#fileList [data-op]').forEach(b => b.addEventListener('click', () => {
    const fid = b.closest('[data-fid]').dataset.fid;
    if (b.dataset.op === 'play') { UP.open[fid] = !UP.open[fid]; paintFiles(); }
    else deleteFile(fid);
  }));
}

async function deleteFile(fid) {
  const f = (S.work.files || []).find(x => x.id === fid);
  if (!f) return;
  if (!confirm('"' + f.name + '" 을 지울까요?\n드라이브에서도 휴지통으로 갑니다.')) return;
  const res = await apiPost('deleteFile', { idToken: Auth.idToken, sid: S.sid, fileId: fid });
  if (!res.ok) {
    toast(res.error === 'NOT_OWNER' ? '올린 사람이나 발표 리더만 지울 수 있습니다' : errText(res), 'bad', 4000);
    return;
  }
  mergeWork(res.work);
  paintAll();
  toast('지웠습니다', 'ok');
}

/* ---- 동영상 폼 ---------------------------------------------------------
 *  서버(Apps Script)가 알려 준 폼을 먼저 씁니다.
 *  스프레드시트 메뉴에서 [영상 제출 폼 만들기] 를 한 번 실행하면 여기로 내려옵니다.
 *  config.js 의 VIDEO_FORM 은 손으로 넣고 싶을 때만 쓰는 예비입니다.
 * ------------------------------------------------------------------------*/
function vform() {
  if (S.videoForm && S.videoForm.url) return S.videoForm;
  return (typeof VIDEO_FORM !== 'undefined') ? VIDEO_FORM : null;
}

function videoFormUrl() {
  const VF = vform();
  if (!VF || !VF.url) return '';
  const u = VF.url.replace(/\?.*$/, '');
  const p = [];
  const add = (k, v) => { if (k && v) p.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); };
  add(VF.entryClass, S.cls);
  add(VF.entryGroup, S.group + '모둠');
  add(VF.entrySid, S.sid);
  add(VF.entryName, S.name);
  return u + (p.length ? '?usp=pp_url&' + p.join('&') : '');
}

function openVideoForm() {
  const url = videoFormUrl();
  if (!url) { toast('영상 제출용 폼이 아직 연결되지 않았습니다', 'warn', 4000); return; }
  const w = window.open(url, '_blank', 'noopener');
  if (!w) toast('브라우저가 새 창을 막았습니다. 주소창 오른쪽 아이콘에서 허용해 주세요.', 'bad', 6000);
  else toast('새 창에서 영상을 내고 오세요. 돌아와서 [낸 것 확인하기]를 누르면 됩니다.', 'ok', 5000);
}

function paintVideos() {
  const VF = vform();
  const has = !!(VF && VF.url);
  const card = $('#videoCard'), off = $('#videoOff');
  if (card) card.classList.toggle('hidden', !has);
  if (off) off.classList.toggle('hidden', has);
  if (!has) return;

  const list = S.videos || [];
  $('#videoList').innerHTML = list.length
    ? '<p class="dim" style="font-size:.85rem">우리 모둠이 낸 영상 ' + list.length + '건</p>' +
      list.map(v =>
        '<div class="videoitem">' +
          '<span>●</span>' +
          '<span class="who">' + esc(v.name || v.sid || '') + '</span>' +
          (v.link ? '<a href="' + esc(v.link) + '" target="_blank" rel="noopener">열어 보기</a>' : '') +
          '<span class="at">' + esc(v.at || '') + '</span>' +
        '</div>').join('')
    : '<p class="dim">아직 낸 영상이 없습니다.</p>';
}

/* ===========================================================================
 *  8. 제작 공정 · 성찰 · 동료 인정 · 갤러리 — v2.0 (2026-09-13)
 *
 *  서버는 Stage.gs 가 맡습니다. Code.gs 는 건드리지 않았습니다.
 * =========================================================================*/

const MK = {
  stages: [], links: [], reflects: [], praiseIn: [], praiseOut: [],
  gallery: null, galleryAt: 0,
  loaded: false, busy: false, open: {}, dirty: {}, timer: null
};

const stageIdx = k => STAGES.findIndex(s => s.key === k);
const mkStage = k => MK.stages.find(s => s.stage === k) ||
  { stage: k, status: 'todo', owner: '', ownerName: '', log: {}, at: '', by: '', byName: '' };

/* ---- 파일 이름에 붙이는 표시 -------------------------------------------
 *  서버(Code.gs)를 고치지 않고도 '어느 공정의 무엇을 누가 만들었는지'를
 *  남기려고, 올리기 직전에 파일 이름 앞에 표시를 붙입니다.
 *    [2공정 민준] demo_A.mp3
 *  이 표시는 교사 드라이브와 제출파일 시트에도 그대로 남습니다.
 * ----------------------------------------------------------------------*/
const TAG_RE = /^\[(\d{1,2})공정\s+([^\]]{0,12})\]\s*/;

function tagFileName(name) {
  const st = $('#upStage') ? $('#upStage').value : '';
  const mk = $('#upMaker') ? $('#upMaker').value : '';
  if (!st) return name;
  const s = stageOf(st);
  const who = (S.members.find(m => m.sid === mk) || {}).name || S.name || '';
  if (!s) return name;
  return '[' + s.no + '공정 ' + who + '] ' + name;
}
function bareFileName(name) { return String(name || '').replace(TAG_RE, ''); }
function fileTagHtml(name) {
  const m = TAG_RE.exec(String(name || ''));
  if (!m) return '';
  const s = STAGES.find(x => String(x.no) === m[1]);
  return '<span class="ftag">' + esc((s ? s.icon + ' ' + s.name : m[1] + '공정')) +
         (m[2] ? ' · ' + esc(m[2]) : '') + '</span> ';
}

/* ---------------------------------------------------------------------------
 *  8-1. 연결
 * -------------------------------------------------------------------------*/
window.addEventListener('DOMContentLoaded', function () {
  const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
  on('#btnAddLink', 'click', addLink);
  on('#btnSaveReflect', 'click', saveReflect);
  on('#btnLoadGallery', 'click', () => loadGallery(true));
  on('#lkStage', 'change', peekLinkKind);
  on('#lkUrl', 'input', peekLinkKind);
  on('#upStage', 'change', peekUpName);
  on('#upMaker', 'change', peekUpName);

  /* 차시 고르기 */
  const sel = $('#refLesson');
  if (sel) {
    const n = (typeof LESSON_COUNT === 'number' ? LESSON_COUNT : 8);
    let h = '';
    for (let i = 1; i <= n; i++) h += '<option value="' + i + '">' + i + '차시</option>';
    sel.innerHTML = h;
    sel.addEventListener('change', paintReflect);
  }
  /* 성찰 세 칸 */
  const rf = $('#refFields');
  if (rf) {
    rf.innerHTML = REFLECT_FIELDS.map(f =>
      '<label class="field" style="margin-bottom:10px"><span>' + esc(f.label) + '</span>' +
        '<textarea class="t-input" data-ref="' + f.key + '" maxlength="400" ' +
        'style="min-height:60px; font-family:inherit; font-size:.95rem" ' +
        'placeholder="' + esc(f.ph) + '"></textarea></label>').join('');
  }
});

/* 파일·링크 칸의 선택지를 채웁니다. paintAll 에서 부릅니다. */
function paintMakeBits() {
  const stOpts = (withBlank) =>
    (withBlank ? '<option value="">— 고르지 않음 —</option>' : '') +
    STAGES.map(s => '<option value="' + s.key + '">' + s.no + '. ' + esc(s.name) +
      (s.need ? '' : ' (선택)') + '</option>').join('');

  const up = $('#upStage');
  if (up && !up.options.length) up.innerHTML = stOpts(true);
  const lk = $('#lkStage');
  if (lk && !lk.options.length) lk.innerHTML = stOpts(true);
  const kd = $('#lkKind');
  if (kd && !kd.options.length) {
    kd.innerHTML = LINK_KINDS.map(k => '<option value="' + k.key + '">' + esc(k.name) + '</option>').join('');
  }
  const mk = $('#upMaker');
  if (mk && S.members.length) {
    const keep = mk.value || S.sid;
    mk.innerHTML = S.members.map(m =>
      '<option value="' + esc(m.sid) + '"' + (m.sid === keep ? ' selected' : '') + '>' +
      esc(m.name) + (m.sid === S.sid ? ' (나)' : '') + '</option>').join('');
  }
  peekUpName();
}

function peekUpName() {
  const el = $('#upNamePeek'); if (!el) return;
  const st = $('#upStage') ? $('#upStage').value : '';
  if (!st) { el.textContent = '공정을 고르지 않으면 파일 이름 그대로 올라갑니다.'; return; }
  el.innerHTML = '올라갈 이름 — <b>' + esc(tagFileName('우리음원.mp3')) + '</b> 처럼 앞에 표시가 붙습니다.';
}

/** 주소를 보고 어디 것인지 스스로 골라 줍니다. */
function peekLinkKind() {
  const u = ($('#lkUrl') ? $('#lkUrl').value : '').toLowerCase();
  const kd = $('#lkKind'); if (!kd || !u) return;
  const hit = LINK_KINDS.find(k => k.host && u.indexOf(k.host) >= 0);
  if (hit) kd.value = hit.key;
  const t = $('#lkTitle'), st = $('#lkStage');
  if (t && !t.value && st && st.value) t.value = stageName(st.value);
}

/* ---------------------------------------------------------------------------
 *  8-2. 공정 받아오기 · 그리기
 * -------------------------------------------------------------------------*/
async function loadStages(loud) {
  if (MK.busy) return;
  MK.busy = true;
  if (loud) $('#stageBoard').innerHTML = '<p class="dim">받아오는 중…</p>';
  const res = await apiPost('xStages', { idToken: Auth.idToken, sid: S.sid }, 25000);
  MK.busy = false;
  if (!res.ok) {
    if (res.error === 'UNKNOWN_ACTION') {
      $('#stageBoard').innerHTML = '<div class="card"><h2>서버가 아직 준비되지 않았습니다</h2>' +
        '<p class="muted">선생님께 <b>Stage.gs 를 넣고 setupExt 를 실행</b>해 달라고 말씀드리세요. ' +
        '다른 탭은 그대로 쓸 수 있습니다.</p></div>';
      return;
    }
    if (loud) toast(errText(res), 'bad', 4000);
    return;
  }
  MK.stages = res.stages || [];
  MK.links = res.links || [];
  MK.reflects = res.reflects || [];
  MK.praiseIn = res.praiseIn || [];
  MK.praiseOut = res.praiseOut || [];
  if (!MK.loaded) {
    /* 처음 열 때, 아직 끝내지 않은 첫 공정을 펼쳐 둡니다 */
    const first = CORE_STAGES.find(s => mkStage(s.key).status !== 'done');
    if (first) MK.open[first.key] = true;
  }
  MK.loaded = true;
  paintStages(true);
  paintLinks();
  paintReflect();
  paintPraise();
}

function stageDone(k) { return mkStage(k).status === 'done'; }

function paintStages(force) {
  const box = $('#stageBoard'); if (!box) return;
  /* ★ v2.1 — 녹음·촬영 중에는 절대 다시 그리지 않습니다. 다시 그리면 녹음이 끊깁니다. */
  if (REC.busy) { paintStageSummary(); return; }
  if (!force && box.contains(document.activeElement)) { paintStageSummary(); return; }

  box.innerHTML = STAGES.map(stageCardHtml).join('');
  wireStages(box);
  paintStageSummary();
}

function paintStageSummary() {
  const coreDone = CORE_STAGES.filter(s => stageDone(s.key)).length;
  const whyN = STAGES.filter(s => (mkStage(s.key).log.why || '').trim().length >= 10).length;
  const dot = $('#dotMake');
  if (dot) dot.textContent = String(coreDone);
  const el = $('#stageSum'); if (!el) return;
  el.innerHTML =
    '<div class="ss-item"><div class="k">끝낸 공정</div><div class="v">' + coreDone + ' / ' + CORE_STAGES.length + '</div></div>' +
    '<div class="ss-item"><div class="k">더 한 공정</div><div class="v">' +
      STAGES.filter(s => !s.need && stageDone(s.key)).length + '</div></div>' +
    '<div class="ss-item why"><div class="k">「왜 그렇게 했나」 쓴 칸</div><div class="v">' + whyN + ' / ' + STAGES.length + '</div></div>' +
    '<div class="ss-item"><div class="k">낸 주소</div><div class="v">' + MK.links.length + '</div></div>';
}

function stageCardHtml(s) {
  const st = mkStage(s.key);
  const open = !!MK.open[s.key];
  const mine = st.owner === S.sid;
  const filled = XLOGN(st);
  const mates = S.members || [];
  const myLinks = MK.links.filter(l => l.stage === s.key);
  const myFiles = ((S.work && S.work.files) || []).filter(f => {
    const m = TAG_RE.exec(String(f.name || ''));
    return m && String(s.no) === m[1];
  });

  let h = '<div class="stagecard ' + st.status + (s.need ? '' : ' extra') + '" data-st="' + s.key + '">';
  h += '<button class="st-head" type="button" data-op="toggle" aria-expanded="' + (open ? 'true' : 'false') + '">' +
    '<span class="st-no">' + (s.no < 10 ? '0' : '') + s.no + '</span>' +
    '<span class="st-t">' +
      '<span class="st-name">' + s.icon + ' ' + esc(s.name) +
        (s.need ? '' : ' <span class="st-opt">선택</span>') + '</span>' +
      (s.tool ? '<span class="st-tool">' + esc(s.tool) + '</span>' : '') +
    '</span>' +
    '<span class="st-meta">' +
      (st.ownerName ? '<span class="st-owner">' + esc(st.ownerName) + '</span>' : '') +
      '<span class="st-badge ' + st.status + '">' + statusMark(st.status) + ' ' + statusName(st.status) + '</span>' +
      '<span class="st-fill">일지 ' + filled + '/4</span>' +
    '</span>' +
    '<span class="st-caret">' + (open ? '▾' : '▸') + '</span>' +
  '</button>';

  if (open) {
    h += '<div class="st-body">';
    h += '<p class="st-what">' + esc(s.what) + '</p>';
    h += '<p class="st-out"><b>낼 것</b> — ' + esc(s.out) + '</p>';

    h += '<div class="row-wrap" style="margin:12px 0 4px">' +
      '<label class="field" style="flex:0 0 150px"><span>지금 상태</span>' +
        '<select class="t-select" data-f="status">' + STAGE_STATUS.map(x =>
          '<option value="' + x.key + '"' + (x.key === st.status ? ' selected' : '') + '>' +
          x.mark + ' ' + x.name + '</option>').join('') + '</select></label>' +
      '<label class="field" style="flex:0 0 180px"><span>이 공정 담당</span>' +
        '<select class="t-select" data-f="owner">' +
          '<option value="">— 아직 —</option>' +
          mates.map(m => '<option value="' + esc(m.sid) + '"' + (m.sid === st.owner ? ' selected' : '') + '>' +
            esc(m.name) + (m.sid === S.sid ? ' (나)' : '') + '</option>').join('') +
        '</select></label>' +
      (mine ? '<span class="st-mine">내가 맡은 공정입니다</span>' : '') +
    '</div>';

    h += '<details class="st-ask"><summary>생각 열기 — 세 가지만 먼저</summary><ul class="think">' +
      s.ask.map(q => '<li>' + esc(q) + '</li>').join('') + '</ul></details>';

    h += '<div class="loggrid">';
    s.log.forEach(f => {
      const isWhy = f.key === 'why';
      h += '<div class="logfield' + (isWhy ? ' why' : '') + '">' +
        '<div class="lg-l">' + esc(f.label) + '</div>' +
        '<textarea data-log="' + f.key + '" maxlength="' +
          (typeof LOG_MAX_CHARS === 'number' ? LOG_MAX_CHARS : 1200) + '" ' +
          'placeholder="' + esc(f.ph) + '">' + esc(st.log[f.key] || '') + '</textarea>' +
        (f.help ? '<div class="lg-h">' + esc(f.help) + '</div>' : '') +
      '</div>';
    });
    h += '</div>';

    h += recZoneHtml(s);

    if (myFiles.length || myLinks.length) {
      h += '<div class="st-att"><div class="lg-l">이 공정에 낸 것</div>';
      myFiles.forEach(f => {
        h += '<a class="tagpill" target="_blank" rel="noopener" href="' + esc(f.url) + '">' +
          (f.kind === 'audio' ? '♪' : f.kind === 'image' ? '▣' : '▤') + ' ' + esc(bareFileName(f.name)) + '</a>';
      });
      myLinks.forEach(l => {
        h += '<a class="tagpill" target="_blank" rel="noopener" href="' + esc(l.url) + '">🔗 ' +
          esc(l.title) + ' <span class="dim">' + esc(linkKindName(l.kind)) + '</span></a>';
      });
      h += '</div>';
    } else {
      h += '<p class="dim st-att-none">아직 이 공정으로 낸 파일이나 주소가 없습니다. ' +
        '[파일] 탭에서 <b>' + s.no + '. ' + esc(s.name) + '</b> 을 골라 올리면 여기에 붙습니다.</p>';
    }

    h += '<div class="btnrow" style="margin-top:12px">' +
      '<button class="btn primary" data-op="save">이 공정 저장</button>' +
      '<span class="dim" data-role="say" style="align-self:center; font-size:.85rem">' +
        (st.at ? '마지막 저장 ' + esc(st.at) + (st.byName ? ' · ' + esc(st.byName) : '') : '') + '</span>' +
    '</div>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function XLOGN(st) {
  return ['prompt', 'ai', 'fix', 'why'].filter(k => String(st.log[k] || '').trim().length >= 2).length;
}

function wireStages(box) {
  $$('.stagecard', box).forEach(card => {
    const key = card.dataset.st;
    const head = $('[data-op="toggle"]', card);
    if (head) head.addEventListener('click', () => {
      /* ★ v2.1 — 녹음 중이거나 아직 올리지 않은 녹음이 있으면 먼저 정리합니다.
         그냥 다시 그리면 녹음이 소리 없이 사라집니다. */
      if (REC.busy) {
        if (recActive()) { toast('녹음 중입니다. 먼저 [멈추기]를 눌러 주세요', 'warn', 3200); return; }
        if (REC.blob && !confirm('아직 올리지 않은 녹음이 있습니다.\n버리고 넘어갈까요?')) return;
        recReset($('.reczone[data-rz="' + REC.stage + '"]'), false);
      }
      MK.open[key] = !MK.open[key];
      paintStages(true);
    });
    $$('[data-f]', card).forEach(sel => sel.addEventListener('change', () => {
      markStage(key, sel.dataset.f, sel.value);
      saveStage(key, true);
    }));
    $$('[data-log]', card).forEach(t => t.addEventListener('input', () => {
      markStage(key, 'log.' + t.dataset.log, t.value);
      const say = $('[data-role="say"]', card);
      if (say) say.textContent = '쓰는 중…';
      clearTimeout(MK.timer);
      MK.timer = setTimeout(() => saveStage(key, false), 2500);
    }));
    const btn = $('[data-op="save"]', card);
    if (btn) btn.addEventListener('click', () => saveStage(key, true));
    wireRec(card, stageOf(key));
  });
}

function markStage(key, field, value) {
  const st = mkStage(key);
  if (!MK.stages.find(s => s.stage === key)) MK.stages.push(st);
  if (field.indexOf('log.') === 0) {
    st.log = st.log || {};
    st.log[field.slice(4)] = value;
  } else {
    st[field] = value;
    if (field === 'owner') {
      st.ownerName = (S.members.find(m => m.sid === value) || {}).name || '';
    }
  }
  const d = MK.dirty[key] || (MK.dirty[key] = { log: {} });
  if (field.indexOf('log.') === 0) d.log[field.slice(4)] = value;
  else d[field] = value;
}

async function saveStage(key, loud) {
  clearTimeout(MK.timer);
  const d = MK.dirty[key];
  const st = mkStage(key);
  if (!d && !loud) return;
  const card = $('.stagecard[data-st="' + key + '"]');
  const say = card ? $('[data-role="say"]', card) : null;
  if (say) say.textContent = '저장 중…';

  delete MK.dirty[key];
  const res = await apiPost('xStageSave', {
    idToken: Auth.idToken, sid: S.sid, stage: key,
    status: st.status, owner: st.owner || '',
    log: {
      prompt: st.log.prompt || '', ai: st.log.ai || '',
      fix: st.log.fix || '', why: st.log.why || ''
    }
  }, 25000);

  if (!res.ok) {
    MK.dirty[key] = d || {};
    if (say) say.textContent = '저장 실패';
    toast(res.error === 'UNKNOWN_ACTION'
      ? '서버에 Stage.gs 가 아직 없습니다. 선생님께 알려 주세요.'
      : errText(res), 'bad', 4200);
    return;
  }
  MK.stages = res.stages || MK.stages;
  MK.links = res.links || MK.links;
  if (say) say.textContent = '저장됨 · ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  paintStageSummary();
  if (loud) { paintStages(true); toast('저장했습니다', 'ok'); }
}

/* ---------------------------------------------------------------------------
 *  8-3. 주소로 내기
 * -------------------------------------------------------------------------*/
async function addLink() {
  const url = ($('#lkUrl').value || '').trim();
  if (!/^https?:\/\/.{6,}/i.test(url)) { toast('http 로 시작하는 주소를 넣어 주세요', 'warn', 3500); return; }
  const stage = $('#lkStage').value;
  const kind = $('#lkKind').value;
  const title = ($('#lkTitle').value || '').trim() || (stage ? stageName(stage) : '주소');

  $('#btnAddLink').disabled = true;
  const res = await apiPost('xLinkAdd', {
    idToken: Auth.idToken, sid: S.sid, stage: stage, kind: kind, title: title, url: url
  }, 20000);
  $('#btnAddLink').disabled = false;

  if (!res.ok) {
    const msg = res.error === 'DUP_LINK' ? '이미 낸 주소입니다'
              : res.error === 'BAD_URL' ? '주소가 올바르지 않습니다'
              : res.error === 'TOO_MANY_LINKS' ? '주소를 너무 많이 냈습니다'
              : errText(res);
    toast(msg, 'bad', 4000);
    return;
  }
  MK.links = res.links || MK.links;
  $('#lkUrl').value = ''; $('#lkTitle').value = '';
  paintLinks(); paintStages(true);
  toast('주소를 냈습니다', 'ok');
}

function paintLinks() {
  const box = $('#linkList'); if (!box) return;
  if (!MK.links.length) { box.innerHTML = '<p class="dim">아직 낸 주소가 없습니다.</p>'; return; }
  box.innerHTML = MK.links.map(l => {
    const mine = l.sid === S.sid || S.job === 'stage';
    const s = stageOf(l.stage);
    return '<div class="linkitem" data-lid="' + esc(l.id) + '">' +
      '<div class="grow">' +
        '<div class="nm">🔗 ' + esc(l.title) + '</div>' +
        '<div class="sub">' + (s ? esc(s.no + '. ' + s.name) + ' · ' : '') +
          esc(linkKindName(l.kind)) + ' · ' + esc(l.name) + ' · ' + esc(l.at) + '</div>' +
        '<div class="url">' + esc(l.url) + '</div>' +
      '</div>' +
      '<div class="acts no-print">' +
        '<a class="btn sm ghost" href="' + esc(l.url) + '" target="_blank" rel="noopener">열기</a>' +
        (mine ? '<button class="btn sm danger" data-op="dellink">지우기</button>' : '') +
      '</div></div>';
  }).join('');
  $$('#linkList [data-op="dellink"]').forEach(b => b.addEventListener('click', async () => {
    const id = b.closest('[data-lid]').dataset.lid;
    if (!confirm('이 주소를 지울까요?')) return;
    const res = await apiPost('xLinkDel', { idToken: Auth.idToken, sid: S.sid, id: id });
    if (!res.ok) { toast(errText(res), 'bad'); return; }
    MK.links = res.links || [];
    paintLinks(); paintStages(true);
    toast('지웠습니다', 'ok');
  }));
}

/* ---------------------------------------------------------------------------
 *  8-4. 성찰 세 줄
 * -------------------------------------------------------------------------*/
function paintReflect() {
  const sel = $('#refLesson'); if (!sel) return;
  const n = Number(sel.value || 1);
  const have = MK.reflects.find(r => r.lesson === n);
  REFLECT_FIELDS.forEach(f => {
    const t = $('#refFields [data-ref="' + f.key + '"]');
    if (t && document.activeElement !== t) t.value = have ? (have[f.key] || '') : '';
  });
  $('#refSaved').textContent = have ? ('저장돼 있습니다 · ' + have.at) : '아직 안 썼습니다';

  const list = $('#refList');
  if (!list) return;
  list.innerHTML = MK.reflects.length
    ? '<div class="lg-l">지금까지 쓴 것</div>' + MK.reflects.map(r =>
        '<div class="refitem"><div class="rl">' + r.lesson + '차시</div><div class="rt">' +
          (r.did ? '<b>한 것</b> ' + esc(r.did) + '<br>' : '') +
          (r.stuck ? '<b>막힌 것</b> ' + esc(r.stuck) + '<br>' : '') +
          (r.next ? '<b>다음</b> ' + esc(r.next) : '') +
        '</div></div>').join('')
    : '';
}

async function saveReflect() {
  const n = Number($('#refLesson').value || 1);
  const get = k => { const t = $('#refFields [data-ref="' + k + '"]'); return t ? t.value.trim() : ''; };
  const body = { idToken: Auth.idToken, sid: S.sid, lesson: n,
                 did: get('did'), stuck: get('stuck'), next: get('next') };
  if (!body.did && !body.stuck && !body.next) { toast('세 칸 가운데 하나는 적어 주세요', 'warn', 3000); return; }
  $('#btnSaveReflect').disabled = true;
  const res = await apiPost('xReflectSave', body, 20000);
  $('#btnSaveReflect').disabled = false;
  if (!res.ok) { toast(errText(res), 'bad', 4000); return; }
  MK.reflects = res.reflects || MK.reflects;
  paintReflect();
  toast(n + '차시 기록을 저장했습니다', 'ok');
}

/* ---------------------------------------------------------------------------
 *  8-5. 고마운 한 줄
 * -------------------------------------------------------------------------*/
function paintPraise() {
  const box = $('#praiseBox'); if (!box) return;
  if (box.contains(document.activeElement)) return;
  const mates = (S.members || []).filter(m => m.sid !== S.sid);
  if (!mates.length) { box.innerHTML = '<p class="dim">모둠원 정보를 받아오는 중…</p>'; return; }

  box.innerHTML = mates.map(m => {
    const had = MK.praiseOut.find(p => p.toSid === m.sid);
    const c = castOf(m.role);
    return '<div class="praiserow" data-to="' + esc(m.sid) + '">' +
      '<div class="pw"><span class="sw" style="background:' + (c ? c.color : '#666') + '"></span>' +
        esc(m.name) + '<span class="dim"> · ' + esc(jobName(m.job)) + '</span></div>' +
      '<input class="t-input" maxlength="300" placeholder="이 친구가 해낸 일을 한 줄로" value="' +
        esc(had ? had.text : '') + '">' +
      '<button class="btn sm primary" data-op="praise">' + (had ? '고치기' : '보내기') + '</button>' +
    '</div>';
  }).join('');

  $$('#praiseBox [data-op="praise"]').forEach(b => b.addEventListener('click', async () => {
    const row = b.closest('[data-to]');
    const text = $('input', row).value.trim();
    if (!text) { toast('한 줄 적어 주세요', 'warn', 2500); return; }
    b.disabled = true;
    const res = await apiPost('xPraiseSave', {
      idToken: Auth.idToken, sid: S.sid, toSid: row.dataset.to, text: text
    }, 20000);
    b.disabled = false;
    if (!res.ok) { toast(errText(res), 'bad'); return; }
    MK.praiseOut = res.praiseOut || MK.praiseOut;
    MK.praiseIn = res.praiseIn || MK.praiseIn;
    paintPraise();
    toast('보냈습니다', 'ok');
  }));

  const inbox = $('#praiseIn');
  if (inbox) {
    inbox.innerHTML = MK.praiseIn.length
      ? '<div class="lg-l">모둠원이 나에게 써 준 것</div>' + MK.praiseIn.map(p =>
          '<div class="praisegot"><b>' + esc(p.fromName) + '</b> ' + esc(p.text) + '</div>').join('')
      : '<p class="dim" style="font-size:.86rem">아직 받은 것이 없습니다.</p>';
  }
}

/* ---------------------------------------------------------------------------
 *  8-6. 갤러리 — 다른 모둠 보기 · 한 줄 감상 · 부문 투표
 * -------------------------------------------------------------------------*/
async function loadGallery(loud) {
  if (loud) $('#galleryList').innerHTML = '<p class="dim">받아오는 중…</p>';
  const res = await apiPost('xGallery', {
    idToken: Auth.idToken, sid: S.sid,
    resultMode: (typeof VOTE_RESULT_MODE === 'string' ? VOTE_RESULT_MODE : 'afterVote')
  }, 30000);
  if (!res.ok) {
    if (loud) $('#galleryList').innerHTML = '<p class="err">' + esc(errText(res)) + '</p>';
    return;
  }
  MK.gallery = res;
  MK.galleryAt = Date.now();
  $('#galleryAt').textContent = '받아온 시각 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  paintGallery();
}

function paintGallery() {
  const r = MK.gallery; if (!r) return;
  paintVote();

  $('#galleryList').innerHTML = r.groups.map(g => {
    const mine = g.group === r.myGroup;
    const a = actOf(g.actNo) || {};
    const reviews = (r.reviews && r.reviews[g.group]) || [];
    const myText = (r.myReviews && r.myReviews[g.group]) || '';
    return '<div class="gcard' + (mine ? ' mine' : '') + '" data-g="' + g.group + '">' +
      '<div class="g-head">' +
        '<div class="g-no">' + g.group + '모둠 · 제' + g.actNo + '막' + (mine ? ' · 우리' : '') + '</div>' +
        '<div class="g-t">' + esc(g.actTitle || a.title || '(제목 없음)') + '</div>' +
        '<div class="g-n">♪ ' + esc(g.numberTitle || '(넘버 제목 없음)') + '</div>' +
        (g.logline ? '<div class="g-l">' + esc(g.logline) + '</div>' : '') +
        '<div class="g-m">' + esc((g.members || []).join(' · ')) + '</div>' +
      '</div>' +
      (g.lyricPeek && g.lyricPeek.length
        ? '<div class="g-lyr">' + g.lyricPeek.map(x => esc(x)).join('<br>') +
          (g.lyricN > g.lyricPeek.length ? '<div class="dim">… 모두 ' + g.lyricN + '줄</div>' : '') + '</div>'
        : '') +
      '<div class="g-att">' +
        (g.files || []).map(f => '<a class="tagpill" target="_blank" rel="noopener" href="' + esc(f.url) + '">' +
          (f.kind === 'audio' ? '♪' : f.kind === 'image' ? '▣' : '▤') + ' ' + esc(bareFileName(f.name)) + '</a>').join('') +
        (g.links || []).map(l => '<a class="tagpill" target="_blank" rel="noopener" href="' + esc(l.url) + '">🔗 ' +
          esc(l.title) + '</a>').join('') +
        (!(g.files || []).length && !(g.links || []).length ? '<span class="dim">아직 낸 것이 없습니다</span>' : '') +
      '</div>' +
      '<div class="g-done">끝낸 공정 ' + g.stagesDone + ' / ' + STAGES.length + '</div>' +
      (mine
        ? '<p class="dim g-own">우리 모둠입니다. 감상과 투표는 다른 모둠에만 합니다.</p>'
        : '<div class="g-rev">' +
            '<label class="field"><span>한 줄 감상 — 무엇이 좋았는지 <b>구체적으로</b></span>' +
            '<input class="t-input" data-rev="' + g.group + '" maxlength="300" value="' + esc(myText) + '" ' +
            'placeholder="예) 후렴에서 기타만 남는 부분이 노을 장면과 잘 맞았다"></label>' +
            '<button class="btn sm primary" data-op="rev" data-g="' + g.group + '">' +
              (myText ? '고치기' : '남기기') + '</button>' +
          '</div>') +
      (reviews.length
        ? '<div class="g-got"><div class="lg-l">이 모둠이 받은 감상 ' + reviews.length + '줄</div>' +
          reviews.map(x => '<div class="gg' + (x.mine ? ' mine' : '') + '">' + esc(x.text) +
            (x.mine ? ' <span class="dim">(내가 쓴 것)</span>' : '') + '</div>').join('') + '</div>'
        : '') +
    '</div>';
  }).join('');

  $$('#galleryList [data-op="rev"]').forEach(b => b.addEventListener('click', async () => {
    const g = Number(b.dataset.g);
    const input = $('#galleryList [data-rev="' + g + '"]');
    const text = input ? input.value.trim() : '';
    if (!text) { toast('한 줄 적어 주세요', 'warn', 2500); return; }
    b.disabled = true;
    const res = await apiPost('xReviewSave', { idToken: Auth.idToken, sid: S.sid, group: g, text: text }, 20000);
    b.disabled = false;
    if (!res.ok) { toast(errText(res), 'bad'); return; }
    toast(g + '모둠에 감상을 남겼습니다', 'ok');
    loadGallery(false);
  }));
}

function paintVote() {
  const r = MK.gallery; if (!r) return;
  const box = $('#voteBox'); if (!box) return;
  const others = r.groups.filter(g => g.group !== r.myGroup);
  const doneN = VOTE_CATS.filter(c => r.myVotes && r.myVotes[c.key]).length;

  box.innerHTML = '<div class="card votecard">' +
    '<div class="own-tag">' + doneN + ' / ' + VOTE_CATS.length + ' 부문 투표함 · 학급에서 ' + (r.voters || 0) + '명 참여</div>' +
    '<h2>부문별 한 표</h2>' +
    '<p class="muted" style="font-size:.9rem">네 부문에 각각 한 표씩. <b>고른 이유</b>를 함께 적어야 표가 값을 합니다. ' +
    '언제든 바꿀 수 있습니다.</p>' +
    VOTE_CATS.map(c => {
      const mine = (r.myVotes && r.myVotes[c.key]) || null;
      const tally = r.tally && r.tally[c.key];
      return '<div class="voterow" data-cat="' + c.key + '">' +
        '<div class="vc-h"><b>' + esc(c.name) + '</b> <span class="dim">' + esc(c.hint) + '</span></div>' +
        '<div class="row-wrap">' +
          '<label class="field" style="flex:0 0 150px"><span>뽑을 모둠</span>' +
            '<select class="t-select" data-v="g">' +
              '<option value="">— 고르기 —</option>' +
              others.map(g => '<option value="' + g.group + '"' +
                (mine && mine.group === g.group ? ' selected' : '') + '>' +
                g.group + '모둠 · ' + esc(g.numberTitle || g.actTitle || ('제' + g.actNo + '막')) +
              '</option>').join('') +
            '</select></label>' +
          '<label class="field" style="flex:2 1 260px"><span>고른 이유</span>' +
            '<input class="t-input" data-v="why" maxlength="200" value="' + esc(mine ? mine.why : '') + '" ' +
            'placeholder="무엇이 어떻게 좋았는지 한 줄"></label>' +
          '<button class="btn sm primary" data-op="vote" style="align-self:flex-end; margin-bottom:2px">' +
            (mine ? '바꾸기' : '투표') + '</button>' +
        '</div>' +
        (tally
          ? '<div class="vtally">' + others.map(g =>
              '<span class="vt"><b>' + g.group + '모둠</b> ' + (tally[g.group] || 0) + '표</span>').join('') + '</div>'
          : '<div class="dim vtally-off">투표하면 이 부문의 집계가 보입니다</div>') +
      '</div>';
    }).join('') + '</div>';

  $$('#voteBox [data-op="vote"]').forEach(b => b.addEventListener('click', async () => {
    const row = b.closest('[data-cat]');
    const cat = row.dataset.cat;
    const g = Number($('[data-v="g"]', row).value || 0);
    const why = $('[data-v="why"]', row).value.trim();
    if (!g) { toast('모둠을 고르세요', 'warn', 2500); return; }
    if (!why) { toast('고른 이유를 한 줄 적어 주세요', 'warn', 3000); return; }
    b.disabled = true;
    const res = await apiPost('xVoteSave', { idToken: Auth.idToken, sid: S.sid, cat: cat, group: g, why: why }, 20000);
    b.disabled = false;
    if (!res.ok) { toast(errText(res), 'bad'); return; }
    toast(voteCatName(cat) + ' — ' + g + '모둠에 투표했습니다', 'ok');
    loadGallery(false);
  }));
}

/* ===========================================================================
 *  9. 화면에서 바로 녹음·촬영 — v2.1 (2026-09-13)
 *
 *  6공정 「우리 목소리로 부르기」 → 마이크만
 *  7공정 「장면 찍기」           → 카메라 + 마이크, 30초 한 컷
 *
 *  https 주소에서만 됩니다. 깃허브 페이지는 https 라 그대로 됩니다.
 *  편집(자르기·자막·이어 붙이기)은 여기서 하지 않습니다. 그건 인샷의 몫입니다.
 * =========================================================================*/

const REC = {
  busy: false,        /* 녹음·촬영 중이거나 방금 찍은 것을 들고 있는 동안 true */
  stage: '',          /* 지금 쓰는 공정 key */
  kind: '',           /* 'audio' | 'video' */
  stream: null, rec: null, chunks: [],
  blob: null, url: '', mime: '', startAt: 0, timer: null,
  ac: null, analyser: null, raf: 0
};

/** 지금 실제로 녹음 중인지. (찍어 놓고 아직 안 올린 상태는 제외) */
function recActive() {
  return !!(REC.rec && REC.rec.state === 'recording');
}

/* 기기가 받아 주는 형식을 위에서부터 찾습니다. 아이패드는 보통 mp4 가 됩니다. */
const REC_MIMES = {
  audio: ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4',
          'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'],
  video: ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4',
          'video/webm;codecs=h264,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
};
function recPickMime(kind) {
  if (typeof MediaRecorder === 'undefined') return '';
  const list = REC_MIMES[kind] || [];
  for (let i = 0; i < list.length; i++) {
    try { if (MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (e) {}
  }
  return '';
}
const recBase = m => String(m || '').split(';')[0];
function recExt(m) {
  const b = recBase(m);
  return b === 'audio/mp4' ? '.m4a' : b === 'audio/ogg' ? '.ogg'
       : b === 'video/mp4' ? '.mp4' : '.webm';
}
function recSecs(kind) {
  return kind === 'video'
    ? (typeof REC_VIDEO_SECONDS === 'number' ? REC_VIDEO_SECONDS : 35)
    : (typeof REC_AUDIO_SECONDS === 'number' ? REC_AUDIO_SECONDS : 90);
}
function recSecure() {
  /* 브라우저가 스스로 알려 주는 값을 먼저 씁니다. 옛 브라우저면 주소로 판단합니다. */
  if (typeof window.isSecureContext === 'boolean') return window.isSecureContext;
  return location.protocol === 'https:' || location.hostname === 'localhost';
}
function mmss(s) {
  s = Math.max(0, Math.floor(s));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/* ---------------------------------------------------------------------------
 *  9-1. 공정 카드 안에 들어가는 녹음 자리
 * -------------------------------------------------------------------------*/
function recZoneHtml(s) {
  if (!s || !s.rec) return '';
  const isV = s.rec === 'video';
  const lim = recSecs(s.rec);

  if (!recSecure()) {
    return '<div class="reczone off"><div class="rz-head">' +
      (isV ? '지금 바로 찍기' : '지금 바로 녹음하기') + '</div>' +
      '<p class="rz-msg bad">주소가 <b>https</b> 가 아니라 마이크·카메라를 쓸 수 없습니다. ' +
      '학교 주소(https://edunity21.github.io/musicalinus/)로 들어와 주세요.</p></div>';
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
    return '<div class="reczone off"><div class="rz-head">' +
      (isV ? '지금 바로 찍기' : '지금 바로 녹음하기') + '</div>' +
      '<p class="rz-msg bad">이 기기의 브라우저는 화면 안 녹음을 지원하지 않습니다. ' +
      '휴대폰으로 찍어서 [파일] 탭에 올리거나 [주소로 내기]를 쓰세요.</p></div>';
  }

  return '<div class="reczone" data-rz="' + s.key + '" data-kind="' + s.rec + '">' +
    '<div class="rz-head">' + (isV ? '📹 지금 바로 찍기' : '🎙 지금 바로 녹음하기') +
      '<span class="rz-lim">최대 ' + lim + '초</span></div>' +
    '<p class="rz-tip">' + (isV
      ? '한 번에 쭉 찍는 것만 됩니다. <b>자르고 이어 붙이는 편집은 인샷에서</b> 하세요. ' +
        '찍기 전에 연출 노트의 동선을 한 번 읽고, 조용해진 뒤에 시작하세요.'
      : 'MR을 <b>이어폰</b>으로 들으면서 부르면 반주가 섞이지 않습니다. ' +
        '스피커로 틀어야 한다면 태블릿을 입 가까이 두세요.') + '</p>' +
    (isV ? '<video class="rz-live" playsinline muted></video>' : '<div class="rz-level"><span></span></div>') +
    '<div class="rz-bar"><span class="rz-time">00:00</span>' +
      '<span class="rz-dot" hidden>●</span>' +
      '<span class="rz-size"></span></div>' +
    '<div class="btnrow rz-ctl">' +
      '<button class="btn primary" data-rz-op="start">' + (isV ? '찍기 시작' : '녹음 시작') + '</button>' +
      '<button class="btn danger" data-rz-op="stop" disabled>멈추기</button>' +
      (isV ? '<button class="btn ghost" data-rz-op="flip">카메라 앞뒤 바꾸기</button>' : '') +
    '</div>' +
    '<div class="rz-done hidden">' +
      (isV ? '<video class="rz-play" controls playsinline></video>'
           : '<audio class="rz-play" controls></audio>') +
      '<div class="btnrow" style="margin-top:8px">' +
        '<button class="btn primary" data-rz-op="save">이대로 올리기</button>' +
        '<button class="btn" data-rz-op="retry">다시 하기</button>' +
      '</div>' +
    '</div>' +
    '<p class="rz-msg"></p>' +
  '</div>';
}

/* ---------------------------------------------------------------------------
 *  9-2. 배선
 * -------------------------------------------------------------------------*/
let REC_FACING = 'environment';

function wireRec(card, s) {
  if (!s || !s.rec) return;
  const z = $('.reczone[data-rz]', card);
  if (!z) return;
  $$('[data-rz-op]', z).forEach(b => b.addEventListener('click', () => {
    const op = b.dataset.rzOp;
    if (op === 'start') recStart(z, s);
    else if (op === 'stop') recStop(z);
    else if (op === 'save') recSave(z, s);
    else if (op === 'retry') recReset(z, true);
    else if (op === 'flip') {
      REC_FACING = (REC_FACING === 'environment') ? 'user' : 'environment';
      recMsg(z, REC_FACING === 'environment' ? '뒤 카메라로 바꿨습니다' : '앞 카메라로 바꿨습니다');
      if (REC.stream && !REC.rec) { recStopStream(); recStart(z, s); }
    }
  }));
}

function recMsg(z, t, bad) {
  const el = $('.rz-msg', z);
  if (el) { el.textContent = t || ''; el.className = 'rz-msg' + (bad ? ' bad' : ''); }
}

async function recStart(z, s) {
  if (REC.busy && REC.stage !== s.key) {
    recMsg(z, '다른 공정에서 녹음 중입니다. 먼저 그것을 끝내 주세요.', true);
    return;
  }
  recReset(z, false);
  const isV = s.rec === 'video';
  const mime = recPickMime(s.rec);
  const audio = {
    echoCancellation: (typeof REC_ECHO_CANCEL === 'boolean' ? REC_ECHO_CANCEL : true),
    noiseSuppression: (typeof REC_NOISE_SUPPRESS === 'boolean' ? REC_NOISE_SUPPRESS : true),
    autoGainControl: (typeof REC_AUTO_GAIN === 'boolean' ? REC_AUTO_GAIN : true)
  };
  const cons = isV
    ? { audio: audio, video: {
        width: { ideal: (typeof REC_VIDEO_WIDTH === 'number' ? REC_VIDEO_WIDTH : 640) },
        height: { ideal: (typeof REC_VIDEO_HEIGHT === 'number' ? REC_VIDEO_HEIGHT : 480) },
        frameRate: { ideal: 24, max: 30 }, facingMode: REC_FACING } }
    : { audio: audio };

  recMsg(z, '마이크' + (isV ? '와 카메라' : '') + ' 를 준비하는 중…');
  try {
    REC.stream = await navigator.mediaDevices.getUserMedia(cons);
  } catch (e) {
    const n = e && e.name;
    recMsg(z, n === 'NotAllowedError'
      ? '마이크·카메라 사용을 허용해 주세요. 주소창 왼쪽 자물쇠를 눌러 허용으로 바꾸면 됩니다.'
      : n === 'NotFoundError' ? '마이크나 카메라를 찾지 못했습니다.'
      : n === 'NotReadableError' ? '다른 앱이 마이크·카메라를 쓰고 있습니다. 그 앱을 닫고 다시 해 주세요.'
      : '마이크·카메라를 열지 못했습니다 (' + (n || '알 수 없음') + ')', true);
    return;
  }

  if (isV) {
    const live = $('.rz-live', z);
    live.srcObject = REC.stream;
    live.muted = true;
    try { await live.play(); } catch (e) {}
  } else {
    recLevel(z);
  }

  const opt = {};
  if (mime) opt.mimeType = mime;
  if (isV) opt.videoBitsPerSecond = (typeof REC_VIDEO_BPS === 'number' ? REC_VIDEO_BPS : 600000);
  opt.audioBitsPerSecond = (typeof REC_AUDIO_BPS === 'number' ? REC_AUDIO_BPS : 96000);

  try { REC.rec = new MediaRecorder(REC.stream, opt); }
  catch (e) {
    try { REC.rec = new MediaRecorder(REC.stream); }
    catch (e2) { recMsg(z, '이 기기에서는 녹음이 되지 않습니다.', true); recStopStream(); return; }
  }

  REC.busy = true; REC.stage = s.key; REC.kind = s.rec;
  REC.chunks = []; REC.blob = null; REC.mime = REC.rec.mimeType || mime || '';
  REC.rec.ondataavailable = ev => { if (ev.data && ev.data.size) REC.chunks.push(ev.data); };
  REC.rec.onstop = () => recFinish(z, s);
  REC.rec.start(250);

  REC.startAt = Date.now();
  $('[data-rz-op="start"]', z).disabled = true;
  $('[data-rz-op="stop"]', z).disabled = false;
  $('.rz-dot', z).hidden = false;
  z.classList.add('on');
  recMsg(z, '');

  const lim = recSecs(s.rec);
  clearInterval(REC.timer);
  REC.timer = setInterval(() => {
    const sec = (Date.now() - REC.startAt) / 1000;
    const t = $('.rz-time', z); if (t) t.textContent = mmss(sec);
    if (sec >= lim) { recMsg(z, lim + '초가 되어 스스로 멈췄습니다'); recStop(z); }
  }, 200);
}

function recStop(z) {
  clearInterval(REC.timer); REC.timer = null;
  try { if (REC.rec && REC.rec.state !== 'inactive') REC.rec.stop(); } catch (e) {}
  const b = $('[data-rz-op="stop"]', z); if (b) b.disabled = true;
}

function recFinish(z, s) {
  recStopStream();
  const type = recBase(REC.mime) || (s.rec === 'video' ? 'video/mp4' : 'audio/mp4');
  REC.blob = new Blob(REC.chunks, { type: type });
  REC.url = URL.createObjectURL(REC.blob);
  const p = $('.rz-play', z);
  if (p) { p.src = REC.url; p.load && p.load(); }
  $('.rz-done', z).classList.remove('hidden');
  $('.rz-dot', z).hidden = true;
  z.classList.remove('on');
  z.classList.add('done');        /* 카메라 미리보기를 숨기고 찍은 것만 보여 줍니다 */

  const mb = REC.blob.size / 1048576;
  $('.rz-size', z).textContent = mb.toFixed(1) + 'MB';
  const cap = (typeof MAX_UPLOAD_MB === 'number' ? MAX_UPLOAD_MB : 18);
  if (mb > cap) {
    recMsg(z, '파일이 ' + mb.toFixed(1) + 'MB 라 올릴 수 없습니다(' + cap + 'MB까지). ' +
              '더 짧게 다시 찍어 주세요.', true);
    $('[data-rz-op="save"]', z).disabled = true;
  } else {
    recMsg(z, '들어 보고 괜찮으면 [이대로 올리기] 를 누르세요.');
  }
  $('[data-rz-op="start"]', z).disabled = false;
}

function recStopStream() {
  try { if (REC.stream) REC.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  REC.stream = null;
  cancelAnimationFrame(REC.raf); REC.raf = 0;
  try { if (REC.ac) REC.ac.close(); } catch (e) {}
  REC.ac = null; REC.analyser = null;
}

/** 마이크가 잡히고 있는지 눈으로 보여 줍니다. */
function recLevel(z) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    REC.ac = new AC();
    const src = REC.ac.createMediaStreamSource(REC.stream);
    REC.analyser = REC.ac.createAnalyser();
    REC.analyser.fftSize = 512;
    src.connect(REC.analyser);
    const buf = new Uint8Array(REC.analyser.frequencyBinCount);
    const bar = $('.rz-level span', z);
    const tick = () => {
      if (!REC.analyser || !bar) return;
      REC.analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
      bar.style.width = Math.min(100, Math.round(peak / 90 * 100)) + '%';
      REC.raf = requestAnimationFrame(tick);
    };
    tick();
  } catch (e) {}
}

function recReset(z, keepBusy) {
  clearInterval(REC.timer); REC.timer = null;
  recStopStream();
  try { if (REC.url) URL.revokeObjectURL(REC.url); } catch (e) {}
  REC.rec = null; REC.chunks = []; REC.blob = null; REC.url = ''; REC.mime = '';
  if (!keepBusy) { REC.busy = false; REC.stage = ''; REC.kind = ''; }
  if (!z) return;
  const done = $('.rz-done', z); if (done) done.classList.add('hidden');
  const p = $('.rz-play', z); if (p) p.removeAttribute('src');
  const live = $('.rz-live', z); if (live) live.srcObject = null;
  const t = $('.rz-time', z); if (t) t.textContent = '00:00';
  const sz = $('.rz-size', z); if (sz) sz.textContent = '';
  const lv = $('.rz-level span', z); if (lv) lv.style.width = '0%';
  const dot = $('.rz-dot', z); if (dot) dot.hidden = true;
  z.classList.remove('done');
  const sv = $('[data-rz-op="save"]', z); if (sv) sv.disabled = false;
  const st = $('[data-rz-op="start"]', z); if (st) st.disabled = false;
  const sp = $('[data-rz-op="stop"]', z); if (sp) sp.disabled = true;
  z.classList.remove('on');
  recMsg(z, '');
}

/* ---------------------------------------------------------------------------
 *  9-3. 올리기 — [파일] 탭의 올리기와 같은 길로 갑니다
 * -------------------------------------------------------------------------*/
function recName(s, ext) {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const what = s.rec === 'video' ? '장면' : '노래';
  return '[' + s.no + '공정 ' + (S.name || '') + '] ' + what + '_' + hh + mm + ext;
}

async function recSave(z, s) {
  if (!REC.blob) { recMsg(z, '아직 찍은 것이 없습니다', true); return; }
  const have = ((S.work && S.work.files) || []).length;
  const cap = (typeof MAX_FILES_PER_GROUP === 'number' ? MAX_FILES_PER_GROUP : 20);
  if (have >= cap) {
    recMsg(z, '모둠이 올린 파일이 ' + have + '개라 더 올릴 수 없습니다(' + cap + '개까지). ' +
              '[파일] 탭에서 안 쓰는 것을 지워 주세요.', true);
    return;
  }

  const btn = $('[data-rz-op="save"]', z);
  btn.disabled = true;
  recMsg(z, '올리는 중… 화면을 닫지 마세요');

  let b64;
  try { b64 = await recBase64(REC.blob); }
  catch (e) { recMsg(z, '파일을 읽지 못했습니다', true); btn.disabled = false; return; }

  const mime = recBase(REC.blob.type) || (s.rec === 'video' ? 'video/mp4' : 'audio/mp4');
  const res = await apiPost('upload', {
    idToken: Auth.idToken, sid: S.sid,
    name: recName(s, recExt(REC.mime || REC.blob.type)), mime: mime, data: b64
  }, 180000);

  btn.disabled = false;
  if (!res.ok) {
    recMsg(z, res.error === 'TOO_BIG' ? '파일이 너무 큽니다 (' + res.message + 'MB). 더 짧게 다시 찍어 주세요.'
           : res.error === 'BAD_TYPE' ? '이 형식은 올릴 수 없습니다 (' + esc(mime) + '). 선생님께 알려 주세요.'
           : res.error === 'TOO_MANY' ? '파일이 너무 많습니다. [파일] 탭에서 지워 주세요.'
           : errText(res), true);
    return;
  }

  mergeWork(res.work);
  S.members = res.members || S.members;
  REC.busy = false; REC.stage = ''; REC.kind = '';
  recReset(z, false);
  toast((s.rec === 'video' ? '찍은 것을' : '녹음을') + ' 올렸습니다', 'ok', 3500);
  paintAll();
  paintStages(true);
}

function recBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const t = String(r.result);
      const i = t.indexOf(',');
      resolve(i >= 0 ? t.slice(i + 1) : t);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/* 화면을 떠나거나 탭을 옮기면 마이크·카메라를 반드시 끕니다. */
window.addEventListener('pagehide', () => { recStopStream(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && REC.rec && REC.rec.state === 'recording') {
    const z = $('.reczone[data-rz="' + REC.stage + '"]');
    if (z) { recMsg(z, '화면이 가려져서 멈췄습니다'); recStop(z); }
  }
});
