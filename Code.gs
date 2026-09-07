/* ============================================================================
 *  Code.gs — MUSICALINUS 제작소 서버 (Google Apps Script)
 *  버전: server v1.0.0 (2026-09-07)
 *
 *  ★ 아래 세 줄은 이미 채워 두었습니다.
 *    음악 산업 탐구(musicjob)에서 쓰던 클라이언트 ID를 그대로 씁니다.
 *    교사 계정이 다르면 TEACHERS 만 고치세요.
 * ==========================================================================*/

const CLIENT_ID      = '432757752918-5i46ftsts6163gtqvrulquiu0n0sklaq.apps.googleusercontent.com';
const TEACHERS       = ['onixzone@ai.jne.kr'];   // 교사 계정. 줄을 늘려도 됩니다.
const ALLOWED_DOMAIN = 'ai.jne.kr';

/* --------------------------------------------------------------------------
 *  아래는 고치지 않아도 됩니다.
 * ------------------------------------------------------------------------*/

const VERSION      = 'server v1.2.0 (2026-09-07) 5인모둠';
const CLASS_LIST   = ['3-1','3-2','3-3','3-4','3-5','3-6','3-7','3-8','3-9'];
const GROUP_COUNT  = 6;               // 학급마다 모둠 여섯 개 = 여섯 막
const JOB_KEYS     = ['script','lyric','compose','arrange','stage','script2'];
/* 기본 다섯 자리. 'script2'(공동 대본)는 이 다섯이 다 찬 모둠에만 열리는 여섯 번째 자리입니다.
   학급이 30명이면 6모둠 × 5명이라 여섯 번째 자리는 쓰이지 않습니다. */
const CORE_JOBS    = ['script','lyric','compose','arrange','stage'];
const MEMBERS_PER_GROUP = 5;
const CAST_KEYS    = ['jihoo','minseo','yuna','teacher','ens1','ens2'];

/* 어떤 제작 역할이 어떤 칸을 고칠 수 있는지. story.js 의 FIELD_OWNER 와 같아야 합니다. */
const FIELD_OWNER = {
  actTitle:    ['script','script2'],
  actTime:     ['script','script2'],
  actPlace:    ['script','script2'],
  sceneTitle:  ['script','script2'],
  logline:     ['script','script2'],
  numberTitle: ['lyric'],
  prompt:      ['compose'],
  structure:   ['arrange'],
  demo:        ['arrange'],
  staging:     ['stage'],
  castMap:     ['stage']
};

const SH = {
  CFG:   '설정',
  ROST:  '명렬표',
  MEM:   '모둠원',
  WORK:  '모둠작업',
  SUB:   '제출',
  FILE:  '제출파일',
  LOG:   '로그'
};

/* 올린 파일이 들어갈 드라이브 최상위 폴더 이름 (교사 드라이브에 자동으로 생깁니다) */
const DRIVE_ROOT = 'MUSICALINUS 제출';

/* 플랫폼에서 바로 받을 수 있는 최대 크기(MB). config.js 의 MAX_UPLOAD_MB 와 맞추세요. */
const MAX_UPLOAD_MB = 18;

/* 받아 줄 파일 종류. 동영상은 구글 폼으로 받으므로 여기에 넣지 않습니다. */
const OK_MIME = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav',
  'audio/x-wav', 'audio/ogg', 'audio/webm',
  'image/png', 'image/jpeg', 'image/webp', 'application/pdf'
];

/* 영상 제출 폼의 응답 시트. config.js 의 VIDEO_FORM.sheet 와 맞추세요. */
const FORM_SHEET = '폼 응답 1';

const HEAD = {
  CFG:  ['학급','입장허용','입장시작','입장마감','제출허용','다시내기','제출시작','제출마감','공지'],
  ROST: ['학번','이름','반','비밀번호','연결된계정','최근접속'],
  MEM:  ['학번','이름','반','모둠','제작역할','배역','등록시각'],
  WORK: ['반','모둠','막','수정시각','제출','제출시각','rev','내용(JSON)'],
  SUB:  ['제출시각','반','모둠','막','막제목','시간대','무대배경','지문수','대사수','참여인원',
         '넘버제목','가사줄수','Genre','Mood','Instruments','VocalStructure','넘버구성','연출노트',
         '모둠원','올린파일수','영상제출','대본전문'],
  FILE: ['올린시각','반','모둠','올린사람','학번','종류','파일이름','크기(KB)','드라이브ID','주소','상태'],
  LOG:  ['시각','계정','학번','반','동작','결과','비고']
};

/* ===========================================================================
 *  0. 설치 — Apps Script 편집기에서 setup 을 한 번 실행하세요.
 * =========================================================================*/

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SH).forEach(function (k) {
    const name = SH[k];
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const head = HEAD[k];
    sh.getRange(1, 1, 1, head.length).setValues([head])
      .setFontWeight('bold').setBackground('#EFEFEF');
    sh.setFrozenRows(1);
  });
  rebuildConfigSheet_();
  SpreadsheetApp.getActiveSpreadsheet().toast('시트 여섯 개를 준비했습니다.', 'MUSICALINUS', 6);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('뮤지컬 제작소')
    .addItem('시트 다시 만들기', 'setup')
    .addItem('설정 시트 다시 만들기', 'rebuildConfigSheet_')
    .addItem('버전 확인', 'showVersion_')
    .addToUi();
}
function showVersion_() { SpreadsheetApp.getUi().alert(VERSION); }

function rebuildConfigSheet_() {
  const sh = sheet_(SH.CFG);
  sh.clear();
  sh.getRange(1, 1, 1, HEAD.CFG.length).setValues([HEAD.CFG])
    .setFontWeight('bold').setBackground('#EFEFEF');
  const rows = [['전체', false, '', '', false, false, '', '', '']];
  CLASS_LIST.forEach(function (c) { rows.push([c, '', '', '', '', '', '', '', '']); });
  sh.getRange(2, 1, rows.length, HEAD.CFG.length).setValues(rows);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, HEAD.CFG.length);
}

/* ===========================================================================
 *  1. 들어오는 요청
 * =========================================================================*/

