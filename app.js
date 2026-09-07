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

const APP_VERSION = 'student v1.2.0 (2026-09-07) 5인모둠';

/* ---------------------------------------------------------------------------
 *  0. 지금 상태
 * -------------------------------------------------------------------------*/
const S = {
  sid: '', name: '', cls: '', group: 0, job: '', role: '',
  work: null, members: [], state: null, videos: [],
  dirty: {}, lineOps: [], lyricOps: [],
  saving: false, lastSent: '', renderedRev: -1, tab: 'story',
  pollTimer: null, syncTimer: null, saveTimer: null
};
const JOIN = { group: 0, job: '', role: '' };

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

  $('#joinActs').innerHTML = ACTS.map(a =>
    '<button class="actcard" type="button" data-g="' + a.no + '" aria-pressed="false">' +
      '<div class="an">' + a.no + '모둠 · 제' + a.no + '막</div>' +
      '<div class="at">' + esc(a.title) + '</div>' +
      '<div class="ap">' + esc(a.time) + '</div>' +
      '<div class="ax">♪ ' + esc(a.numberHint.title) + ' · ' + esc(a.numberHint.genre) + '</div>' +
    '</button>').join('');
  $$('#joinActs .actcard').forEach(b => b.addEventListener('click', () => {
    JOIN.group = Number(b.dataset.g);
    $$('#joinActs .actcard').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    loadMates();
  }));

  $('#joinJobs').innerHTML = JOBS.map(j =>
    '<button type="button" data-j="' + j.key + '" aria-pressed="false"' +
    (j.optional ? ' class="extra"' : '') + '>' + j.icon + ' ' + esc(j.name) +
    (j.optional ? ' <span class="dim">여섯 번째</span>' : '') + '</button>').join('');
  $$("#joinJobs button").forEach(b => b.addEventListener('click', () => {
    JOIN.job = b.dataset.j;
    $$("#joinJobs button").forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    $('#joinJobDuty').textContent = jobOf(JOIN.job) ? jobOf(JOIN.job).duty : '';
  }));

  $('#joinRoles').innerHTML = CAST.map(c =>
    '<button type="button" data-r="' + c.key + '" aria-pressed="false">' + esc(c.name) + '</button>').join('');
  $$('#joinRoles button').forEach(b => b.addEventListener('click', () => {
    JOIN.role = b.dataset.r;
    $$('#joinRoles button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    const c = castOf(JOIN.role);
    $('#joinRoleLine').textContent = c ? c.line : '';
  }));
}

async function loadMates() {
  if (!JOIN.group) return;
  const res = await apiPost('groupState', { idToken: Auth.idToken, sid: S.sid, cls: S.cls, group: JOIN.group });
  if (!res.ok) { $('#joinMates').innerHTML = ''; return; }
  const taken = res.members || [];
  $('#joinMates').innerHTML = taken.length
    ? '<span class="dim" style="width:100%">이미 자리를 잡은 모둠원</span>' + taken.map(m => mateChip(m)).join('')
    : '<span class="dim">아직 아무도 들어오지 않았습니다. 첫 번째입니다.</span>';
  /* 기본 다섯 자리가 모두 찬 뒤에야 '공동 대본'(여섯 번째)이 열립니다.
     학급이 30명이면 6모둠 × 5명이라 여섯 번째 자리는 끝까지 잠겨 있습니다. */
  const core = JOBS.filter(j => !j.optional).map(j => j.key);
  const coreFull = core.every(k => taken.some(m => m.job === k && m.sid !== S.sid));

  $$("#joinJobs button").forEach(b => {
    const j = jobOf(b.dataset.j);
    const t = taken.some(m => m.job === b.dataset.j && m.sid !== S.sid);
    const notYet = !!(j && j.optional) && !coreFull;
    b.disabled = t || notYet;
    b.classList.toggle('taken', t);
    b.classList.toggle('notyet', notYet && !t);
    b.title = t ? '이미 다른 모둠원이 맡았습니다'
            : notYet ? '다섯 자리가 다 차면 열립니다' : '';
  });
  $$('#joinRoles button').forEach(b => {
    const t = taken.some(m => m.role === b.dataset.r && m.sid !== S.sid);
    b.disabled = t;
    b.classList.toggle('taken', t);
  });

  const left = core.filter(k => !taken.some(m => m.job === k && m.sid !== S.sid)).length;
  $('#joinSeats').textContent = taken.length >= MEMBERS_PER_GROUP
    ? MEMBERS_PER_GROUP + '자리가 다 찼습니다. 여섯 번째 자리(공동 대본)로만 들어갈 수 있습니다.'
    : '이 모둠에 남은 자리 ' + left + '개 · 정원 ' + MEMBERS_PER_GROUP + '명';
}

