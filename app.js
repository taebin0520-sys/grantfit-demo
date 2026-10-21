'use strict';
let demo;
let selected;
const $ = id => document.getElementById(id);
function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value == null ? '' : String(value);
  if (className) node.className = className;
  return node;
}
function rowView(row) {
  const detail = document.createElement('details');
  detail.className = 'item';
  const summary = document.createElement('summary');
  summary.append(text('span', row.id, 'item-id'), text('span', row.ai_summary, 'item-title'));
  const style = row.result === '입력값 부합' ? 'match' : row.result === '입력값 미부합' ? 'mismatch' : '';
  summary.append(text('span', row.result, `badge ${style}`));
  const body = document.createElement('div');
  body.className = 'item-body';
  const list = document.createElement('dl');
  const values = [
    ['종류 / 근거', `${row.kind} / announcement.pdf ${row.page}쪽`],
    ['AI 요약 (미검증)', row.ai_summary],
    ['원문 인용', row.raw_quote],
    ['조건·예외', row.conditions || '별도 조건 기록 없음'],
    ['필요 기관정보', row.required_info],
    ['검토 사유', row.reason],
    ['자동 대조', row.automatic ? '예 - 단일 요소만 비교' : '아니오']
  ];
  for (const [key, value] of values) list.append(text('dt', key), text('dd', value, key === '원문 인용' ? 'quote' : ''));
  body.append(list);
  detail.append(summary, body);
  return detail;
}
function render() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const region = $('region').value;
  selected = demo.variants[mode][region];
  const m = selected.metrics;
  $('count-items').textContent = m.extracted_items;
  $('count-evidence').textContent = `${m.evidence_match} / ${m.extracted_items}`;
  $('count-auto').textContent = m.automatic_comparisons;
  $('count-manual').textContent = m.manual;
  $('mode-note').textContent = mode === 'live' ? '실제 AI 호출 1회에서 저장한 응답입니다. 지금 AI를 호출한 결과가 아닙니다.' : 'AI 작성 기준표 초안에서 만든 고정 응답입니다. 실제 AI 실험·성능 수치가 아닙니다.';
  $('automation-note').textContent = m.automatic_comparisons ? '자동 대조는 소재지 단일 요소 1건뿐입니다. 기업 유형·인증·전체 신청 가능 여부를 뜻하지 않습니다.' : '자동 대조 0건입니다. 성공적인 자동 자격 대조 결과가 아니며 담당자 확인이 필요합니다.';
  $('automation-note').classList.toggle('warning', m.automatic_comparisons === 0);
  $('input-context').textContent = `실험용 가상 소재지: ${region} / 기준일: ${selected.company.evaluation_date}`;
  $('rows').replaceChildren(...selected.rows.filter(r => r.evidence_valid).map(rowView));
  const invalid = selected.rows.filter(r => !r.evidence_valid);
  $('invalid-section').hidden = invalid.length === 0;
  $('invalid-rows').replaceChildren(...invalid.map(rowView));
  $('coverage-note').textContent = `초안 인용 구간 ${m.draft_quote_spans}개 중 응답에 없는 구간 ${m.draft_quote_spans_absent}개. 병합 항목의 부분 인용도 포함으로 계산하며, 실제 누락 총수나 의미 정확도 지표가 아닙니다.`;
  $('coverage').replaceChildren(...selected.coverage.map(row => {
    const div = text('div', '', 'coverage-row');
    div.append(text('span', `${row.draft_id} · ${row.draft_label}`), text('span', row.quote_span_present_in_live_rows ? '인용 구간 포함' : '인용 구간 없음'));
    return div;
  }));
  $('company').textContent = JSON.stringify(selected.company, null, 2);
}
async function start() {
  try {
    const response = await fetch('demo-data.json');
    if (!response.ok) throw new Error('data unavailable');
    demo = await response.json();
    for (const region of demo.regions) {
      const option = text('option', region); option.value = region; $('region').append(option);
    }
    $('source-title').textContent = demo.source.title;
    $('source-meta').textContent = `${demo.source.publisher} / 게시일 ${demo.source.posted_date} / 접수마감된 과거 사례 / 확인일 2026-10-21`;
    $('source-link').href = demo.source.source_url;
    document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', render));
    $('region').addEventListener('change', render);
    $('print').addEventListener('click', () => window.print());
    $('download').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(selected, null, 2)], {type:'application/json'}));
      const a = document.createElement('a'); a.href = url; a.download = 'grantfit-review.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
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