function doGet(e) {
  const p = (e && e.parameter) || {};
  const cb = p.callback;
  let out;
  try {
    if (p.action === 'config') out = { ok: true, version: VERSION, now: nowIso_(), state: classState_(p.cls || '') };
    else out = { ok: true, version: VERSION, now: nowIso_() };
  } catch (err) {
    out = { ok: false, error: 'SERVER', message: String(err) };
  }
  const json = JSON.stringify(out);
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) {}
  let out;
  try { out = route_(body); }
  catch (err) { out = { ok: false, error: 'SERVER', message: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function route_(b) {
  const a = String(b.action || '');
  switch (a) {
    /* 학생 */
    case 'whoAmI':      return actWhoAmI_(b);
    case 'gate':        return actGate_(b);
    case 'groupJoin':   return actGroupJoin_(b);
    case 'groupState':  return actGroupState_(b);
    case 'patch':       return actPatch_(b);
    case 'submit':      return actSubmit_(b);
    case 'upload':      return actUpload_(b);
    case 'deleteFile':  return actDeleteFile_(b);
    /* 교사 */
    case 'teacherHello':        return actTeacherHello_(b);
    case 'teacherConfig':       return actTeacherConfig_(b);
    case 'teacherSetConfig':    return actTeacherSetConfig_(b);
    case 'teacherSetConfigAll': return actTeacherSetConfigAll_(b);
    case 'teacherStatus':       return actTeacherStatus_(b);
    case 'teacherScript':       return actTeacherScript_(b);
    case 'teacherRoster':       return actTeacherRoster_(b);
    case 'teacherRosterUpsert': return actTeacherRosterUpsert_(b);
    case 'teacherSetGroup':     return actTeacherSetGroup_(b);
    case 'teacherResetBinding': return actTeacherResetBinding_(b);
    case 'teacherReopen':       return actTeacherReopen_(b);
    case 'teacherLogs':         return actTeacherLogs_(b);
    default: return { ok: false, error: 'UNKNOWN_ACTION', message: a };
  }
}

/* ===========================================================================
 *  2. 시트 도우미
 * =========================================================================*/

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); }
  return sh;
}
function rows_(name) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
}
function nowIso_() { return new Date().toISOString(); }
function nowStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}
function s_(v) { return String(v == null ? '' : v).trim(); }
function truthy_(v) {
  const t = s_(v).toLowerCase();
  return v === true || t === 'true' || t === 'y' || t === '예' || t === '허용' || t === '1' || t === 'o';
}
function classOfSid_(sid) {
  const t = s_(sid);
  return /^\d{4}$/.test(t) ? (t[0] + '-' + t[1]) : '';
}
function log_(email, sid, cls, act, result, note) {
  try {
    sheet_(SH.LOG).appendRow([nowStr_(), s_(email), s_(sid), s_(cls), s_(act), s_(result), s_(note).slice(0, 400)]);
  } catch (x) {}
}

/* ===========================================================================
 *  3. 로그인 확인
 * =========================================================================*/

function verify_(idToken) {
  const t = s_(idToken);
  if (!t) return { ok: false, error: 'NO_TOKEN' };
  const cache = CacheService.getScriptCache();
  const key = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, t));
  const hit = cache.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (x) {} }

  let info;
  try {
    const res = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(t),
      { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, error: 'BAD_TOKEN' };
    info = JSON.parse(res.getContentText());
  } catch (x) { return { ok: false, error: 'BAD_TOKEN' }; }

  if (s_(info.aud) !== s_(CLIENT_ID)) return { ok: false, error: 'WRONG_AUDIENCE' };
  const email = s_(info.email).toLowerCase();
  if (!email || email.split('@')[1] !== ALLOWED_DOMAIN) return { ok: false, error: 'DOMAIN_DENIED' };

  const out = { ok: true, email: email, name: s_(info.name), teacher: TEACHERS.map(function (x) {
    return s_(x).toLowerCase(); }).indexOf(email) >= 0 };
  cache.put(key, JSON.stringify(out), 900);
  return out;
}

function needTeacher_(b) {
  const v = verify_(b.idToken);
  if (!v.ok) return v;
  if (!v.teacher) return { ok: false, error: 'NOT_TEACHER' };
  return v;
}

/* ===========================================================================
 *  4. 학급 상태 (설정 시트)
 * =========================================================================*/

function cfgRow_(cls) {
  const all = rows_(SH.CFG);
  let base = null, own = null;
  all.forEach(function (r) {
    if (s_(r[0]) === '전체') base = r;
    if (s_(r[0]) === s_(cls)) own = r;
  });
  return { base: base || [], own: own || [] };
}
function pick_(own, base, i) {
  const v = own && own[i];
  return (v === '' || v === null || v === undefined) ? (base ? base[i] : '') : v;
}
function toDate_(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = s_(v);
  if (!s) return null;
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const n = new Date(); const p = s.split(':');
    n.setHours(Number(p[0]), Number(p[1]), 0, 0); return n;
  }
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d) ? null : d;
}

/** 학급 하나의 지금 상태. 캐시 8초. */
function classState_(cls) {
  const cache = CacheService.getScriptCache();
  const ck = 'st_' + cls;
  const hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (x) {} }

  const c = cfgRow_(cls);
  const now = new Date();
  const entryOn  = truthy_(pick_(c.own, c.base, 1));
  const eStart   = toDate_(pick_(c.own, c.base, 2));
  const eEnd     = toDate_(pick_(c.own, c.base, 3));
  const subOn    = truthy_(pick_(c.own, c.base, 4));
  const reopen   = truthy_(pick_(c.own, c.base, 5));
  const sStart   = toDate_(pick_(c.own, c.base, 6));
  const sEnd     = toDate_(pick_(c.own, c.base, 7));
  const notice   = s_(pick_(c.own, c.base, 8));

  let entry = 'closed';
  if (entryOn) {
    if (eStart && now < eStart) entry = 'before';
    else if (eEnd && now > eEnd) entry = 'after';
    else entry = 'open';
  }
  let submit = 'closed';
  if (entry === 'open' && subOn) {
    if (sStart && now < sStart) submit = 'before';
    else if (sEnd && now > sEnd) submit = 'after';
    else submit = 'open';
  }
  const out = {
    cls: cls, entry: entry, submit: submit, reopen: reopen, notice: notice,
    entryEndsAt: eEnd ? eEnd.toISOString() : '',
    entryStartsAt: eStart ? eStart.toISOString() : '',
    submitEndsAt: sEnd ? sEnd.toISOString() : '',
    submitStartsAt: sStart ? sStart.toISOString() : '',
    now: now.toISOString()
  };
  cache.put(ck, JSON.stringify(out), 8);
  return out;
}
function bustState_(cls) {
  const c = CacheService.getScriptCache();
  c.remove('st_' + cls); c.remove('st_');
  CLASS_LIST.forEach(function (x) { if (cls === '전체') c.remove('st_' + x); });
}

