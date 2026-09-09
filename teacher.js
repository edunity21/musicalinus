/* ============================================================================
 *  teacher.js — MUSICALINUS 제작소 · 수업자용 화면
 *  버전: teacher v1.0.0 (2026-09-07)
 * ==========================================================================*/

/* ★ 2026-09-08 — 수업 시간·제출 시간을 통제하지 않습니다.
      입장과 제출은 늘 열려 있고, 낸 뒤에도 학생이 고쳐서 다시 낼 수 있습니다. */

const TEACHER_VERSION = 'teacher v1.6.0 (2026-09-09) 정원5';

const T = {
  cfg: [], cls: '', status: null, roster: [], pending: [], edit: null,
  idleTimer: null, tickTimer: null,
  /* ★ v1.6 — 모둠 현황 자동 갱신과 자리 겹침 검사에 쓰는 것들 */
  seatGroups: [], statusAt: 0, liveTimer: null, agoTimer: null, statusBusy: false
};
const SIZE = (typeof GROUP_SIZE === 'number' ? GROUP_SIZE : 5);
/* 예비 자리(공동 대본)는 정원 밖입니다. 사람 수를 셀 때 빼고 셉니다. */
const isSpare = m => !!(jobOf(m.job) && jobOf(m.job).teacherOnly);
const headcount = list => (list || []).filter(m => !isSpare(m)).length;

/* ===========================================================================
 *  1. 로그인
 * =========================================================================*/

window.addEventListener('DOMContentLoaded', function () {
  $('#verLine').textContent = [TEACHER_VERSION, STORY_VERSION, COMMON_VERSION].join(' · ');
  if (!SERVER_URL) {
    $('#gateMsg').innerHTML = '<span class="err">config.js 의 SERVER_URL 이 비어 있습니다.</span>';
  }
  Auth.render($('#gsiBtn'), onLogin);
  bind();
});

async function onLogin() {
  $('#gateMsg').textContent = '확인하는 중…';
  const res = await apiPost('teacherHello', { idToken: Auth.idToken });
  if (!res.ok) { $('#gateMsg').innerHTML = '<span class="err">' + esc(errText(res)) + '</span>'; return; }
  $('#gate').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#whoBox').textContent = res.email;
  $('#srvLine').textContent = res.version + ' · 시트 연결됨';

  const opts = CLASS_LIST.map(c => '<option value="' + c + '">' + c + '</option>').join('');
  $('#selClass').innerHTML = opts;
  $('#selClass2').innerHTML = opts;
  T.cls = CLASS_LIST[0];

  await loadConfig();
  resetIdle();
}

function bind() {
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    const n = t.dataset.tab;
    $$('.tab').forEach(x => x.setAttribute('aria-selected', x === t ? 'true' : 'false'));
    $$('.panel').forEach(p => { p.hidden = (p.id !== 'panel-' + n); });
    if (n === 'status') loadStatus();
    if (n === 'roster' && !T.roster.length) loadRoster();
    window.scrollTo({ top: 0 });
  }));
  $('#btnLogout').addEventListener('click', () => { Auth.signOut(); location.reload(); });
  $('#btnForceOpen').addEventListener('click', forceOpen);
  $('#selClass').addEventListener('change', e => { T.cls = e.target.value; loadStatus(); });
  $('#btnRefresh').addEventListener('click', loadStatus);
  $('#btnLoadScript').addEventListener('click', loadScript);
  $('#btnPrintScript').addEventListener('click', () => window.print());
  $('#btnExportScript').addEventListener('click', exportScript);
  $('#btnPreviewRoster').addEventListener('click', previewRoster);
  $('#btnUpsertRoster').addEventListener('click', upsertRoster);
  $('#btnLoadRoster').addEventListener('click', loadRoster);
  $('#rosterSearch').addEventListener('input', paintRoster);
  $('#btnLoadLog').addEventListener('click', loadLog);
  $('#btnCloseEdit').addEventListener('click', () => { $('#editModal').hidden = true; });
  $('#btnSaveEdit').addEventListener('click', saveEdit);
  $('#btnRemoveEdit').addEventListener('click', removeEdit);

  /* ★ v1.6 — 자리 정리 단추와, 모달 안에서 고를 때마다 하는 겹침 검사 */
  $('#btnFixSeats').addEventListener('click', fixSeats);
  $('#btnAutoAssign').addEventListener('click', autoAssign);
  $('#chkLive').addEventListener('change', () => { if ($('#chkLive').checked) loadStatus(true); });
  $('#edGroup').addEventListener('change', () => {
    T.edit.group = Number($('#edGroup').value);
    const pick = pickFreeSeat(T.seatGroups, T.edit.sid, T.edit.group);
    if (pick) { T.edit.job = pick.job; T.edit.role = pick.role; }
    paintSeatSelects(); checkEditWarn();
  });
  $('#edJob').addEventListener('change',  () => { T.edit.job  = $('#edJob').value;  checkEditWarn(); });
  $('#edRole').addEventListener('change', () => { T.edit.role = $('#edRole').value; checkEditWarn(); });
  startLive();
  ['click', 'keydown', 'mousemove'].forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));
}

function resetIdle() {
  clearTimeout(T.idleTimer);
  T.idleTimer = setTimeout(() => {
    toast('자리를 비운 동안 자동으로 나갔습니다', 'warn', 5000);
    Auth.signOut(); location.reload();
  }, TEACHER_IDLE_MINUTES * 60 * 1000);
}

