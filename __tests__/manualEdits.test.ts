import {
  MERGE_TOLERANCE,
  mergeManualEdits,
  readEditTarget,
  recordEdit,
  writeEditTarget,
} from '@/lib/utils/manualEdits';

const output = {
  resume: {
    summary: 'Original summary',
    skills: [{ category: 'Languages', items: ['Python', 'Go'] }],
    experience: [{ bullets: ['First bullet', 'Second bullet'] }],
  },
  coverLetter: { subject: 'Hi', body: 'Para one.\n\nPara two.' },
};

describe('readEditTarget', () => {
  it('reads plain text fields', () => {
    expect(readEditTarget(output, 'resume.experience[0].bullets[1]')).toBe('Second bullet');
  });

  it('reads skill lists as comma-separated text', () => {
    expect(readEditTarget(output, 'resume.skills[0].items')).toBe('Python, Go');
  });

  it('reads a cover letter paragraph by index, ignoring blank lines', () => {
    expect(readEditTarget(output, 'coverLetter.body[1]')).toBe('Para two.');
    expect(readEditTarget(output, 'coverLetter.body[5]')).toBe('');
  });

  it('returns undefined for missing or non-text fields', () => {
    expect(readEditTarget(output, 'resume.missing')).toBeUndefined();
    expect(readEditTarget(output, 'resume.skills[0]')).toBeUndefined();
  });
});

describe('writeEditTarget', () => {
  it('writes text without mutating the input', () => {
    const next = writeEditTarget(output, 'resume.summary', 'New summary');
    expect(next.resume.summary).toBe('New summary');
    expect(output.resume.summary).toBe('Original summary');
  });

  it('splits a skills edit back into a trimmed array', () => {
    const next = writeEditTarget(output, 'resume.skills[0].items', ' Python ,Rust, ,Go ');
    expect(next.resume.skills[0].items).toEqual(['Python', 'Rust', 'Go']);
  });

  it('rewrites one paragraph and rejoins the body with blank lines', () => {
    const next = writeEditTarget(output, 'coverLetter.body[0]', 'New opening.');
    expect(next.coverLetter.body).toBe('New opening.\n\nPara two.');
  });
});

describe('recordEdit', () => {
  it('appends a new edit', () => {
    const edits = recordEdit([], { path: 'a', originalValue: 'x', editedValue: 'y' });
    expect(edits).toEqual([{ path: 'a', originalValue: 'x', editedValue: 'y' }]);
  });

  it('keeps the first original value when the same path is edited again', () => {
    const first = recordEdit([], { path: 'a', originalValue: 'generated', editedValue: 'one' });
    const second = recordEdit(first, { path: 'a', originalValue: 'one', editedValue: 'two' });
    expect(second).toEqual([{ path: 'a', originalValue: 'generated', editedValue: 'two' }]);
    expect(first[0].editedValue).toBe('one');
  });
});

describe('mergeManualEdits', () => {
  it('re-applies an edit whose field drifted within tolerance, moving its baseline', () => {
    const drifted = 'Original summarx'; // 1 character different
    const refined = { ...output, resume: { ...output.resume, summary: drifted } };
    const { merged, kept, orphaned } = mergeManualEdits(refined, [
      { path: 'resume.summary', originalValue: 'Original summary', editedValue: 'Mine' },
    ]);
    expect(merged.resume.summary).toBe('Mine');
    expect(kept).toEqual([{ path: 'resume.summary', originalValue: drifted, editedValue: 'Mine' }]);
    expect(orphaned).toEqual([]);
  });

  it(`orphans an edit whose field changed by more than ${MERGE_TOLERANCE} characters`, () => {
    const edit = { path: 'resume.summary', originalValue: 'Original summary', editedValue: 'Mine' };
    const refined = { ...output, resume: { ...output.resume, summary: 'Entirely rewritten' } };
    const { merged, kept, orphaned } = mergeManualEdits(refined, [edit]);
    expect(merged.resume.summary).toBe('Entirely rewritten');
    expect(kept).toEqual([]);
    expect(orphaned).toEqual([edit]);
  });

  it('orphans an edit whose field no longer exists', () => {
    const edit = { path: 'resume.experience[3].bullets[0]', originalValue: 'x', editedValue: 'y' };
    expect(mergeManualEdits(output, [edit]).orphaned).toEqual([edit]);
  });

  it('applies several edits in order', () => {
    const { merged } = mergeManualEdits(output, [
      { path: 'coverLetter.body[1]', originalValue: 'Para two.', editedValue: 'Changed two.' },
      { path: 'resume.skills[0].items', originalValue: 'Python, Go', editedValue: 'Python, Go, Rust' },
    ]);
    expect(merged.coverLetter.body).toBe('Para one.\n\nChanged two.');
    expect(merged.resume.skills[0].items).toEqual(['Python', 'Go', 'Rust']);
  });
});