/* ===========================================================================
 *  5. 명렬표
 * =========================================================================*/

function rosterFind_(sid) {
  const all = rows_(SH.ROST);
  for (let i = 0; i < all.length; i++) {
    if (s_(all[i][0]) === s_(sid)) return { row: i + 2, v: all[i] };
  }
  return null;
}
/** 이 계정이 정말 그 학번의 주인인지. 남의 학번으로 남의 막을 고치는 일을 막습니다. */
function ownsSid_(email, sid) {
  const f = rosterFind_(sid);
  return !!f && s_(f.v[4]).toLowerCase() === s_(email).toLowerCase();
}

function rosterFindByEmail_(email) {
  const all = rows_(SH.ROST);
  const e = s_(email).toLowerCase();
  for (let i = 0; i < all.length; i++) {
    if (s_(all[i][4]).toLowerCase() === e) return { row: i + 2, v: all[i] };
  }
  return null;
}

function actWhoAmI_(b) {
  const v = verify_(b.idToken);
  if (!v.ok) return v;
  if (v.teacher) return { ok: true, teacher: true, email: v.email };
  const f = rosterFindByEmail_(v.email);
  if (!f) return { ok: true, linked: false, email: v.email };
  const m = memberOf_(s_(f.v[0]));
  return {
    ok: true, linked: true, email: v.email,
    sid: s_(f.v[0]), name: s_(f.v[1]), cls: s_(f.v[2]) || classOfSid_(f.v[0]),
    group: m ? Number(m.v[3]) || 0 : 0,
    job: m ? s_(m.v[4]) : '',
    role: m ? s_(m.v[5]) : ''
  };
}

/* 입장 */
function actGate_(b) {
  const v = verify_(b.idToken);
  if (!v.ok) return v;
  const sid = s_(b.sid), name = s_(b.name), pw = s_(b.pw);
  const cls = classOfSid_(sid);

  if (v.teacher) {
    const st0 = classState_(cls);
    return { ok: true, teacher: true, sid: sid, name: v.name || '교사', cls: cls, state: st0,
             group: 0, job: '', role: '' };
  }
  const st = classState_(cls);
  if (st.entry !== 'open') {
    log_(v.email, sid, cls, 'gate', 'ENTRY_' + st.entry.toUpperCase(), '');
    return { ok: false, error: st.entry === 'before' ? 'ENTRY_BEFORE'
                      : st.entry === 'after' ? 'ENTRY_AFTER' : 'ENTRY_CLOSED', state: st };
  }

  const lockKey = 'fail_' + sid;
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get(lockKey) || 0);
  if (fails >= 5) { log_(v.email, sid, cls, 'gate', 'LOCKED', ''); return { ok: false, error: 'LOCKED' }; }

  const f = rosterFind_(sid);
  if (!f) { log_(v.email, sid, cls, 'gate', 'NOT_IN_ROSTER', ''); return { ok: false, error: 'NOT_IN_ROSTER' }; }
  if (name && s_(f.v[1]) !== name) {
    log_(v.email, sid, cls, 'gate', 'NAME_MISMATCH', name);
    return { ok: false, error: 'NAME_MISMATCH' };
  }
  const want = s_(f.v[3]);
  if (want && want !== pw) {
    cache.put(lockKey, String(fails + 1), 300);
    log_(v.email, sid, cls, 'gate', 'WRONG_PASSWORD', '');
    return { ok: false, error: 'WRONG_PASSWORD' };
  }
  const bound = s_(f.v[4]).toLowerCase();
  if (bound && bound !== v.email) {
    log_(v.email, sid, cls, 'gate', 'ACCOUNT_MISMATCH', bound);
    return { ok: false, error: 'ACCOUNT_MISMATCH' };
  }
  if (!bound) {
    const other = rosterFindByEmail_(v.email);
    if (other && s_(other.v[0]) !== sid) {
      log_(v.email, sid, cls, 'gate', 'DUPLICATE_ACCOUNT', s_(other.v[0]));
      return { ok: false, error: 'DUPLICATE_ACCOUNT' };
    }
    sheet_(SH.ROST).getRange(f.row, 5).setValue(v.email);
  }
  sheet_(SH.ROST).getRange(f.row, 6).setValue(nowStr_());
  cache.remove(lockKey);
  log_(v.email, sid, cls, 'gate', 'OK', '');

  const m = memberOf_(sid);
  return {
    ok: true, sid: sid, name: s_(f.v[1]), cls: s_(f.v[2]) || cls, state: st,
    group: m ? Number(m.v[3]) || 0 : 0,
    job: m ? s_(m.v[4]) : '',
    role: m ? s_(m.v[5]) : ''
  };
}

/* ===========================================================================
 *  6. 모둠원 등록
 * =========================================================================*/

function memberOf_(sid) {
  const all = rows_(SH.MEM);
  for (let i = 0; i < all.length; i++) {
    if (s_(all[i][0]) === s_(sid)) return { row: i + 2, v: all[i] };
  }
  return null;
}
function membersOf_(cls, group) {
  const out = [];
  rows_(SH.MEM).forEach(function (r) {
    if (s_(r[2]) === s_(cls) && Number(r[3]) === Number(group)) {
      out.push({ sid: s_(r[0]), name: s_(r[1]), cls: s_(r[2]),
                 group: Number(r[3]), job: s_(r[4]), role: s_(r[5]) });
    }
  });
  out.sort(function (a, b) { return a.sid < b.sid ? -1 : 1; });
  return out;
}