/* ===========================================================================
 *  2. 학급 · 공지
 *     ★ 입장과 제출은 항상 열려 있습니다. 여닫는 단추와 마감 시각을 없앴습니다.
 *       여기서는 학생 화면 위쪽 띠에 뜨는 공지만 씁니다.
 * =========================================================================*/

async function loadConfig() {
  const res = await apiPost('teacherConfig', { idToken: Auth.idToken });
  if (!res.ok) { toast(errText(res), 'bad'); return; }
  T.cfg = res.rows || [];
  paintCtrl();
  paintNotice();
}

function rowOf(cls) { return T.cfg.find(r => r.cls === cls) || null; }

/** 그 학급에 보이는 공지. 학급 칸이 비면 '전체' 줄을 따릅니다. */
function noticeOf(cls) {
  const r = rowOf(cls), base = rowOf('전체');
  return (r && r.notice) || (base && base.notice) || '';
}

function paintCtrl() {
  const body = $('#ctrlBody');
  if (!body) return;
  body.innerHTML = CLASS_LIST.map(function (c) {
    return '<tr>' +
      '<td><b>' + c + '</b></td>' +
      '<td><span class="badge done">열림</span></td>' +
      '<td><span class="badge done">열림</span></td>' +
      '<td class="num dim" data-sub="' + c + '">—</td>' +
      '<td class="dim">' + esc(noticeOf(c)) + '</td>' +
    '</tr>';
  }).join('');
}

/** 설정 시트를 통째로 '열림'으로 맞춥니다.
    새 서버는 설정과 상관없이 늘 열어 주므로, 서버가 아직 예전 버전일 때만 쓰입니다. */
async function forceOpen() {
  if (!confirm('설정 시트를 모두 “열림”으로 맞출까요?\n서버가 아직 예전 버전이면 이 한 번으로 열립니다.')) return;
  const patch = { entryOn: true, entryStart: '', entryEnd: '',
                  submitOn: true, reopen: true, submitStart: '', submitEnd: '' };
  const patches = ['전체'].concat(CLASS_LIST).map(function (c) { return { cls: c, patch: patch }; });
  const res = await apiPost('teacherSetConfigAll', { idToken: Auth.idToken, patches: patches }, 40000);
  if (!res.ok) { toast(errText(res), 'bad'); return; }
  toast('모든 학급을 열림으로 맞췄습니다', 'ok');
  await loadConfig();
}

