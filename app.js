'use strict';
let demo;
let selected;
const MATCH = '입력값 부합';
const MISMATCH = '입력값 미부합';
const attached = new Map(); // 제출서류 id → 첨부 파일 이름. 메모리에만 두며 저장하지 않는다.
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
  return ['담당자 확인', 'hold'];
}
function holdSummary(rows) {
  const counts = new Map();
  for (const r of rows.filter(r => !r.automatic)) {
    const reason = r.reason || '사유 기록 없음';
    counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  const list = [...counts].sort((a, b) => b[1] - a[1]).map(([reason, n]) => {
    const li = document.createElement('li');
    li.append(text('strong', `${n}건`), text('span', ` ${GrantFitGroups.humanize(reason)}`));
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
  const aiLabel = text('p', 'AI 요약 (미검증)', 'ai-label');
  const title = text('h3', row.ai_summary, 'card-title');
  const orNote = GrantFitGroups.summaryAddsOr(row)
    ? text('p', `검토 의견: AI 요약·확인 정보에 ‘또는’이 있으나 원문 인용에는 없습니다. 제출 관계는 원문과 담당자 확인 (원문 ${row.page}쪽).`, 'review-note')
    : null;
  const why = document.createElement('p');
  why.className = 'card-why';
  why.append(text('strong', row.evidence_valid ? `원문 ${row.page}쪽 확인. ` : '원문 확인 필요. '), text('span', row.reason ? GrantFitGroups.humanize(row.reason) : ''));
  const need = text('p', `확인할 정보: ${GrantFitGroups.humanize(row.required_info)}`, 'card-need');
  const details = document.createElement('details');
  details.className = 'fold';
  details.append(text('summary', '원문 보기'));
  const list = document.createElement('dl');
  const values = [
    ['종류', `${row.kind} (announcement.pdf ${row.page}쪽)`],
    ['원문 인용', row.raw_quote],
    ['조건·예외', row.conditions || '없음'],
    ['자동 판정', row.automatic ? '예 (단일 요소만 비교)' : '아니오']
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
  card.append(head, aiLabel, title, ...(orNote ? [orNote] : []), why, need, details);
  return card;
}
// 업무 순서 그룹. 그룹 분류는 grouping.js가 맡고, 여기서는 화면만 그린다.
// 첫 번째로 항목이 있는 그룹만 펼치고 나머지는 접는다.
function groupBlock(group, items, open) {
  const block = document.createElement('details');
  block.className = 'fold group';
  block.open = open;
  const summary = document.createElement('summary');
  summary.append(text('span', `${group.title} ${items.length}건`));
  block.append(summary, text('p', group.note, 'muted'), ...items.map(rowView));
  return block;
}
function renderGroups(rows) {
  const groups = GrantFitGroups.groupRows(rows);
  for (const g of groups) if (g.key === 'requirements') g.note = GrantFitGroups.autoNote(rows);
  const firstFilled = groups.find(g => g.rows.length);
  const blocks = groups
    .filter(g => g.rows.length || g.key === 'requirements')
    .map(g => groupBlock(g, g.rows, g === firstFilled || (g.key === 'requirements' && !firstFilled)));
  if (!blocks.length) blocks.push(text('p', '표시할 항목이 없습니다.', 'muted'));
  $('groups').replaceChildren(...blocks);
}
// 입력한 소재지·기업 유형과 관련된 항목만 골라 보여 준다. 판정 결과를 새로 계산하지 않는다.
function renderMyMatches(rows) {
  const orgType = $('org-type').value.trim();
  const region = $('region').value;
  const wanted = [];
  if (region) wanted.push('소재');
  if (orgType) wanted.push('기업 유형');
  const related = rows.filter(r => {
    const need = GrantFitGroups.humanize(r.required_info);
    return wanted.some(w => need.includes(w));
  });
  const lines = related.map(r => {
    const line = document.createElement('li');
    const state = r.automatic ? `자동 판정: ${r.result}` : '담당자 확인';
    line.append(text('strong', r.id), text('span', ` ${r.ai_summary} · ${state}`));
    return line;
  });
  const head = related.length
    ? `입력 정보와 관련된 항목 ${related.length}건 (판정은 저장된 응답 기준)`
    : '입력 정보와 관련된 항목이 없습니다.';
  const list = document.createElement('ul');
  list.append(...lines);
  $('my-matches').replaceChildren(text('p', head, 'muted'), list);
}
// 제출서류 첨부 확인. 파일 내용은 읽거나 올리지 않고, 파일 이름과 첨부 여부만 이 화면 메모리에 둔다.
function attachedText(id) {
  return attached.has(id) ? `첨부됨: ${attached.get(id)}` : '미첨부';
}
function renderChecklist(rows) {
  const docs = rows.filter(r => r.kind === '제출서류');
  const items = docs.map(r => {
    const row = document.createElement('div');
    row.className = 'check';
    const status = text('span', attachedText(r.id), 'check-status');
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('aria-label', `${r.id} 서류 파일 선택`);
    const clear = text('button', '해제', 'check-clear');
    clear.type = 'button';
    input.addEventListener('change', () => {
      if (input.files.length) attached.set(r.id, input.files[0].name);
      else attached.delete(r.id);
      status.textContent = attachedText(r.id);
      updateChecklistCount(docs);
    });
    clear.addEventListener('click', () => {
      input.value = '';
      attached.delete(r.id);
      status.textContent = attachedText(r.id);
      updateChecklistCount(docs);
    });
    row.append(text('span', `${r.id} ${r.ai_summary}`, 'check-label'), status, input, clear);
    return row;
  });
  $('checklist').replaceChildren(...items);
  updateChecklistCount(docs);
}
function updateChecklistCount(docs) {
  const done = docs.filter(r => attached.has(r.id)).length;
  $('checklist-count').textContent = `첨부 ${done} / ${docs.length}건`;
}
function render() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const region = $('region').value;
  selected = demo.variants[mode][region];
  $('download').href = selected.document_url;
  $('download').download = selected.document_url.split('/').pop();
  const m = selected.metrics;
  $('verdict').textContent = m.automatic_comparisons
    ? `자동 판정 ${m.automatic_comparisons}건 · 담당자 확인 ${m.manual}건`
    : `자동 판정 0건 · 담당자 확인 ${m.manual}건`;
  $('count-items').textContent = m.extracted_items;
  $('count-evidence').textContent = `${m.evidence_match} / ${m.extracted_items}`;
  $('count-auto').textContent = m.automatic_comparisons;
  $('count-manual').textContent = m.manual;
  document.querySelectorAll('.mode-card').forEach(c => c.classList.toggle('current', c.dataset.mode === mode));
  $('mode-note').textContent = mode === 'live' ? '저장된 AI 응답입니다. 지금 AI를 호출하지 않았습니다.' : '기준표 초안 기반 시험 결과입니다. 실제 AI 성능이 아닙니다.';
  $('automation-note').textContent = m.automatic_comparisons ? '자동 판정은 소재지 1항목뿐입니다. 자격 판단이 아닙니다.' : '자동 판정 없음. 모든 항목을 담당자가 확인합니다.';
  $('automation-note').classList.toggle('warning', m.automatic_comparisons === 0);
  $('input-context').textContent = `가상 소재지 ${region} · 기준일 ${selected.company.evaluation_date}`;
  holdSummary(selected.rows);
  renderGroups(selected.rows);
  renderMyMatches(selected.rows);
  renderChecklist(selected.rows);
  $('coverage-note').textContent = `초안 인용 구간 ${m.draft_quote_spans}개 중 응답에 없는 구간 ${m.draft_quote_spans_absent}개. 의미 정확도 지표가 아닙니다.`;
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
    $('source-meta').textContent = `${demo.source.publisher} · 게시 ${demo.source.posted_date} · 접수 마감된 과거 공고`;
    $('source-link').href = demo.source.source_url;
    document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', render));
    $('region').addEventListener('change', render);
    $('org-type').addEventListener('input', () => renderMyMatches(selected.rows));
    $('print').addEventListener('click', () => window.print());
    $('loading').hidden = true; $('app').hidden = false; render();
  } catch (_) {
    $('loading').textContent = '자료를 불러오지 못했습니다. 새로고침하거나 HTTPS 주소로 여세요.';
  }
}
let closedBeforePrint = [];
window.addEventListener('beforeprint', () => {
  closedBeforePrint = [...document.querySelectorAll('details:not([open])')];
  closedBeforePrint.forEach(d => d.open = true);
});
window.addEventListener('afterprint', () => closedBeforePrint.forEach(d => d.open = false));
start();