function actGroupJoin_(b) {
  const v = verify_(b.idToken);
  if (!v.ok) return v;
  const sid = s_(b.sid);
  const cls = classOfSid_(sid);
  const group = Number(b.group || 0);
  const job = s_(b.job), role = s_(b.role);

  if (!(group >= 1 && group <= GROUP_COUNT)) return { ok: false, error: 'BAD_GROUP' };
  if (JOB_KEYS.indexOf(job) < 0) return { ok: false, error: 'BAD_JOB' };
  if (CAST_KEYS.indexOf(role) < 0) return { ok: false, error: 'BAD_ROLE' };
  if (!v.teacher) {
    const st = classState_(cls);
    if (st.entry !== 'open') return { ok: false, error: 'ENTRY_CLOSED' };
    const f = rosterFind_(sid);
    if (!f || s_(f.v[4]).toLowerCase() !== v.email) return { ok: false, error: 'ACCOUNT_MISMATCH' };
  }

  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (x) { return { ok: false, error: 'BUSY' }; }
  try {
    const mates = membersOf_(cls, group);
    for (let i = 0; i < mates.length; i++) {
      if (mates[i].sid === sid) continue;
      if (mates[i].job === job)  return { ok: false, error: 'JOB_TAKEN',  message: mates[i].name };
      if (mates[i].role === role) return { ok: false, error: 'ROLE_TAKEN', message: mates[i].name };
    }
    /* 모둠은 다섯 명이 기본입니다. 여섯 번째 자리(공동 대본)는
       기본 다섯 자리가 모두 찬 뒤에만 열립니다. 교사는 이 제한을 받지 않습니다. */
    if (job === 'script2' && !v.teacher) {
      const others = mates.filter(function (m) { return m.sid !== sid; });
      const full = CORE_JOBS.every(function (k) {
        return others.some(function (m) { return m.job === k; });
      });
      if (!full) return { ok: false, error: 'SEAT_NOT_OPEN' };
    }
    const f = rosterFind_(sid);
    const nm = f ? s_(f.v[1]) : s_(b.name);
    const me = memberOf_(sid);
    const row = [sid, nm, cls, group, job, role, nowStr_()];
    if (me) sheet_(SH.MEM).getRange(me.row, 1, 1, row.length).setValues([row]);
    else sheet_(SH.MEM).appendRow(row);
    ensureWork_(cls, group);
  } finally { lock.releaseLock(); }

  log_(v.email, sid, cls, 'groupJoin', 'OK', group + '/' + job + '/' + role);
  return { ok: true, group: group, job: job, role: role };
}

/* ===========================================================================
 *  7. 모둠 작업 문서
 * =========================================================================*/

function workFind_(cls, group) {
  const all = rows_(SH.WORK);
  for (let i = 0; i < all.length; i++) {
    if (s_(all[i][0]) === s_(cls) && Number(all[i][1]) === Number(group)) {
      return { row: i + 2, v: all[i] };
    }
  }
  return null;
}
function workRead_(cls, group) {
  const f = workFind_(cls, group);
  if (!f) return null;
  let data = {};
  try { data = JSON.parse(s_(f.v[7]) || '{}'); } catch (x) { data = {}; }
  data.submitted = truthy_(f.v[4]);
  data.submittedAt = s_(f.v[5]);
  data.rev = Number(f.v[6]) || 0;
  data.actNo = Number(f.v[2]) || Number(group);
  return { row: f.row, data: data };
}
function workWrite_(cls, group, data) {
  const f = workFind_(cls, group);
  const json = JSON.stringify(data);
  if (json.length > 48000) throw new Error('내용이 너무 깁니다. 대사를 조금 줄여 주세요.');
  const row = [cls, group, data.actNo || group, nowStr_(),
               !!data.submitted, s_(data.submittedAt || ''), Number(data.rev) || 0, json];
  if (f) sheet_(SH.WORK).getRange(f.row, 1, 1, row.length).setValues([row]);
  else sheet_(SH.WORK).appendRow(row);
}
function ensureWork_(cls, group) {
  if (workFind_(cls, group)) return;
  workWrite_(cls, group, {
    actNo: Number(group), actTitle: '', actTime: '', actPlace: '', sceneTitle: '', logline: '',
    castMap: {}, lines: [], numberTitle: '', lyrics: [],
    prompt: { genre: '', mood: '', inst: '', vocal: '' },
    structure: '', demo: { a: '', b: '', pick: '', why: '', link: '' }, staging: '',
    files: [], submitted: false, submittedAt: '', rev: 0
  });
}

function actGroupState_(b) {
  const v = verify_(b.idToken);
  if (!v.ok) return v;
  const sid = s_(b.sid);
  const cls = s_(b.cls) || classOfSid_(sid);
  const group = Number(b.group || 0);
  if (!(group >= 1 && group <= GROUP_COUNT)) return { ok: false, error: 'BAD_GROUP' };
  ensureWork_(cls, group);
  const w = workRead_(cls, group);
  let videos = [];
  try {
    videos = videoRows_(cls).filter(function (r) { return r.group === group; });
  } catch (x) { videos = []; }
  return {
    ok: true, state: classState_(cls), work: w ? w.data : null,
    members: membersOf_(cls, group), videos: videos, now: nowIso_()
  };
}

/* ---- 병합 저장 -----------------------------------------------------------
 *  fields    : 내가 담당한 칸만 반영합니다.
 *  lineOps   : [{op:'add'|'set'|'del'|'order', ...}] 대사·지문
 *  lyricOps  : [{op:'add'|'set'|'del'|'order', ...}] 가사
 *  내가 만든 줄만 고칠 수 있습니다. 순서 바꾸기는 대본 리더만 할 수 있습니다.
 * ------------------------------------------------------------------------*/
function actPatch_(b) {
  const v = verify_(b.idToken);
  if (!v.ok) return v;
  const sid = s_(b.sid);
  const cls = classOfSid_(sid);
  const st = classState_(cls);
  if (!v.teacher && st.entry !== 'open') return { ok: false, error: 'ENTRY_CLOSED', state: st };

  if (!v.teacher && !ownsSid_(v.email, sid)) return { ok: false, error: 'ACCOUNT_MISMATCH' };

  const me = memberOf_(sid);
  if (!me) return { ok: false, error: 'NO_GROUP' };
  const group = Number(me.v[3]), job = s_(me.v[4]), role = s_(me.v[5]);

  const lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (x) { return { ok: false, error: 'BUSY' }; }
  try {
    ensureWork_(cls, group);
    const w = workRead_(cls, group);
    const d = w.data;
    if (d.submitted && !truthy_(st.reopen) && !v.teacher) {
      return { ok: false, error: 'ALREADY_SUBMITTED' };
    }

    /* 1) 담당 칸 */
    const fields = b.fields || {};
    Object.keys(fields).forEach(function (k) {
      const owners = FIELD_OWNER[k];
      if (!owners) return;
      if (!v.teacher && owners.indexOf(job) < 0) return;
      d[k] = fields[k];
    });

    /* 2) 대사·지문 */
    d.lines = applyOps_(d.lines || [], b.lineOps || [], sid, job, role, v.teacher, true);
    /* 3) 가사 */
    d.lyrics = applyOps_(d.lyrics || [], b.lyricOps || [], sid, job, role, v.teacher, false);

    d.rev = (Number(d.rev) || 0) + 1;
    workWrite_(cls, group, d);
    return { ok: true, rev: d.rev, work: d, members: membersOf_(cls, group), state: st };
  } finally { lock.releaseLock(); }
}