function paintNotice() {
  const rows = ['전체'].concat(CLASS_LIST);
  $('#noticeBox').innerHTML =
    '<div class="tb-scroll"><table class="tb"><thead><tr>' +
      '<th style="width:90px">학급</th><th>공지 — 학생 화면 맨 위 띠에 그대로 뜹니다</th>' +
    '</tr></thead><tbody>' + rows.map(function (c) {
      const r = rowOf(c) || {};
      return '<tr data-c="' + c + '">' +
        '<td><b>' + c + '</b></td>' +
        '<td><input class="t-input" data-k="notice" style="width:100%" value="' + esc(r.notice || '') +
          '" placeholder="' + (c === '전체' ? '모든 학급에 함께 보일 말' : '이 학급에만 보일 말') + '"></td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="btnrow" style="margin-top:12px"><button class="btn primary" id="btnSaveNotice">공지 저장</button></div>';

  $('#btnSaveNotice').addEventListener('click', async function () {
    const patches = $$('#noticeBox tbody tr').map(function (tr) {
      return { cls: tr.dataset.c, patch: { notice: $('[data-k="notice"]', tr).value } };
    });
    const res = await apiPost('teacherSetConfigAll', { idToken: Auth.idToken, patches: patches }, 40000);
    if (!res.ok) { toast(errText(res), 'bad'); return; }
    toast('공지를 저장했습니다', 'ok');
    await loadConfig();
  });
}

/* ===========================================================================
 *  3. 모둠 현황
 * =========================================================================*/

async function loadStatus(quiet) {
  if (T.statusBusy) return;
  T.cls = $('#selClass').value || T.cls;
  if (!quiet) $('#groupCards').innerHTML = '<p class="dim">불러오는 중…</p>';
  T.statusBusy = true;
  const res = await apiPost('teacherStatus', { idToken: Auth.idToken, cls: T.cls }, 40000);
  T.statusBusy = false;
  if (!res.ok) {
    if (!quiet) $('#groupCards').innerHTML = '<p class="err">' + esc(errText(res)) + '</p>';
    return;
  }
  T.status = res;
  T.seatGroups = res.groups;
  T.statusAt = Date.now();
  paintAgo();
  paintStatus();
  const cell = $('[data-sub="' + T.cls + '"]');
  if (cell) cell.textContent = res.groups.filter(g => g.submitted).length + ' / ' + res.groups.length;
}

function paintStatus() {
  const r = T.status;
  const done = r.groups.filter(g => g.submitted).length;
  const people = r.groups.reduce((n, g) => n + g.members.length, 0);
  const active = r.groups.reduce((n, g) => n + g.active, 0);
  const says = r.groups.reduce((n, g) => n + g.says, 0);

  const withVid = r.groups.filter(g => (g.videos || []).length).length;
  const fileN = r.groups.reduce((n, g) => n + (g.files || []).length, 0);

  const dupN = r.groups.reduce((n, g) => n + overlapsIn(g).length, 0);
  const overN = r.groups.filter(g => headcount(g.members) > SIZE).length;

  $('#statusKpis').innerHTML =
    kpi('자리 겹침', (dupN + overN) ? (dupN + overN) + '건' : '없음', (dupN + overN) ? 'bad' : 'hi') +
    kpi('제출한 모둠', done + ' / ' + r.groups.length, done === r.groups.length ? 'hi' : '') +
    kpi('한 줄이라도 쓴 학생', active + ' / ' + people, active < people ? 'bad' : 'hi') +
    kpi('올린 음원·그림', fileN + '개', '') +
    kpi('영상 낸 모둠', withVid + ' / ' + r.groups.length, withVid === r.groups.length ? 'hi' : '');

  $('#groupCards').innerHTML = r.groups.map(g => {
    const a = actOf(g.actNo) || {};
    const bar = Math.max(0, Math.min(100, Math.round(
      (Math.min(g.says, 12) / 12 * 0.4 + Math.min(g.lyrics, 8) / 8 * 0.3 +
       (g.members.length ? g.active / g.members.length : 0) * 0.3) * 100)));
    const dup = overlapsIn(g);
    const n = headcount(g.members);
    const spare = g.members.length - n;
    const seatCls = n > SIZE ? 'over' : (n === SIZE ? 'full' : (n ? 'near' : ''));
    return '<div class="card' + (dup.length || n > SIZE ? ' seat-bad' : '') + '">' +
      '<div class="row-wrap" style="justify-content:space-between; align-items:center">' +
        '<h2 style="margin:0">' + g.group + '모둠 · 제' + g.actNo + '막 ' +
          esc(g.actTitle || a.title || '(제목 없음)') + ' ' +
          '<span class="seat ' + seatCls + '">' + n + '/' + SIZE +
            (spare ? ' +예비' + spare : '') + '</span></h2>' +
        (g.submitted
          ? '<span class="badge done">제출 ' + esc(g.submittedAt) + '</span>'
          : '<span class="badge draft">작성 중</span>') +
      '</div>' +
      '<div class="progress" style="margin:10px 0">' +
        '<div class="bar"><div class="fill" style="width:' + bar + '%"></div></div>' +
        '<div class="txt">' + bar + '%</div></div>' +
      '<div class="mates" style="margin-bottom:10px">' + (g.members.length
        ? g.members.map(m => '<span class="mate" data-sid="' + esc(m.sid) + '" style="cursor:pointer">' +
            '<span class="sw" style="background:' + ((castOf(m.role) || {}).color || '#666') + '"></span>' +
            '<span class="nm">' + esc(m.name) + '</span>' +
            '<span class="jb">' + esc(castName(m.role)) + ' · ' + esc(jobName(m.job)) + '</span></span>').join('')
        : '<span class="dim">아직 아무도 들어오지 않았습니다</span>') + '</div>' +
      (dup.length ? '<p class="seat-warn">자리 겹침 — ' + esc(dup.join(' · ')) +
          ' <span class="dim">[자리 자동으로 정리하기] 를 누르면 풀립니다</span></p>' : '') +
      (n > SIZE ? '<p class="seat-warn">정원(' + SIZE + '명)을 넘겼습니다 — 지금 ' + n + '명</p>' : '') +
      (spare ? '<p class="dim" style="font-size:.84rem">예비 자리(공동 대본) ' + spare + '명 — 정원과 따로 셉니다</p>' : '') +
      '<p class="dim" style="font-size:.88rem">지문 ' + g.dirs + '줄 · 대사 ' + g.says + '줄 · 가사 ' + g.lyrics +
        '줄 · 쓴 사람 ' + g.active + '/' + g.members.length + ' · ♪ ' + esc(g.numberTitle || '(제목 없음)') + '</p>' +
      filesHtml(g) +
      (!g.members.length
        ? '<p class="dim" style="font-size:.86rem">아직 시작하지 않았습니다</p>'
        : (g.missing && g.missing.length
          ? '<p class="dim" style="font-size:.86rem; color:var(--warn)">모자란 것 — ' + esc(g.missing.join(' · ')) + '</p>'
          : '<p class="dim" style="font-size:.86rem; color:var(--accent)">모든 항목을 채웠습니다</p>')) +
      '<div class="btnrow" style="margin-top:10px">' +
        (g.submitted ? '<button class="btn sm" data-reopen="' + g.group + '">다시 열어 주기</button>' : '') +
      '</div></div>';
  }).join('');

  $$('#groupCards [data-reopen]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm(b.dataset.reopen + '모둠의 제출을 풀어 다시 고칠 수 있게 할까요?')) return;
    const res = await apiPost('teacherReopen', { idToken: Auth.idToken, cls: T.cls, group: Number(b.dataset.reopen) });
    if (!res.ok) { toast(errText(res), 'bad'); return; }
    toast('다시 열었습니다', 'ok'); loadStatus();
  }));
  $$('#groupCards .mate[data-sid]').forEach(el =>
    el.addEventListener('click', () => openEdit(el.dataset.sid)));

  $('#unassigned').innerHTML = r.unassigned && r.unassigned.length
    ? '<div class="mates">' + r.unassigned.map(u =>
        '<span class="mate idle" data-sid="' + esc(u.sid) + '" style="cursor:pointer">' +
        '<span class="nm">' + esc(u.name) + '</span><span class="jb">' + esc(u.sid) + '</span></span>').join('') +
      '</div><p class="dim" style="font-size:.85rem; margin-top:8px">이름을 누르면 모둠·역할을 넣어 줄 수 있습니다.</p>'
    : '<p class="dim">모두 자리를 잡았습니다.</p>';
  $$('#unassigned .mate[data-sid]').forEach(el =>
    el.addEventListener('click', () => openEdit(el.dataset.sid)));
}

