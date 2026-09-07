export const normalizeTestFile = (file) => {
  const normalized = String(file ?? '').replace(/\\/g, '/');
  const marker = '/tests/';
  const index = normalized.lastIndexOf(marker);
  if (index >= 0) return normalized.slice(index + 1);
  return normalized.replace(/^\.\//, '');
};

export const normalizeTitlePart = (value) => String(value ?? '').trim();

export const testId = ({ file, title, ordinal, titlePath = [] }) => {
  const path = [...titlePath, title].map(normalizeTitlePart).filter(Boolean);
  if (!path.length) throw new Error('Playwright test identity requires a title.');
  if (!Number.isInteger(ordinal) || ordinal < 0) throw new Error('Playwright test identity requires a non-negative ordinal.');
  return `${normalizeTestFile(file)}::${path.join(' > ')}::${ordinal}`;
};

export const collectNativeTests = (report) => {
  const tests = [];
  const walk = (suite, ancestors = []) => {
    const suiteTitle = normalizeTitlePart(suite?.title);
    const nextAncestors = suiteTitle ? [...ancestors, suiteTitle] : ancestors;
    for (const spec of suite?.specs || []) {
      for (const [ordinal, test] of (spec.tests || []).entries()) {
        tests.push({
          file: normalizeTestFile(spec.file),
          title: spec.title,
          titlePath: nextAncestors,
          ordinal,
          status: test.status,
          results: test.results || [],
        });
      }
    }
    for (const child of suite?.suites || []) walk(child, nextAncestors);
  };
  for (const suite of report?.suites || []) walk(suite);
  return tests;
};

export const collectTestIds = (report) => collectNativeTests(report).map(testId);