function applyOps_(list, ops, sid, job, role, isTeacher, isLine) {
  const canOrder = isTeacher || job === 'script' || job === 'script2';
  const canDir   = isTeacher || job === 'script' || job === 'script2';
  const canLyric = isTeacher || job === 'lyric';
  const out = list.slice();

  (ops || []).forEach(function (op) {
    const kind = s_(op.kind || 'say');
    if (op.op === 'add') {
      if (isLine) {
        if (kind === 'dir' && !canDir) return;
        if (kind === 'say' && !isTeacher && s_(op.who) !== role && job !== 'script' && job !== 'script2') return;
      } else {
        if (!canLyric) return;
      }
      out.push({
        id: s_(op.id) || Utilities.getUuid().slice(0, 8),
        kind: isLine ? kind : 'lyric',
        who: s_(op.who), text: s_(op.text).slice(0, 1200),
        by: sid, at: nowStr_()
      });
    } else if (op.op === 'set' || op.op === 'del') {
      for (let i = 0; i < out.length; i++) {
        if (out[i].id !== s_(op.id)) continue;
        const mine = out[i].by === sid;
        const allowed = isTeacher || mine ||
          (isLine && out[i].kind === 'dir' && canDir) ||
          (isLine && out[i].kind === 'say' && s_(out[i].who) === role) ||
          (!isLine && canLyric);
        if (!allowed) return;
        if (op.op === 'del') out.splice(i, 1);
        else {
          out[i].text = s_(op.text).slice(0, 1200);
          if (op.who !== undefined && (canOrder || canLyric)) out[i].who = s_(op.who);
          out[i].at = nowStr_();
        }
        return;
      }
    } else if (op.op === 'order') {
      if (!canOrder && !(canLyric && !isLine)) return;
      const want = (op.ids || []).map(s_);
      const map = {}; out.forEach(function (x) { map[x.id] = x; });
      const next = [];
      want.forEach(function (id) { if (map[id]) { next.push(map[id]); delete map[id]; } });
      out.forEach(function (x) { if (map[x.id]) next.push(x); });
      out.length = 0; next.forEach(function (x) { out.push(x); });
    }
  });
  return out;
}

/* ===========================================================================
 *  8. 제출 — 발표 리더만
 * =========================================================================*/

function actSubmit_(b) {
  const v = verify_(b.idToken);
  if (!v.ok) return v;
  const sid = s_(b.sid);
  const cls = classOfSid_(sid);
  const st = classState_(cls);
  if (!v.teacher && !ownsSid_(v.email, sid)) return { ok: false, error: 'ACCOUNT_MISMATCH' };
  const me = memberOf_(sid);
  if (!me) return { ok: false, error: 'NO_GROUP' };
  const group = Number(me.v[3]), job = s_(me.v[4]);
  if (!v.teacher && job !== 'stage') return { ok: false, error: 'NOT_LEADER' };
  if (!v.teacher) {
    if (st.entry !== 'open') return { ok: false, error: 'ENTRY_CLOSED', state: st };
    if (st.submit !== 'open') {
      return { ok: false, error: st.submit === 'before' ? 'BEFORE_OPEN'
                        : st.submit === 'after' ? 'AFTER_CLOSE' : 'CLOSED', state: st };
    }
  }

  const lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (x) { return { ok: false, error: 'BUSY' }; }
  try {
    const w = workRead_(cls, group);
    if (!w) return { ok: false, error: 'NO_WORK' };
    const d = w.data;
    if (d.submitted && !truthy_(st.reopen) && !v.teacher) return { ok: false, error: 'ALREADY_SUBMITTED' };

    const miss = checkWork_(d, membersOf_(cls, group));
    if (miss.length && !v.teacher) return { ok: false, error: 'INCOMPLETE', missing: miss };

    d.submitted = true;
    d.submittedAt = nowStr_();
    d.rev = (Number(d.rev) || 0) + 1;
    workWrite_(cls, group, d);
    appendSubmission_(cls, group, d, membersOf_(cls, group));
    log_(v.email, sid, cls, 'submit', 'OK', '모둠' + group);
    return { ok: true, work: d, at: d.submittedAt };
  } finally { lock.releaseLock(); }
}

/** 제출 전 검사. 부족한 항목 이름을 돌려줍니다. */
function checkWork_(d, mates) {
  const miss = [];
  const lines = d.lines || [], lyr = d.lyrics || [];
  const says = lines.filter(function (x) { return x.kind === 'say'; });
  const dirs = lines.filter(function (x) { return x.kind === 'dir'; });
  const p = d.prompt || {};

  if (s_(d.actTitle).length < 2) miss.push('막 제목');
  if (s_(d.actPlace).length < 30) miss.push('무대 배경(30자 이상)');
  if (Object.keys(d.castMap || {}).length < 3) miss.push('배역 배정(3명 이상)');
  if (dirs.length < 2) miss.push('장면 지문(2줄 이상)');
  if (says.length < 12) miss.push('대사(12줄 이상)');
  if (s_(d.numberTitle).length < 2) miss.push('넘버 제목');
  if (lyr.length < 8) miss.push('가사(8줄 이상)');
  if (!s_(p.genre) || !s_(p.mood) || !s_(p.inst) || !s_(p.vocal)) miss.push('Suno 프롬프트 네 칸');
  if (s_(d.structure).length < 10) miss.push('넘버 구성');
  if (s_(d.staging).length < 20) miss.push('연출 노트');

  const wrote = {};
  lines.concat(lyr).forEach(function (x) { wrote[s_(x.by)] = true; });
  const idle = (mates || []).filter(function (m) { return !wrote[m.sid]; });
  if (idle.length) miss.push('아직 한 줄도 쓰지 않은 모둠원: ' +
    idle.map(function (m) { return m.name; }).join(', '));
  return miss;
}

function appendSubmission_(cls, group, d, mates) {
  const lines = d.lines || [], lyr = d.lyrics || [];
  const p = d.prompt || {};
  const wrote = {};
  lines.concat(lyr).forEach(function (x) { wrote[s_(x.by)] = true; });
  let vid = 0;
  try { vid = videoRows_(cls).filter(function (r) { return r.group === group; }).length; } catch (x) {}
  sheet_(SH.SUB).appendRow([
    nowStr_(), cls, group, d.actNo || group, s_(d.actTitle), s_(d.actTime), s_(d.actPlace),
    lines.filter(function (x) { return x.kind === 'dir'; }).length,
    lines.filter(function (x) { return x.kind === 'say'; }).length,
    Object.keys(wrote).length,
    s_(d.numberTitle), lyr.length,
    s_(p.genre), s_(p.mood), s_(p.inst), s_(p.vocal),
    s_(d.structure), s_(d.staging),
    (mates || []).map(function (m) { return m.name + '(' + m.job + '/' + m.role + ')'; }).join(', '),
    (d.files || []).length,
    vid ? ('예 (' + vid + '건)') : '아니오',
    plainScript_(d).slice(0, 48000)
  ]);
}