function kpi(k, v, cls) {
  return '<div class="kpi ' + (cls || '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div></div>';
}

/** 모둠이 올린 음원·그림과, 폼으로 낸 영상 */
function filesHtml(g) {
  const files = g.files || [], vids = g.videos || [];
  if (!files.length && !vids.length) {
    return '<p class="dim" style="font-size:.86rem">올린 파일 없음 · 영상 없음</p>';
  }
  let h = '<div style="margin:6px 0 4px">';
  files.forEach(f => {
    const ic = f.kind === 'audio' ? '♪' : f.kind === 'image' ? '▣' : '▤';
    h += '<a class="tagpill" style="margin:0 6px 6px 0; text-decoration:none" href="' +
         esc(f.url) + '" target="_blank" rel="noopener">' + ic + ' ' + esc(f.name) +
         ' <span class="dim">' + Math.max(1, Math.round((f.size || 0) / 1024)) + 'KB</span></a>';
  });
  vids.forEach(v => {
    h += '<a class="tagpill on" style="margin:0 6px 6px 0; text-decoration:none" href="' +
         esc(v.link || '#') + '" target="_blank" rel="noopener">▶ 영상 · ' +
         esc(v.name || v.sid || '') + '</a>';
  });
  h += '</div>';
  return h;
}

/* ---- ★ v1.6 자리 도우미 -----------------------------------------------
 *  예전에는 미배정 학생을 누르면 '대본 리더 + 지후'가 늘 먼저 골라져 있었고,
 *  그대로 저장하면 이미 그 자리에 앉은 학생과 겹쳤습니다. 겹치면 두 학생의
 *  저장이 서로를 지웁니다. 이제 빈 자리를 골라 두고, 겹치면 먼저 알려 줍니다.
 * ----------------------------------------------------------------------*/

/** 한 모둠 안에서 제작 역할·배역이 겹친 곳을 찾아 말로 돌려줍니다. */
function overlapsIn(g) {
  const seenJ = {}, seenR = {}, out = [];
  (g.members || []).forEach(m => {
    if (seenJ[m.job]) out.push(jobName(m.job) + '(' + seenJ[m.job] + '·' + m.name + ')');
    else seenJ[m.job] = m.name;
    if (jobOf(m.job) && jobOf(m.job).teacherOnly) return;   /* 예비 자리는 배역을 함께 씁니다 */
    if (seenR[m.role]) out.push(castName(m.role) + ' 역(' + seenR[m.role] + '·' + m.name + ')');
    else seenR[m.role] = m.name;
  });
  return out;
}

/** 그 모둠(또는 학급 전체)에서 아직 비어 있는 자리 하나. */
function pickFreeSeat(groups, sid, group) {
  const list = groups || [];
  const jobs = (typeof STUDENT_JOBS !== 'undefined' ? STUDENT_JOBS : JOBS).map(j => j.key);
  const roles = CAST.map(c => c.key);
  const seatIn = (g) => {
    const mates = (g.members || []).filter(m => m.sid !== sid);
    const uj = {}, ur = {};
    mates.forEach(m => { uj[m.job] = 1; ur[m.role] = 1; });
    const job = jobs.find(k => !uj[k]) || '';
    const role = roles.find(k => !ur[k]) || '';
    return (job && role) ? { group: g.group, job: job, role: role } : null;
  };
  if (group) {
    const g = list.find(x => x.group === Number(group));
    if (g) { const st = seatIn(g); if (st) return st; }
  }
  let best = null;
  list.forEach(g => {
    const n = headcount((g.members || []).filter(m => m.sid !== sid));
    if (n >= SIZE) return;
    if (!best || n < best.n) best = { n: n, g: g };
  });
  return best ? seatIn(best.g) : null;
}

/** 그 학급의 모둠별 명단. 지금 보고 있는 학급이면 이미 받아 둔 것을 씁니다. */
async function membersByGroup(cls) {
  if (T.status && T.status.cls === cls) return T.status.groups;
  const res = await apiPost('teacherStatus', { idToken: Auth.idToken, cls: cls }, 40000);
  return res.ok ? res.groups : [];
}

/* ---- 자리 고치기 모달 --------------------------------------------------*/
function openEdit(sid) {
  const all = (T.status ? T.status.groups.reduce((a, g) => a.concat(g.members), []) : [])
    .concat((T.status && T.status.unassigned) || []);
  const m = all.find(x => x.sid === sid) || { sid: sid, name: '' };
  openSeatModal(Object.assign({ cls: T.cls }, m));
}
function openEditFromRoster(r) { openSeatModal(r); }

async function openSeatModal(m) {
  T.edit = { sid: m.sid, name: m.name || '', cls: m.cls || T.cls,
             group: Number(m.group) || 0, job: m.job || '', role: m.role || '' };
  $('#editTitle').textContent = (T.edit.name || '') + ' (' + T.edit.sid + ') 자리 고치기';
  $('#editWarn').hidden = true;
  $('#edGroup').innerHTML = '<option value="0">— 없음 —</option>';
  $('#edJob').innerHTML = ''; $('#edRole').innerHTML = '';
  $('#editModal').hidden = false;

  T.seatGroups = await membersByGroup(T.edit.cls);

  /* ★ 아직 자리가 없거나 자리가 비어 있으면, 겹치지 않는 빈 자리를 미리 골라 둡니다 */
  if (!T.edit.group || !T.edit.job || !T.edit.role) {
    const pick = pickFreeSeat(T.seatGroups, T.edit.sid, T.edit.group);
    if (pick) { T.edit.group = pick.group; T.edit.job = pick.job; T.edit.role = pick.role; }
  }
  paintGroupSelect();
  paintSeatSelects();
  checkEditWarn();
}

function paintGroupSelect() {
  const cnt = {};
  (T.seatGroups || []).forEach(g => { cnt[g.group] = headcount((g.members || []).filter(m => m.sid !== T.edit.sid)); });
  $('#edGroup').innerHTML = '<option value="0">— 없음 —</option>' +
    ACTS.map(a => {
      const n = cnt[a.no] || 0;
      return '<option value="' + a.no + '"' + (T.edit.group === a.no ? ' selected' : '') + '>' +
        a.no + '모둠 (' + n + '/' + SIZE + ')' + (n >= SIZE ? ' · 다 참' : '') +
        ' · 제' + a.no + '막 ' + esc(a.title) + '</option>';
    }).join('');
}

function paintSeatSelects() {
  const g = (T.seatGroups || []).find(x => x.group === T.edit.group);
  const mates = g ? (g.members || []).filter(m => m.sid !== T.edit.sid) : [];
  const tj = {}, tr = {};
  mates.forEach(m => { tj[m.job] = m.name; tr[m.role] = m.name; });

  $('#edJob').innerHTML = JOBS.map(j =>
    '<option value="' + j.key + '"' + (T.edit.job === j.key ? ' selected' : '') + '>' +
    esc(j.name) + (j.teacherOnly ? ' · 예비 자리' : '') +
    (tj[j.key] ? ' — ' + esc(tj[j.key]) + ' 학생이 맡음' : '') + '</option>').join('');

  $('#edRole').innerHTML = CAST.map(c =>
    '<option value="' + c.key + '"' + (T.edit.role === c.key ? ' selected' : '') + '>' +
    esc(c.name) + (tr[c.key] ? ' — ' + esc(tr[c.key]) + ' 학생이 맡음' : '') + '</option>').join('');
}

/** 지금 고른 자리가 겹치는지. 겹치면 모달 안에 빨간 상자로 알려 주고 목록을 돌려줍니다. */
function checkEditWarn() {
  const box = $('#editWarn'), btn = $('#btnSaveEdit');
  if (!T.edit || !T.edit.group) { box.hidden = true; btn.classList.remove('danger'); return []; }
  const g = (T.seatGroups || []).find(x => x.group === T.edit.group);
  const mates = g ? (g.members || []).filter(m => m.sid !== T.edit.sid) : [];
  const spare = !!(jobOf(T.edit.job) && jobOf(T.edit.job).teacherOnly);

  const bad = [];
  const j = mates.find(m => m.job === T.edit.job);
  if (j) bad.push(jobName(T.edit.job) + ' 은(는) ' + j.name + ' 학생이 이미 맡았습니다.');
  const r = mates.find(m => m.role === T.edit.role);
  if (r && !spare) bad.push(castName(T.edit.role) + ' 배역은 ' + r.name + ' 학생이 이미 맡았습니다.');
  if (!spare && headcount(mates) >= SIZE) bad.push('이 모둠은 이미 ' + headcount(mates) + '명입니다. 정원은 ' + SIZE + '명입니다.');

  box.hidden = !bad.length;
  box.innerHTML = bad.length
    ? '<b>이대로 저장하면 겹칩니다</b><ul><li>' + bad.map(esc).join('</li><li>') + '</li></ul>' : '';
  btn.classList.toggle('danger', !!bad.length);
  return bad;
}

async function saveEdit() {
  if (!T.edit) return;
  const bad = checkEditWarn();
  if (bad.length && !confirm('겹치는 자리입니다.\n\n· ' + bad.join('\n· ') +
      '\n\n그래도 저장할까요? (겹친 채로 두면 두 학생의 저장이 서로를 지웁니다)')) return;

  $('#btnSaveEdit').disabled = true;
  const res = await apiPost('teacherSetGroup', {
    idToken: Auth.idToken, sid: T.edit.sid, name: T.edit.name,
    group: Number($('#edGroup').value), job: $('#edJob').value, role: $('#edRole').value,
    force: bad.length ? 1 : 0
  });
  $('#btnSaveEdit').disabled = false;

  if (!res.ok) {
    if (res.error === 'JOB_TAKEN' || res.error === 'ROLE_TAKEN') {
      toast((res.error === 'JOB_TAKEN' ? '그 제작 역할' : '그 배역') + '은 ' +
            (res.message || '다른') + ' 학생이 맡았습니다', 'bad', 5000);
      T.seatGroups = await membersByGroup(T.edit.cls);
      paintGroupSelect(); paintSeatSelects(); checkEditWarn();
      return;
    }
    toast(errText(res), 'bad');
    return;
  }
  $('#editModal').hidden = true;
  toast('바꿨습니다', 'ok');
  loadStatus();
}

async function removeEdit() {
  if (!T.edit) return;
  if (!confirm(T.edit.name + ' 학생을 모둠에서 뺄까요?')) return;
  const res = await apiPost('teacherSetGroup', { idToken: Auth.idToken, sid: T.edit.sid, group: 0 });
  if (!res.ok) { toast(errText(res), 'bad'); return; }
  $('#editModal').hidden = true;
  loadStatus();
}

/* ---- ★ v1.6 자리 일괄 정리 --------------------------------------------*/
async function fixSeats() {
  if (!confirm(T.cls + ' 학급의 겹친 자리를 정리할까요?\n\n먼저 들어온 학생이 자리를 지키고,\n겹쳐 앉은 학생이 빈자리로 옮겨 갑니다.')) return;
  $('#btnFixSeats').disabled = true;
  const res = await apiPost('teacherFixSeats', { idToken: Auth.idToken, cls: T.cls }, 60000);
  $('#btnFixSeats').disabled = false;
  if (!res.ok) { toast(errText(res), 'bad'); return; }
  const moved = res.moved || [], stuck = res.stuck || [];
  toast(moved.length ? (moved.length + '명을 옮겼습니다') : '겹친 자리가 없습니다',
        moved.length ? 'ok' : 'warn', 5000);
  if (moved.length) console.log('[자리 정리]', moved);
  if (stuck.length) toast(stuck.length + '명은 앉힐 자리가 없습니다. 모둠 수를 확인해 주세요.', 'bad', 7000);
  loadStatus();
}

async function autoAssign() {
  const idle = T.status ? (T.status.unassigned || []).length : 0;
  if (!idle) { toast('아직 모둠에 못 들어간 학생이 없습니다', 'warn'); return; }
  if (!confirm('아직 모둠에 못 들어간 ' + idle + '명을 남은 자리에 배치할까요?\n\n학번 순으로 한산한 모둠부터 채웁니다.')) return;
  $('#btnAutoAssign').disabled = true;
  const res = await apiPost('teacherAutoAssign', { idToken: Auth.idToken, cls: T.cls }, 60000);
  $('#btnAutoAssign').disabled = false;
  if (!res.ok) { toast(errText(res), 'bad'); return; }
  const placed = res.placed || [], left = res.left || [];
  toast(placed.length + '명을 배치했습니다' + (left.length ? ' · ' + left.length + '명은 자리가 없습니다' : ''),
        left.length ? 'warn' : 'ok', 6000);
  if (placed.length) console.log('[자동 편성]', placed);
  loadStatus();
}

/* ---- ★ v1.6 스스로 새로 고치기 ----------------------------------------*/
function startLive() {
  const sec = (typeof TEACHER_POLL_SECONDS === 'number' ? TEACHER_POLL_SECONDS : 10);
  clearInterval(T.liveTimer);
  T.liveTimer = setInterval(() => {
    if (document.hidden) return;
    if ($('#panel-status').hidden) return;
    if (!$('#editModal').hidden) return;
    if (!$('#chkLive').checked) return;
    loadStatus(true);
  }, sec * 1000);
  clearInterval(T.agoTimer);
  T.agoTimer = setInterval(paintAgo, 1000);
}

function paintAgo() {
  const el = $('#statusAt');
  if (!el) return;
  if (!T.statusAt) { el.textContent = ''; return; }
  const d = Math.round((Date.now() - T.statusAt) / 1000);
  el.textContent = d < 3 ? '방금 확인함'
    : d < 60 ? d + '초 전 확인'
    : Math.floor(d / 60) + '분 전 확인';
}

/* ===========================================================================
 *  4. 합본 대본
 * =========================================================================*/

async function loadScript() {
  const cls = $('#selClass2').value;
  $('#scriptOut').innerHTML = '<p class="dim">불러오는 중…</p>';
  const res = await apiPost('teacherScript', { idToken: Auth.idToken, cls: cls }, 40000);
  if (!res.ok) { $('#scriptOut').innerHTML = '<p class="err">' + esc(errText(res)) + '</p>'; return; }
  T.script = res;
  const head =
    '<div class="script sc-actwrap" style="text-align:center">' +
      '<div class="sc-act" style="border:0">' + esc(SHOW.title) + '</div>' +
      '<p class="muted">' + esc(SHOW.subtitle) + ' · ' + esc(cls) + '</p>' +
      '<p class="dim">' + esc(SHOW.genre) + ' · ' + esc(SHOW.target) + '</p>' +
      '<div style="margin-top:20px; text-align:left">' +
        '<div class="sc-scene">등장인물</div>' +
        CAST.map(c => '<div class="sc-say"><span class="n">' + esc(c.name) + '</span><span>' +
          esc(c.line) + '</span></div>').join('') +
        '<div class="sc-scene" style="margin-top:18px">수록 넘버</div>' +
        res.acts.map(a => {
          const w = a.work || {};
          return '<div class="sc-say"><span class="n">Number ' + a.group + '</span><span>' +
            esc(w.numberTitle || '(아직 없음)') + '</span></div>';
        }).join('') +
      '</div></div>';
  const body = res.acts.map(a => a.work
    ? scriptHtmlT(a.work, a.members)
    : '<div class="script sc-actwrap"><div class="sc-act">제' + a.group + '막 — 아직 제출된 내용이 없습니다</div></div>'
  ).join('');
  $('#scriptOut').innerHTML = head + body;
}

/* 학생 화면의 미리보기와 같은 조판 */
function scriptHtmlT(w, members) {
  const p = w.prompt || {};
  const lines = w.lines || [], lyr = w.lyrics || [], cm = w.castMap || {};
  const nameOf = k => { const m = (members || []).find(x => x.sid === cm[k]); return m ? m.name : (cm[k] || ''); };
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
      if (i === 0 || lyr[i - 1].who !== x.who) {
        h += '<div class="sc-part">[' + esc(x.who ? castName(x.who) : '전원 합창') + ']</div>';
      }
      h += '<div class="sc-lyr">' + esc(x.text) + '</div>';
    });
  }
  h += '<div class="sc-box"><div style="font-weight:700;margin-bottom:8px">[ Suno AI 프롬프트 ]</div>';
  PROMPT_FIELDS.forEach(f => {
    h += '<div class="r"><span class="k">' + f.label + '</span><span>' + esc(p[f.key] || '—') + '</span></div>';
  });
  if (w.structure) h += '<div class="r"><span class="k">넘버 구성</span><span>' + esc(w.structure) + '</span></div>';
  if (w.staging)   h += '<div class="r"><span class="k">연출 노트</span><span>' + esc(w.staging) + '</span></div>';
  const castLine = CAST.filter(c => cm[c.key]).map(c => c.name + ' — ' + nameOf(c.key)).join(' · ');
  if (castLine) h += '<div class="r"><span class="k">배역</span><span>' + esc(castLine) + '</span></div>';
  h += '<div class="r"><span class="k">만든 모둠</span><span>' +
       esc((members || []).map(m => m.name).join(', ')) + '</span></div>';
  h += '</div></div>';
  return h;
}