async function doJoin() {
  if (!JOIN.group) { $('#joinMsg').innerHTML = '<span class="err">모둠을 고르세요.</span>'; return; }
  if (!JOIN.job)   { $('#joinMsg').innerHTML = '<span class="err">제작 역할을 고르세요.</span>'; return; }
  if (!JOIN.role)  { $('#joinMsg').innerHTML = '<span class="err">배역을 고르세요.</span>'; return; }
  $('#joinMsg').textContent = '자리를 잡는 중…';
  const res = await apiPost('groupJoin', {
    idToken: Auth.idToken, sid: S.sid, name: S.name,
    group: JOIN.group, job: JOIN.job, role: JOIN.role
  });
  if (!res.ok) {
    const extra = res.error === 'JOB_TAKEN' ? ' (' + esc(res.message) + ' 학생이 맡았습니다)'
                : res.error === 'ROLE_TAKEN' ? ' (' + esc(res.message) + ' 학생이 맡았습니다)' : '';
    const msg = res.error === 'JOB_TAKEN' ? '그 제작 역할은 이미 찼습니다.'
              : res.error === 'ROLE_TAKEN' ? '그 배역은 이미 찼습니다.' : errText(res);
    $('#joinMsg').innerHTML = '<span class="err">' + esc(msg) + extra + '</span>';
    loadMates();
    return;
  }
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
  let cls = 'wait', txt = '';
  if (st.entry !== 'open') {
    cls = 'closed';
    txt = st.entry === 'before' ? '수업이 아직 시작되지 않았습니다.'
        : st.entry === 'after'  ? '수업 시간이 끝났습니다. 쓴 내용은 남아 있습니다.'
        : '선생님이 수업을 열어 주실 때까지 기다려 주세요.';
  } else if (st.submit === 'open') {
    cls = 'open';
    const left = st.submitEndsAt ? (new Date(st.submitEndsAt) - new Date(st.now || Date.now())) : 0;
    txt = '제출 열림' + (left > 0 ? ' · 남은 시간 ' + fmtLeft(left) : '');
  } else {
    cls = 'wait';
    txt = '수업 중 · 제출은 아직 닫혀 있습니다. 계속 써 두세요.';
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
  ['#roleBar', '#roleBar2', '#roleBar3', '#roleBar4', '#roleBar5'].forEach(sel => { const el = $(sel); if (el) el.innerHTML = html; });
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
  if (x.kind === 'dir' && (S.job === 'script' || S.job === 'script2')) return true;
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

  const canDir = (S.job === 'script' || S.job === 'script2');
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
  const canOrder = (S.job === 'script' || S.job === 'script2');
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
    name: f.name, mime: f.type || guessMime(f.name), data: b64
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
    const icon = f.kind === 'audio' ? '♪' : f.kind === 'image' ? '▣' : '▤';
    const opened = !!UP.open[f.id];
    return '<div class="fileitem" data-fid="' + esc(f.id) + '">' +
      '<div class="top">' +
        '<div class="ic">' + icon + '</div>' +
        '<div class="grow">' +
          '<div class="nm">' + esc(f.name) + '</div>' +
          '<div class="sub">' + esc(f.byName || '') + ' · ' +
            Math.max(1, Math.round((f.size || 0) / 1024)) + 'KB · ' + esc(f.at || '') + '</div>' +
        '</div>' +
        '<div class="acts no-print">' +
          (f.kind === 'doc' ? '' :
            '<button class="btn sm" data-op="play">' + (opened ? '접기' : (f.kind === 'audio' ? '들어보기' : '보기')) + '</button>') +
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

/* ---- 동영상 폼 ---------------------------------------------------------*/
function videoFormUrl() {
  if (!VIDEO_FORM || !VIDEO_FORM.url) return '';
  const u = VIDEO_FORM.url.replace(/\?.*$/, '');
  const p = [];
  const add = (k, v) => { if (k && v) p.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); };
  add(VIDEO_FORM.entryClass, S.cls);
  add(VIDEO_FORM.entryGroup, S.group + '모둠');
  add(VIDEO_FORM.entrySid, S.sid);
  add(VIDEO_FORM.entryName, S.name);
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
  const has = !!(VIDEO_FORM && VIDEO_FORM.url);
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