/** 시트에 넣을 대본 전문 (교사가 그대로 읽을 수 있는 글) */
function plainScript_(d) {
  const out = [];
  out.push('제' + (d.actNo || '') + '막 ｜ ' + s_(d.actTime) + ' – ' + s_(d.actTitle));
  if (s_(d.actPlace)) out.push('무대 배경 ｜ ' + s_(d.actPlace));
  if (s_(d.sceneTitle)) out.push('장면. ' + s_(d.sceneTitle));
  out.push('');
  (d.lines || []).forEach(function (x) {
    if (x.kind === 'dir') out.push('  ' + s_(x.text));
    else out.push(s_(x.who) + '\t' + s_(x.text));
  });
  out.push('');
  out.push('♪ ' + s_(d.numberTitle));
  (d.lyrics || []).forEach(function (x) {
    if (s_(x.who)) out.push('[' + s_(x.who) + ']');
    out.push('  ' + s_(x.text));
  });
  const p = d.prompt || {};
  out.push('');
  out.push('[ Suno AI 프롬프트 ]');
  out.push('Genre: ' + s_(p.genre));
  out.push('Mood: ' + s_(p.mood));
  out.push('Instruments: ' + s_(p.inst));
  out.push('Vocal Structure: ' + s_(p.vocal));
  if (s_(d.structure)) { out.push(''); out.push('[ 넘버 구성 ] ' + s_(d.structure)); }
  if (s_(d.staging))   { out.push(''); out.push('[ 연출 노트 ] ' + s_(d.staging)); }
  return out.join('\n');
}

/* ===========================================================================
 *  8-2. 파일 제출
 *
 *  음원·이미지는 여기서 바로 받아 교사 드라이브에 넣습니다.
 *  동영상은 파일이 커서 구글 폼으로 받습니다(폼 응답 시트를 읽어 현황만 봅니다).
 * =========================================================================*/