function exportScript() {
  if (!T.script) { toast('먼저 불러오세요', 'warn'); return; }
  const cls = T.script.cls;
  const out = [SHOW.title, SHOW.subtitle + ' · ' + cls, ''];
  out.push('등장인물');
  CAST.forEach(c => out.push('  ' + c.name + ' — ' + c.line));
  out.push('');
  T.script.acts.forEach(a => {
    const w = a.work;
    if (!w) { out.push('제' + a.group + '막 — 내용 없음'); out.push(''); return; }
    out.push('제' + (w.actNo || a.group) + '막 ｜ ' + (w.actTime || '') + ' – ' + (w.actTitle || ''));
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
      const L = w.lyrics;
      if (i === 0 || L[i - 1].who !== x.who) out.push('[' + (x.who ? castName(x.who) : '전원') + ']');
      out.push('  ' + x.text);
    });
    const p = w.prompt || {};
    out.push('');
    out.push('[ Suno AI 프롬프트 ]');
    PROMPT_FIELDS.forEach(f => out.push(f.label + ': ' + (p[f.key] || '')));
    if (w.structure) out.push('[ 넘버 구성 ] ' + w.structure);
    if (w.staging) out.push('[ 연출 노트 ] ' + w.staging);
    out.push('만든 모둠: ' + (a.members || []).map(m => m.name).join(', '));
    out.push(''); out.push('─'.repeat(50)); out.push('');
  });
  const blob = new Blob([out.join('\n')], { type: 'text/plain;charset=utf-8' });
  const el = document.createElement('a');
  el.href = URL.createObjectURL(blob);
  el.download = cls + '_학급뮤지컬_합본대본.txt';
  document.body.appendChild(el); el.click();
  setTimeout(() => { URL.revokeObjectURL(el.href); el.remove(); }, 800);
}

