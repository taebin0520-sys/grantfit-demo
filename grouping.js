// 항목을 업무 순서 그룹으로 나눈다. 원문과 기존 검증 필드만 읽고, 판정 결과는 바꾸지 않는다.
// 한 항목은 정확히 한 그룹에만 들어간다. 브라우저와 테스트(node)에서 같이 쓴다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GrantFitGroups = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const EXCLUSION_QUOTE = /제외|예외|단\s*,/;
  const EXCLUSION_NOTE = /제외대상|예외/;
  const AMBIGUOUS = /읽기순서|달력|해석|점수|심사기준|예외 판단/;
  // 화면에 보이는 문구만 바꾼다. 데이터의 필드명과 값은 그대로 둔다.
  const FIELD_LABELS = {
    location_region: '소재지',
    organization_type: '기업 유형',
    designated_staff_count: '지정 담당자 수',
    staff_capability: '담당자 역량',
    annual_revenue: '연 매출',
    established_date: '설립일',
    financial_statements_2023_2024: '2023·2024년 재무제표',
    registration_documents: '등기 서류',
    application_form: '신청서',
    business_plan: '사업계획서',
    consent_form: '동의서',
    application_datetime: '접수 일시',
    submission_channel: '제출 방법',
    submission_receipt: '접수 확인증',
    submission_filename: '제출 파일명',
    insured_employees_list: '4대보험 가입자 명부',
    company_brochure: '기업 소개 자료',
    insolvency_status: '부도·파산 상태',
    debt_default_restriction: '채무불이행 제한',
    tax_arrears: '체납 상태',
    external_audit_opinion: '외부감사 의견',
    rehabilitation_approval: '회생 인가',
    truthfulness: '진실성 확인',
    review_acknowledgment: '검토 확인 사항',
    participation_motivation: '참여 동기',
    register_issue_date: '등기 발급일',
    application_date: '신청일',
    financial_availability: '재무제표 보유 여부',
    alternative_documents: '대체서류',
    closed_status: '휴폐업 여부',
    public_recognition: '공적 인증',
    duplicate_support: '중복 지원 여부',
    completeness: '서류 완비 여부',
    mission: '사업 목적',
    suitability: '적합성',
    capability: '역량'
  };
  const REASON_TEXT = [
    ['자동 추출 불가', '자동으로 판단하기 어려워 담당자 확인 필요']
  ];

  function humanize(value) {
    if (typeof value !== 'string') return value;
    let out = value.replace(/[a-z]+(?:_[a-z0-9]+)+/g, token =>
      token.split(/\s*\/\s*/).map(part => FIELD_LABELS[part.trim()] || part.trim()).join(' / ')
    );
    for (const [from, to] of REASON_TEXT) out = out.split(from).join(to);
    return out;
  }

  // 순서가 중요하다: 애매하면 먼저 '그 밖'으로 보내고, 그다음 제외 표시를 본다.
  function classify(row) {
    if (!row.evidence_valid) return 'recheck';
    const note = (row.reason || '') + ' ' + (row.conditions || '');
    if (AMBIGUOUS.test(note)) return 'other';
    if (EXCLUSION_QUOTE.test(row.raw_quote || '') || EXCLUSION_NOTE.test(row.conditions || '')) return 'exclusion';
    if (row.kind === '제출서류') return 'documents';
    if (row.kind === '요건') return 'requirements';
    return 'other';
  }

  const ORDER = [
    ['recheck', '원문 재확인 필요', '인용 위치나 쪽 번호가 원문과 맞지 않습니다. 원문 PDF에서 직접 확인해 주세요.'],
    ['requirements', '신청 요건', '신청 요건입니다. 항목마다 자동 판정 여부와 확인 사유를 표시합니다.'],
    ['documents', '제출서류', '제출해야 하는 서류입니다. 제출 여부와 유효성은 담당자가 확인합니다.'],
    ['exclusion', '제외 대상 및 예외', '제외 대상이거나 예외 조건이 붙은 항목입니다. 해당 여부는 담당자가 확인합니다.'],
    ['other', '그 밖의 확인사항', '날짜·숫자 읽기 순서, 달력 기준, 점수·심사기준처럼 원문을 함께 봐야 하는 항목입니다.']
  ];

  function groupRows(rows) {
    const groups = ORDER.map(([key, title, note]) => ({ key, title, note, rows: [] }));
    const byKey = new Map(groups.map(g => [g.key, g]));
    for (const row of rows) byKey.get(classify(row)).rows.push(row);
    return groups;
  }

  // 자동 판정 문구는 실제 결과 건수에 맞춘다. 판정 결과 자체는 바꾸지 않는다.
  function autoNote(rows) {
    const n = rows.filter(r => r.automatic).length;
    return n
      ? `자동 판정 ${n}건은 소재지 단일 요소만 입력값과 비교한 결과입니다. 전체 신청 가능 여부를 뜻하지 않습니다.`
      : '이 응답에서는 자동 판정된 항목이 없습니다. 모든 항목을 담당자가 확인해야 합니다.';
  }
  // AI가 만든 요약·확인 정보에 '또는'이 있고 원문 인용에는 없는 항목. 제출 관계를 단정하면 안 되는 경우다.
  function summaryAddsOr(row) {
    const generated = (row.ai_summary || '') + ' ' + (row.required_info || '');
    return /또는/.test(generated) && !/또는/.test(row.raw_quote || '');
  }

  return { classify, groupRows, humanize, autoNote, summaryAddsOr, ORDER };
});