/** 교사 드라이브에 폴더를 만들어 둡니다.  MUSICALINUS 제출 / 3-3 / 1모둠 */
function folderFor_(cls, group) {
  const root = subFolder_(DriveApp.getRootFolder(), DRIVE_ROOT);
  const byClass = subFolder_(root, s_(cls) || '기타');
  return subFolder_(byClass, group + '모둠');
}
function subFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function actUpload_(b) {
  const v = verify_(b.idToken);
  if (!v.ok) return v;
  const sid = s_(b.sid);
  const cls = classOfSid_(sid);
  const st = classState_(cls);
  if (!v.teacher && !ownsSid_(v.email, sid)) return { ok: false, error: 'ACCOUNT_MISMATCH' };
  if (!v.teacher && st.entry !== 'open') return { ok: false, error: 'ENTRY_CLOSED', state: st };

  const me = memberOf_(sid);
  if (!me) return { ok: false, error: 'NO_GROUP' };
  const group = Number(me.v[3]);
  const name = s_(b.name).replace(/[\\\/:*?"<>|]/g, '_').slice(0, 120);
  const mime = s_(b.mime);
  const data = s_(b.data);        /* base64 (앞머리 없이) */

  if (!name || !data) return { ok: false, error: 'NO_FILE' };
  if (OK_MIME.indexOf(mime) < 0) return { ok: false, error: 'BAD_TYPE', message: mime };
  /* base64 는 원본보다 약 1.33배 큽니다 */
  const bytes = Math.floor(data.length * 3 / 4);
  if (bytes > MAX_UPLOAD_MB * 1024 * 1024) {
    return { ok: false, error: 'TOO_BIG', message: String(Math.round(bytes / 1024 / 1024)) };
  }

  const lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (x) { return { ok: false, error: 'BUSY' }; }
  try {
    ensureWork_(cls, group);
    const w = workRead_(cls, group);
    const d = w.data;
    d.files = d.files || [];
    if (d.files.length >= 30) return { ok: false, error: 'TOO_MANY' };

    let file;
    try {
      const blob = Utilities.newBlob(Utilities.base64Decode(data), mime, name);
      file = folderFor_(cls, group).createFile(blob);
      /* 같은 학교 도메인 안에서 링크로 볼 수 있게 (모둠원끼리 들어 보기 위해) */
      try { file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); }
      catch (x) { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
    } catch (err) {
      log_(v.email, sid, cls, 'upload', 'DRIVE_FAIL', String(err));
      return { ok: false, error: 'DRIVE_FAIL', message: String(err).slice(0, 200) };
    }

    const rec = {
      id: file.getId(),
      name: name,
      mime: mime,
      kind: mime.indexOf('audio') === 0 ? 'audio' : mime.indexOf('image') === 0 ? 'image' : 'doc',
      size: bytes,
      url: 'https://drive.google.com/file/d/' + file.getId() + '/view',
      preview: 'https://drive.google.com/file/d/' + file.getId() + '/preview',
      by: sid,
      byName: s_(me.v[1]),
      at: nowStr_()
    };
    d.files.push(rec);
    d.rev = (Number(d.rev) || 0) + 1;
    workWrite_(cls, group, d);

    sheet_(SH.FILE).appendRow([
      rec.at, cls, group, rec.byName, sid, rec.kind, rec.name,
      Math.round(bytes / 1024), rec.id, rec.url, '보관']);
    log_(v.email, sid, cls, 'upload', 'OK', rec.name);

    return { ok: true, file: rec, work: d, members: membersOf_(cls, group), state: st };
  } finally { lock.releaseLock(); }
}

function actDeleteFile_(b) {
  const v = verify_(b.idToken);
  if (!v.ok) return v;
  const sid = s_(b.sid);
  const cls = classOfSid_(sid);
  if (!v.teacher && !ownsSid_(v.email, sid)) return { ok: false, error: 'ACCOUNT_MISMATCH' };
  const me = memberOf_(sid);
  if (!me) return { ok: false, error: 'NO_GROUP' };
  const group = Number(me.v[3]), job = s_(me.v[4]);
  const fid = s_(b.fileId);

  const lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (x) { return { ok: false, error: 'BUSY' }; }
  try {
    const w = workRead_(cls, group);
    if (!w) return { ok: false, error: 'NO_WORK' };
    const d = w.data;
    d.files = d.files || [];
    const i = d.files.findIndex ? d.files.findIndex(function (x) { return x.id === fid; })
                                : indexOfFile_(d.files, fid);
    if (i < 0) return { ok: false, error: 'NO_FILE' };
    /* 올린 사람, 발표 리더, 교사만 지울 수 있습니다 */
    if (!v.teacher && d.files[i].by !== sid && job !== 'stage') {
      return { ok: false, error: 'NOT_OWNER' };
    }
    try { DriveApp.getFileById(fid).setTrashed(true); } catch (x) {}
    const gone = d.files.splice(i, 1)[0];
    d.rev = (Number(d.rev) || 0) + 1;
    workWrite_(cls, group, d);
    markFileRow_(fid, '지움');
    log_(v.email, sid, cls, 'deleteFile', 'OK', gone.name);
    return { ok: true, work: d, members: membersOf_(cls, group) };
  } finally { lock.releaseLock(); }
}
function indexOfFile_(arr, id) {
  for (let i = 0; i < arr.length; i++) if (arr[i].id === id) return i;
  return -1;
}
function markFileRow_(fid, state) {
  const sh = sheet_(SH.FILE);
  const last = sh.getLastRow();
  if (last < 2) return;
  const ids = sh.getRange(2, 9, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (s_(ids[i][0]) === s_(fid)) { sh.getRange(i + 2, 11).setValue(state); return; }
  }
}

/* ---- 영상 폼 응답 읽기 ---------------------------------------------------
 *  폼 응답을 이 스프레드시트로 받으면 '폼 응답 1' 시트가 생깁니다.
 *  머리글에 '학급' '모둠' '학번' 이 들어간 열을 찾아 씁니다.
 *  폼이 없거나 시트가 없으면 조용히 빈 값을 돌려줍니다.
 * ------------------------------------------------------------------------*/
function videoRows_(cls) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(FORM_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const w = sh.getLastColumn();
  const head = sh.getRange(1, 1, 1, w).getValues()[0].map(s_);
  const find = function (kw) {
    for (let i = 0; i < head.length; i++) if (head[i].indexOf(kw) >= 0) return i;
    return -1;
  };
  const cC = find('학급'), cG = find('모둠'), cS = find('학번'), cN = find('이름');
  let cF = -1;
  for (let i = 0; i < head.length; i++) {
    if (head[i].indexOf('영상') >= 0 || head[i].indexOf('파일') >= 0 || head[i].indexOf('업로드') >= 0) { cF = i; break; }
  }
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, w).getValues();
  const out = [];
  vals.forEach(function (r) {
    const rc = cC >= 0 ? s_(r[cC]) : '';
    if (cls && rc && rc !== s_(cls)) return;
    out.push({
      at: fmt_(r[0]),
      cls: rc,
      group: cG >= 0 ? Number(String(r[cG]).replace(/[^0-9]/g, '')) || 0 : 0,
      sid: cS >= 0 ? s_(r[cS]) : '',
      name: cN >= 0 ? s_(r[cN]) : '',
      link: cF >= 0 ? s_(r[cF]) : ''
    });
  });
  return out;
}

/* ===========================================================================
 *  9. 교사
 * =========================================================================*/

function actTeacherHello_(b) {
  const v = needTeacher_(b);
  if (!v.ok) return v;
  return { ok: true, version: VERSION, email: v.email, name: v.name,
           classes: CLASS_LIST, groups: GROUP_COUNT, now: nowIso_() };
}

function actTeacherConfig_(b) {
  const v = needTeacher_(b);
  if (!v.ok) return v;
  const sh = sheet_(SH.CFG);
  const last = sh.getLastRow();
  const vals = last < 2 ? [] : sh.getRange(2, 1, last - 1, HEAD.CFG.length).getValues();
  const rowsOut = vals.map(function (r) {
    return {
      cls: s_(r[0]), entryOn: truthy_(r[1]), entryStart: fmt_(r[2]), entryEnd: fmt_(r[3]),
      submitOn: truthy_(r[4]), reopen: truthy_(r[5]), submitStart: fmt_(r[6]), submitEnd: fmt_(r[7]),
      notice: s_(r[8]),
      raw: [s_(r[1]), fmt_(r[2]), fmt_(r[3]), s_(r[4]), s_(r[5]), fmt_(r[6]), fmt_(r[7]), s_(r[8])]
    };
  });
  return { ok: true, rows: rowsOut, now: nowIso_(), version: VERSION };
}
function fmt_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  }
  return s_(v);
}

function actTeacherSetConfig_(b) {
  const v = needTeacher_(b);
  if (!v.ok) return v;
  return setCfg_([{ cls: b.cls, patch: b.patch || {} }]);
}
function actTeacherSetConfigAll_(b) {
  const v = needTeacher_(b);
  if (!v.ok) return v;
  return setCfg_(b.patches || []);
}
function setCfg_(list) {
  const sh = sheet_(SH.CFG);
  const last = sh.getLastRow();
  const vals = last < 2 ? [] : sh.getRange(2, 1, last - 1, HEAD.CFG.length).getValues();
  const COL = { entryOn: 1, entryStart: 2, entryEnd: 3, submitOn: 4, reopen: 5,
                submitStart: 6, submitEnd: 7, notice: 8 };
  list.forEach(function (item) {
    const cls = s_(item.cls);
    let idx = -1;
    for (let i = 0; i < vals.length; i++) { if (s_(vals[i][0]) === cls) { idx = i; break; } }
    if (idx < 0) { vals.push([cls, '', '', '', '', '', '', '', '']); idx = vals.length - 1; }
    Object.keys(item.patch || {}).forEach(function (k) {
      if (COL[k] === undefined) return;
      vals[idx][COL[k]] = item.patch[k];
    });
    bustState_(cls);
  });
  if (vals.length) sh.getRange(2, 1, vals.length, HEAD.CFG.length).setValues(vals);
  return { ok: true };
}