/* ===========================================================================
 *  5. 명렬표
 * =========================================================================*/

function previewRoster() {
  const raw = $('#pasteBox').value;
  const rows = [];
  const bad = [];
  const seen = {};
  raw.split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t) return;
    const p = t.split(/[\t,]+|\s{2,}/).map(x => x.trim()).filter(Boolean);
    const sid = p[0], name = p[1], pw = p[2] || '';
    if (!/^\d{4}$/.test(sid) || !name) { bad.push(t); return; }
    if (seen[sid]) { bad.push(t + '  (학번 겹침)'); return; }
    seen[sid] = true;
    rows.push({ sid: sid, name: name, pw: pw });
  });
  T.pending = rows;
  $('#btnUpsertRoster').disabled = !rows.length;
  $('#pastePreview').innerHTML =
    '<p class="' + (rows.length ? 'muted' : 'err') + '">쓸 수 있는 줄 <b>' + rows.length + '</b>개' +
    (bad.length ? ' · 건너뛴 줄 <b class="err">' + bad.length + '</b>개' : '') + '</p>' +
    (bad.length ? '<pre class="dim" style="white-space:pre-wrap; font-size:.82rem">' +
      esc(bad.slice(0, 12).join('\n')) + (bad.length > 12 ? '\n…' : '') + '</pre>' : '');
}

