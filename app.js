'use strict';
let demo;
let selected;
const MATCH = '입력값 부합';
const MISMATCH = '입력값 미부합';
const $ = id => document.getElementById(id);
function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value == null ? '' : String(value);
  if (className) node.className = className;
  return node;
}
// 화면 판정은 검증 코드의 결과 필드만 읽는다. 새 판정을 만들지 않는다.
function statusOf(row) {
  if (!row.evidence_valid) return ['원문 재확인', 'hold'];
  if (row.result === MATCH) return ['부합', 'match'];
  if (row.result === MISMATCH) return ['미부합', 'mismatch'];
  return ['사람 확인', 'hold'];
}
function holdSummary(rows) {
  const counts = new Map();
  for (const r of rows.filter(r => !r.automatic)) {
    const reason = r.reason || '사유 기록 없음';
    counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  const list = [...counts].sort((a, b) => b[1] - a[1]).map(([reason, n]) => {
    const li = document.createElement('li');
    li.append(text('strong', `${n}건`), text('span', ` ${reason}`));
    return li;
  });
  $('hold-section').hidden = list.length === 0;
  $('hold-list').replaceChildren(...list);
}
function rowView(row) {
  const [label, tone] = statusOf(row);
  const card = document.createElement('article');
  card.className = 'card';
  const head = document.createElement('div');
  head.className = 'card-head';
  head.append(text('span', row.id, 'item-id'), text('span', label, `pill ${tone}`));
  const title = text('h3', row.ai_summary, 'card-title');
  const why = document.createElement('p');
  why.className = 'card-why';
  why.append(text('strong', row.evidence_valid ? `원문 ${row.page}쪽 확인. ` : '원문 확인 필요. '), text('span', row.reason ? `사유: ${row.reason}` : ''));
  const details = document.createElement('details');
  details.className = 'fold';
  details.append(text('summary', '원문과 세부 내용 보기'));
  const list = document.createElement('dl');
  const values = [
    ['종류', `${row.kind} (announcement.pdf ${row.page}쪽)`],
    ['원문 인용', row.raw_quote],
    ['조건·예외', row.conditions || '별도 조건 기록 없음'],
    ['필요 기관정보', row.required_info],
    ['자동 판정', row.automatic ? '예 - 단일 요소만 비교' : '아니오']
  ];
  for (const [key, value] of values) list.append(text('dt', key), text('dd', value, key === '원문 인용' ? 'quote' : ''));
  if (row.evidence_valid) {
    const link = text('a', `원문 PDF ${row.page}쪽 열기`);
    link.href = `announcement.pdf#page=${row.page}`;
    link.target = '_blank'; link.rel = 'noopener';
    const dd = text('dd', '', 'no-print'); dd.append(link);
    list.append(text('dt', '원문 위치', 'no-print'), dd);
  }
  details.append(list);
  card.append(head, title, why, details);
  return card;
}
// 중요한 것부터: 자동 판정 → 원문 재확인 → 사람 확인. 뒤의 두 그룹은 접어 둔다.
function groupBlock(title, items, open, note) {
  const block = document.createElement('details');
  block.className = 'fold group';
  block.open = open;
  const summary = document.createElement('summary');
  summary.append(text('span', `${title} ${items.length}건`));
  block.append(summary, text('p', note, 'muted'), ...items.map(rowView));
  return block;
}
function renderGroups(rows) {
  const auto = rows.filter(r => r.evidence_valid && r.automatic);
  const check = rows.filter(r => !r.evidence_valid);
  const manual = rows.filter(r => r.evidence_valid && !r.automatic);
  const blocks = [
    groupBlock('자동 판정한 항목', auto, true,
      auto.length ? '소재지 단일 요소만 입력값과 비교했습니다. 전체 신청 가능 여부는 판단하지 않습니다.' : '이 응답에서 자동 판정된 항목은 없습니다. 나머지는 모두 사람이 확인해야 합니다.')
  ];
  if (check.length) blocks.push(groupBlock('원문 재확인 필요', check, false, '인용 위치나 쪽 번호가 원문과 맞지 않습니다. 원문 PDF에서 직접 확인해 주세요.'));
  if (manual.length) blocks.push(groupBlock('사람이 확인할 항목', manual, false, '조건·예외·정성 요건이라 자동으로 판정하지 않았습니다.'));
  $('groups').replaceChildren(...blocks);
}
function render() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const region = $('region').value;
  selected = demo.variants[mode][region];
  $('download').href = selected.document_url;
  $('download').download = selected.document_url.split('/').pop();
  const m = selected.metrics;
  $('verdict').textContent = m.automatic_comparisons
    ? `자동 판정 ${m.automatic_comparisons}건, 사람이 확인할 항목 ${m.manual}건입니다.`
    : `이 공고는 자동 판정이 0건이고, ${m.manual}건을 사람이 직접 확인해야 합니다.`;
  $('count-items').textContent = m.extracted_items;
  $('count-evidence').textContent = `${m.evidence_match} / ${m.extracted_items}`;
  $('count-auto').textContent = m.automatic_comparisons;
  $('count-manual').textContent = m.manual;
  $('mode-note').textContent = mode === 'live' ? '실제 AI 호출 1회에서 저장한 응답입니다. 지금 AI를 호출한 결과가 아닙니다.' : 'AI 작성 기준표 초안에서 만든 고정 응답입니다. 실제 AI 실험·성능 수치가 아닙니다.';
  $('automation-note').textContent = m.automatic_comparisons ? '자동 판정은 소재지 단일 요소 1건뿐입니다. 기업 유형·인증·전체 신청 가능 여부를 뜻하지 않습니다.' : '자동 판정 0건입니다. 자격 판단 결과가 아니며 담당자 확인이 필요합니다.';
  $('automation-note').classList.toggle('warning', m.automatic_comparisons === 0);
  $('input-context').textContent = `실험용 가상 소재지: ${region} / 기준일: ${selected.company.evaluation_date}`;
  holdSummary(selected.rows);
  renderGroups(selected.rows);
  $('coverage-note').textContent = `초안 인용 구간 ${m.draft_quote_spans}개 중 응답에 없는 구간 ${m.draft_quote_spans_absent}개. 병합 항목의 부분 인용도 포함으로 계산하며, 실제 누락 총수나 의미 정확도 지표가 아닙니다.`;
  $('coverage').replaceChildren(...selected.coverage.map(row => {
    const div = text('div', '', 'coverage-row');
    div.append(text('span', `${row.draft_id} · ${row.draft_label}`), text('span', row.quote_span_present_in_live_rows ? '인용 구간 포함' : '인용 구간 없음'));
    return div;
  }));
  $('company').textContent = JSON.stringify(selected.company, null, 2);
}
// 사례를 상황별로 묶어 한 줄씩 보여 준다. 원본 사례는 전체 보기에 그대로 둔다.
function renderDefenseSummary(defense) {
  const groups = new Map();
  for (const r of defense.rows) {
    if (!groups.has(r.group)) groups.set(r.group, []);
    groups.get(r.group).push(r);
  }
  const head = ['상황', '사례 수', 'GrantFit 결과', '예시 사유'];
  const table = document.createElement('table');
  table.className = 'simple-table';
  const tr = document.createElement('tr');
  for (const h of head) tr.append(text('th', h));
  const thead = document.createElement('thead'); thead.append(tr); table.append(thead);
  const tbody = document.createElement('tbody');
  for (const [group, rows] of groups) {
    const matched = rows.filter(r => r.actual === MATCH).length;
    const row = document.createElement('tr');
    row.append(text('td', group), text('td', rows.length), text('td', `부합 ${matched}건 / 부합 아님·보류 ${rows.length - matched}건`), text('td', rows[0].reason));
    tbody.append(row);
  }
  table.append(tbody);
  $('defense-summary').replaceChildren(table);
}
function renderDefense(defense) {
  if (!defense) { $('defense-entry').hidden = true; $('defense-panel').hidden = true; return; }
  renderDefenseSummary(defense);
  const head = ['사례 그룹', '사례 ID', '기대 결과', '실제 결과', '근거 검증', '검토 사유'];
  const table = document.createElement('table');
  table.className = 'defense-table';
  const tr = document.createElement('tr');
  for (const h of head) tr.append(text('th', h));
  const thead = document.createElement('thead'); thead.append(tr); table.append(thead);
  const tbody = document.createElement('tbody');
  for (const r of defense.rows) {
    const row = document.createElement('tr');
    const blocked = r.actual !== MATCH;
    row.append(
      text('td', r.group), text('td', r.case), text('td', r.expected),
      text('td', r.actual, blocked ? 'blk' : 'ok'),
      text('td', r.evidence_valid ? '통과' : '차단'), text('td', r.reason));
    tbody.append(row);
  }
  table.append(tbody);
  const wrap = text('div', '', 'defense-wrap');
  wrap.append(table);
  $('defense').replaceChildren(wrap);
}
async function start() {
  try {
    const response = await fetch('demo-data.json?v=20261023-docx');
    if (!response.ok) throw new Error('data unavailable');
    demo = await response.json();
    const defense = await fetch('defense-cases.json').then(r => r.ok ? r.json() : null).catch(() => null);
    renderDefense(defense);
    $('defense-toggle').addEventListener('click', () => {
      const open = $('defense-panel').hidden;
      $('defense-panel').hidden = !open;
      $('defense-toggle').setAttribute('aria-expanded', String(open));
    });
    for (const region of demo.regions) {
      const option = text('option', region); option.value = region; $('region').append(option);
    }
    $('source-title').textContent = demo.source.title;
    $('source-meta').textContent = `${demo.source.publisher} / 게시일 ${demo.source.posted_date} / 접수마감된 과거 사례 / 확인일 2026-10-21`;
    $('source-link').href = demo.source.source_url;
    document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', render));
    $('region').addEventListener('change', render);
    $('print').addEventListener('click', () => window.print());
    $('loading').hidden = true; $('app').hidden = false; render();
  } catch (_) {
    $('loading').textContent = '자료를 불러오지 못했습니다. 잠시 후 새로고침해 주세요. 이 데모는 HTTPS 공유 주소 또는 로컬 HTTP 서버에서 열어야 합니다.';
  }
}
let closedBeforePrint = [];
window.addEventListener('beforeprint', () => {
  closedBeforePrint = [...document.querySelectorAll('details:not([open])')];
  closedBeforePrint.forEach(d => d.open = true);
});
window.addEventListener('afterprint', () => closedBeforePrint.forEach(d => d.open = false));
start();