function actTeacherStatus_(b) {
  const v = needTeacher_(b);
  if (!v.ok) return v;
  const cls = s_(b.cls);
  let allVideos = [];
  try { allVideos = videoRows_(cls); } catch (x) { allVideos = []; }
  const groups = [];
  for (let g = 1; g <= GROUP_COUNT; g++) {
    const w = workRead_(cls, g);
    const mates = membersOf_(cls, g);
    const d = w ? w.data : null;
    const lines = d ? (d.lines || []) : [];
    const lyr = d ? (d.lyrics || []) : [];
    const wrote = {};
    lines.concat(lyr).forEach(function (x) { wrote[s_(x.by)] = true; });
    groups.push({
      group: g,
      actNo: d ? (d.actNo || g) : g,
      actTitle: d ? s_(d.actTitle) : '',
      numberTitle: d ? s_(d.numberTitle) : '',
      members: mates,
      files: d ? (d.files || []) : [],
      videos: allVideos.filter(function (r) { return r.group === g; }),
      says: lines.filter(function (x) { return x.kind === 'say'; }).length,
      dirs: lines.filter(function (x) { return x.kind === 'dir'; }).length,
      lyrics: lyr.length,
      active: Object.keys(wrote).length,
      submitted: d ? !!d.submitted : false,
      submittedAt: d ? s_(d.submittedAt) : '',
      missing: d ? checkWork_(d, mates) : ['아직 시작하지 않음'],
      rev: d ? (d.rev || 0) : 0
    });
  }
  /* 모둠에 아직 들어가지 않은 학생 */
  const inGroup = {};
  rows_(SH.MEM).forEach(function (r) { if (s_(r[2]) === cls) inGroup[s_(r[0])] = true; });
  const idle = [];
  rows_(SH.ROST).forEach(function (r) {
    const c = s_(r[2]) || classOfSid_(r[0]);
    if (c === cls && !inGroup[s_(r[0])]) idle.push({ sid: s_(r[0]), name: s_(r[1]) });
  });
  return { ok: true, cls: cls, groups: groups, unassigned: idle, state: classState_(cls), now: nowIso_() };
}

function actTeacherScript_(b) {
  const v = needTeacher_(b);
  if (!v.ok) return v;
  const cls = s_(b.cls);
  const acts = [];
  for (let g = 1; g <= GROUP_COUNT; g++) {
    const w = workRead_(cls, g);
    acts.push({ group: g, work: w ? w.data : null, members: membersOf_(cls, g) });
  }
  return { ok: true, cls: cls, acts: acts, now: nowIso_() };
}

function actTeacherRoster_(b) {
  const v = needTeacher_(b);
  if (!v.ok) return v;
  const mem = {};
  rows_(SH.MEM).forEach(function (r) {
    mem[s_(r[0])] = { group: Number(r[3]) || 0, job: s_(r[4]), role: s_(r[5]) };
  });
  const list = rows_(SH.ROST).map(function (r) {
    const m = mem[s_(r[0])] || {};
    return { sid: s_(r[0]), name: s_(r[1]), cls: s_(r[2]) || classOfSid_(r[0]),
             pw: s_(r[3]), bound: s_(r[4]), seen: fmt_(r[5]),
             group: m.group || 0, job: m.job || '', role: m.role || '' };
  });
  return { ok: true, rows: list, count: list.length };
}

function actTeacherRosterUpsert_(b) {
  const v = needTeacher_(b);
  if (!v.ok) return v;
  const incoming = (b.rows || []).map(function (r) {
    return { sid: s_(r.sid), name: s_(r.name), pw: s_(r.pw) };
  }).filter(function (r) { return /^\d{4}$/.test(r.sid) && r.name; });
  if (!incoming.length) return { ok: false, error: 'EMPTY' };

  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (x) { return { ok: false, error: 'BUSY' }; }
  try {
    const sh = sheet_(SH.ROST);
    const last = sh.getLastRow();
    const vals = last < 2 ? [] : sh.getRange(2, 1, last - 1, HEAD.ROST.length).getValues();
    const idx = {};
    vals.forEach(function (r, i) { idx[s_(r[0])] = i; });
    let added = 0, updated = 0;
    incoming.forEach(function (r) {
      const cls = classOfSid_(r.sid);
      if (idx[r.sid] === undefined) {
        vals.push([r.sid, r.name, cls, r.pw, '', '']);
        idx[r.sid] = vals.length - 1; added++;
      } else {
        const i = idx[r.sid];
        vals[i][1] = r.name; vals[i][2] = cls;
        if (r.pw) vals[i][3] = r.pw;
        updated++;
      }
    });
    vals.sort(function (a, b2) { return s_(a[0]) < s_(b2[0]) ? -1 : 1; });
    sh.getRange(2, 1, vals.length, HEAD.ROST.length).setValues(vals);
    return { ok: true, added: added, updated: updated, total: vals.length };
  } finally { lock.releaseLock(); }
}

function actTeacherSetGroup_(b) {
  const v = needTeacher_(b);
  if (!v.ok) return v;
  const sid = s_(b.sid);
  const cls = classOfSid_(sid);
  const group = Number(b.group || 0);
  const me = memberOf_(sid);
  if (group === 0) {
    if (me) sheet_(SH.MEM).deleteRow(me.row);
    return { ok: true, removed: true };
  }
  const f = rosterFind_(sid);
  const row = [sid, f ? s_(f.v[1]) : s_(b.name), cls, group, s_(b.job), s_(b.role), nowStr_()];
  if (me) sheet_(SH.MEM).getRange(me.row, 1, 1, row.length).setValues([row]);
  else sheet_(SH.MEM).appendRow(row);
  ensureWork_(cls, group);
  return { ok: true };
}

function actTeacherResetBinding_(b) {
  const v = needTeacher_(b);
  if (!v.ok) return v;
  const f = rosterFind_(s_(b.sid));
  if (!f) return { ok: false, error: 'NOT_IN_ROSTER' };
  sheet_(SH.ROST).getRange(f.row, 5).setValue('');
  return { ok: true };
}

function actTeacherReopen_(b) {
  const v = needTeacher_(b);
  if (!v.ok) return v;
  const cls = s_(b.cls), group = Number(b.group);
  const w = workRead_(cls, group);
  if (!w) return { ok: false, error: 'NO_WORK' };
  w.data.submitted = false;
  w.data.rev = (w.data.rev || 0) + 1;
  workWrite_(cls, group, w.data);
  return { ok: true };
}

function actTeacherLogs_(b) {
  const v = needTeacher_(b);
  if (!v.ok) return v;
  const all = rows_(SH.LOG);
  const tail = all.slice(Math.max(0, all.length - 200));
  return { ok: true, rows: tail.map(function (r) {
    return { at: fmt_(r[0]), email: s_(r[1]), sid: s_(r[2]), cls: s_(r[3]),
             act: s_(r[4]), result: s_(r[5]), note: s_(r[6]) };
  }) };
}