async function upsertRoster() {
  if (!T.pending.length) return;
  if (!confirm(T.pending.length + '명을 명렬표에 넣을까요?')) return;
  $('#btnUpsertRoster').disabled = true;
  const res = await apiPost('teacherRosterUpsert', { idToken: Auth.idToken, rows: T.pending }, 60000);
  $('#btnUpsertRoster').disabled = false;
  if (!res.ok) { toast(errText(res), 'bad'); return; }
  toast('새로 ' + res.added + '명, 고친 것 ' + res.updated + '명 · 모두 ' + res.total + '명', 'ok', 4200);
  $('#pasteBox').value = ''; $('#pastePreview').innerHTML = ''; T.pending = [];
  loadRoster();
}

async function loadRoster() {
  $('#rosterBody').innerHTML = '<tr><td colspan="9" class="dim">불러오는 중…</td></tr>';
  const res = await apiPost('teacherRoster', { idToken: Auth.idToken }, 40000);
  if (!res.ok) { $('#rosterBody').innerHTML = '<tr><td colspan="9" class="err">' + esc(errText(res)) + '</td></tr>'; return; }
  T.roster = res.rows || [];
  paintRoster();
}

function paintRoster() {
  const q = $('#rosterSearch').value.trim();
  const list = q ? T.roster.filter(r => r.sid.indexOf(q) >= 0 || r.name.indexOf(q) >= 0) : T.roster;
  $('#rosterBody').innerHTML = list.length ? list.map(r =>
    '<tr>' +
      '<td class="num">' + esc(r.sid) + '</td>' +
      '<td>' + esc(r.name) + '</td>' +
      '<td>' + esc(r.cls) + '</td>' +
      '<td class="num">' + (r.group ? r.group + '모둠' : '<span class="dim">—</span>') + '</td>' +
      '<td>' + esc(jobName(r.job) || '—') + '</td>' +
      '<td>' + esc(castName(r.role) || '—') + '</td>' +
      '<td class="dim">' + (r.bound ? esc(r.bound) : '<span class="badge none">미연결</span>') + '</td>' +
      '<td class="dim num">' + esc(r.seen || '') + '</td>' +
      '<td><div class="btnrow">' +
        '<button class="btn sm" data-edit="' + esc(r.sid) + '">자리</button>' +
        (r.bound ? '<button class="btn sm ghost" data-unbind="' + esc(r.sid) + '">연결 해제</button>' : '') +
      '</div></td></tr>').join('')
    : '<tr><td colspan="9" class="dim">해당하는 학생이 없습니다.</td></tr>';

  $$('#rosterBody [data-edit]').forEach(b => b.addEventListener('click', () => {
    const r = T.roster.find(x => x.sid === b.dataset.edit);
    T.edit = r; openEditFromRoster(r);
  }));
  $$('#rosterBody [data-unbind]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm(b.dataset.unbind + ' 학번의 계정 연결을 풀까요?')) return;
    const res = await apiPost('teacherResetBinding', { idToken: Auth.idToken, sid: b.dataset.unbind });
    if (!res.ok) { toast(errText(res), 'bad'); return; }
    toast('풀었습니다', 'ok'); loadRoster();
  }));
}

function openEditFromRoster(r) {
  $('#editTitle').textContent = r.name + ' (' + r.sid + ') 자리 고치기';
  $('#edGroup').innerHTML = '<option value="0">— 없음 —</option>' +
    ACTS.map(a => '<option value="' + a.no + '"' + (Number(r.group) === a.no ? ' selected' : '') + '>' +
      a.no + '모둠 · 제' + a.no + '막 ' + esc(a.title) + '</option>').join('');
  $('#edJob').innerHTML = JOBS.map(j => '<option value="' + j.key + '"' +
    (r.job === j.key ? ' selected' : '') + '>' + esc(j.name) + '</option>').join('');
  $('#edRole').innerHTML = CAST.map(c => '<option value="' + c.key + '"' +
    (r.role === c.key ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  $('#editModal').hidden = false;
}

/* ===========================================================================
 *  6. 로그
 * =========================================================================*/

async function loadLog() {
  $('#logBody').innerHTML = '<tr><td colspan="7" class="dim">불러오는 중…</td></tr>';
  const res = await apiPost('teacherLogs', { idToken: Auth.idToken }, 40000);
  if (!res.ok) { $('#logBody').innerHTML = '<tr><td colspan="7" class="err">' + esc(errText(res)) + '</td></tr>'; return; }
  const rows = (res.rows || []).slice().reverse();
  $('#logBody').innerHTML = rows.length ? rows.map(r =>
    '<tr><td class="dim num">' + esc(r.at) + '</td><td class="dim">' + esc(r.email) + '</td>' +
    '<td class="num">' + esc(r.sid) + '</td><td>' + esc(r.cls) + '</td><td>' + esc(r.act) + '</td>' +
    '<td>' + (r.result === 'OK' ? '<span class="badge done">OK</span>'
                                : '<span class="badge draft">' + esc(r.result) + '</span>') + '</td>' +
    '<td class="dim">' + esc(r.note) + '</td></tr>').join('')
    : '<tr><td colspan="7" class="dim">기록이 없습니다.</td></tr>';
}
