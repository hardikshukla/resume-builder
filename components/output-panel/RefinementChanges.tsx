'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FileDiff, ListChecks } from 'lucide-react';
import { CoverLetterData, ResumeData } from '@/types';

type ChangeKind = 'changed' | 'added' | 'removed';

interface ChangeItem {
  section: string;
  label: string;
  before?: string;
  after?: string;
  kind: ChangeKind;
}

type DiffToken = {
  text: string;
  type: 'equal' | 'added' | 'removed';
};

interface RefinementChangesProps {
  originalResume: ResumeData;
  updatedResume: ResumeData;
  originalCoverLetter?: CoverLetterData;
  updatedCoverLetter?: CoverLetterData;
  appliedRecs: string[];
}

function stringify(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value).trim();
}

function tokenize(text: string): string[] {
  return text.match(/\S+/g) ?? [];
}

function diffWords(before: string, after: string): DiffToken[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      tokens.push({ text: a[i], type: 'equal' });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokens.push({ text: a[i], type: 'removed' });
      i++;
    } else {
      tokens.push({ text: b[j], type: 'added' });
      j++;
    }
  }

  while (i < a.length) {
    tokens.push({ text: a[i], type: 'removed' });
    i++;
  }
  while (j < b.length) {
    tokens.push({ text: b[j], type: 'added' });
    j++;
  }

  return tokens;
}

function renderInlineDiff(change: ChangeItem, side: 'before' | 'after') {
  if (!change.before || !change.after) {
    const text = side === 'before' ? change.before : change.after;
    const type = side === 'before' ? 'removed' : 'added';
    return tokenize(text ?? '').map((word, i) => (
      <span className={`diff-token diff-${type}`} key={`${word}-${i}`}>{word} </span>
    ));
  }

  const visibleTypes = side === 'before'
    ? new Set<DiffToken['type']>(['equal', 'removed'])
    : new Set<DiffToken['type']>(['equal', 'added']);

  return diffWords(change.before, change.after)
    .filter((token) => visibleTypes.has(token.type))
    .map((token, i) => (
      <span
        className={`diff-token ${token.type === 'equal' ? '' : `diff-${token.type}`}`}
        key={`${token.type}-${token.text}-${i}`}
      >
        {token.text}{' '}
      </span>
    ));
}

function addChange(
  changes: ChangeItem[],
  section: string,
  label: string,
  beforeValue: unknown,
  afterValue: unknown
) {
  const before = stringify(beforeValue);
  const after = stringify(afterValue);
  if (before === after) return;

  changes.push({
    section,
    label,
    before,
    after,
    kind: before && after ? 'changed' : before ? 'removed' : 'added',
  });
}

function compareStringArrays(
  changes: ChangeItem[],
  section: string,
  label: string,
  before: string[] = [],
  after: string[] = []
) {
  const max = Math.max(before.length, after.length);
  for (let i = 0; i < max; i++) {
    addChange(changes, section, `${label} ${i + 1}`, before[i], after[i]);
  }
}

function roleLabel(role: NonNullable<ResumeData['experience']>[number], index: number): string {
  return role.title || role.company || `Role ${index + 1}`;
}

function projectLabel(project: NonNullable<ResumeData['projects']>[number], index: number): string {
  return project.name || `Project ${index + 1}`;
}

function buildResumeChanges(original: ResumeData, updated: ResumeData): ChangeItem[] {
  const changes: ChangeItem[] = [];

  addChange(changes, 'HEADER', 'Name', original.name, updated.name);
  addChange(changes, 'CONTACT', 'Email', original.contact?.email, updated.contact?.email);
  addChange(changes, 'CONTACT', 'Phone', original.contact?.phone, updated.contact?.phone);
  addChange(changes, 'CONTACT', 'LinkedIn', original.contact?.linkedin, updated.contact?.linkedin);
  addChange(changes, 'CONTACT', 'GitHub', original.contact?.github, updated.contact?.github);
  addChange(changes, 'CONTACT', 'Location', original.contact?.location, updated.contact?.location);
  addChange(changes, 'SUMMARY', 'Summary', original.summary, updated.summary);

  const originalSkills = original.skills ?? [];
  const updatedSkills = updated.skills ?? [];
  const skillCount = Math.max(originalSkills.length, updatedSkills.length);
  for (let i = 0; i < skillCount; i++) {
    const before = originalSkills[i];
    const after = updatedSkills[i];
    const label = after?.category || before?.category || `Skill group ${i + 1}`;
    addChange(changes, 'CORE COMPETENCIES', `${label} category`, before?.category, after?.category);
    addChange(changes, 'CORE COMPETENCIES', label, before?.items, after?.items);
  }

  const originalExperience = original.experience ?? [];
  const updatedExperience = updated.experience ?? [];
  const roleCount = Math.max(originalExperience.length, updatedExperience.length);
  for (let i = 0; i < roleCount; i++) {
    const before = originalExperience[i];
    const after = updatedExperience[i];
    const role = roleLabel(after ?? before, i);

    addChange(changes, 'EXPERIENCE', `${role} title`, before?.title, after?.title);
    addChange(changes, 'EXPERIENCE', `${role} company`, before?.company, after?.company);
    addChange(changes, 'EXPERIENCE', `${role} location`, before?.location, after?.location);
    addChange(changes, 'EXPERIENCE', `${role} start date`, before?.startDate, after?.startDate);
    addChange(changes, 'EXPERIENCE', `${role} end date`, before?.endDate, after?.endDate);
    compareStringArrays(changes, 'EXPERIENCE', `${role} bullet`, before?.bullets, after?.bullets);
    addChange(changes, 'EXPERIENCE', `${role} stack`, before?.tech, after?.tech);

    const beforeProjects = before?.projects ?? [];
    const afterProjects = after?.projects ?? [];
    const projectCount = Math.max(beforeProjects.length, afterProjects.length);
    for (let j = 0; j < projectCount; j++) {
      const beforeProject = beforeProjects[j];
      const afterProject = afterProjects[j];
      const project = projectLabel(afterProject ?? beforeProject, j);
      const prefix = `${role} / ${project}`;

      addChange(changes, 'EXPERIENCE', `${prefix} name`, beforeProject?.name, afterProject?.name);
      addChange(changes, 'EXPERIENCE', `${prefix} description`, beforeProject?.description, afterProject?.description);
      compareStringArrays(changes, 'EXPERIENCE', `${prefix} bullet`, beforeProject?.bullets, afterProject?.bullets);
      addChange(changes, 'EXPERIENCE', `${prefix} stack`, beforeProject?.tech, afterProject?.tech);
      addChange(changes, 'EXPERIENCE', `${prefix} link`, beforeProject?.link, afterProject?.link);
    }
  }

  const originalProjects = original.projects ?? [];
  const updatedProjects = updated.projects ?? [];
  const projectCount = Math.max(originalProjects.length, updatedProjects.length);
  for (let i = 0; i < projectCount; i++) {
    const before = originalProjects[i];
    const after = updatedProjects[i];
    const project = projectLabel(after ?? before, i);
    addChange(changes, 'PROJECTS', `${project} name`, before?.name, after?.name);
    addChange(changes, 'PROJECTS', `${project} description`, before?.description, after?.description);
    compareStringArrays(changes, 'PROJECTS', `${project} bullet`, before?.bullets, after?.bullets);
    addChange(changes, 'PROJECTS', `${project} stack`, before?.tech, after?.tech);
    addChange(changes, 'PROJECTS', `${project} link`, before?.link, after?.link);
  }

  const originalEducation = original.education ?? [];
  const updatedEducation = updated.education ?? [];
  const educationCount = Math.max(originalEducation.length, updatedEducation.length);
  for (let i = 0; i < educationCount; i++) {
    const before = originalEducation[i];
    const after = updatedEducation[i];
    const label = after?.degree || before?.degree || `Education ${i + 1}`;
    addChange(changes, 'EDUCATION', `${label} degree`, before?.degree, after?.degree);
    addChange(changes, 'EDUCATION', `${label} institution`, before?.institution, after?.institution);
    addChange(changes, 'EDUCATION', `${label} year`, before?.year, after?.year);
  }

  compareStringArrays(changes, 'CERTIFICATIONS', 'Certification', original.certifications, updated.certifications);
  compareStringArrays(changes, 'PUBLICATIONS', 'Publication', original.publications, updated.publications);
  compareStringArrays(changes, 'AWARDS & HONOURS', 'Award', original.awards, updated.awards);
  compareStringArrays(changes, 'LANGUAGES', 'Language', original.languages, updated.languages);

  return changes;
}

function groupChanges(changes: ChangeItem[]): Record<string, ChangeItem[]> {
  return changes.reduce<Record<string, ChangeItem[]>>((acc, change) => {
    acc[change.section] = acc[change.section] ?? [];
    acc[change.section].push(change);
    return acc;
  }, {});
}

export function RefinementChanges({
  originalResume,
  updatedResume,
  originalCoverLetter,
  updatedCoverLetter,
  appliedRecs,
}: RefinementChangesProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['SUMMARY', 'EXPERIENCE', 'COVER LETTER']));

  const changes = useMemo(() => {
    const resumeChanges = buildResumeChanges(originalResume, updatedResume);
    addChange(resumeChanges, 'COVER LETTER', 'Subject', originalCoverLetter?.subject, updatedCoverLetter?.subject);
    addChange(resumeChanges, 'COVER LETTER', 'Body', originalCoverLetter?.body, updatedCoverLetter?.body);
    return resumeChanges;
  }, [originalResume, updatedResume, originalCoverLetter, updatedCoverLetter]);

  const grouped = useMemo(() => groupChanges(changes), [changes]);
  const sections = Object.keys(grouped);

  const toggleSection = (section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  return (
    <div className="card refinement-card">
      <div className="card-header">
        <div className="card-icon"><FileDiff size={16} /></div>
        <h2 className="card-title">Refinement Changes</h2>
        <span className="provider-tag">{changes.length} changed</span>
      </div>

      {appliedRecs.length > 0 && (
        <div className="applied-rec-panel">
          <div className="applied-rec-title">
            <ListChecks size={14} />
            Applied recommendations
          </div>
          <div className="applied-rec-list">
            {appliedRecs.map((rec, i) => (
              <span className="applied-rec-chip" key={`${rec}-${i}`}>{rec}</span>
            ))}
          </div>
        </div>
      )}

      {sections.length === 0 ? (
        <p className="change-empty">No text differences detected between the original and refined result.</p>
      ) : (
        <div className="change-groups">
          {sections.map((section) => {
            const isOpen = openSections.has(section);
            return (
              <div className="change-group" key={section}>
                <button
                  className="change-group-header"
                  onClick={() => toggleSection(section)}
                  aria-expanded={isOpen}
                >
                  <span>{section}</span>
                  <span className="change-group-meta">
                    {grouped[section].length}
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>

                {isOpen && (
                  <div className="change-list">
                    {grouped[section].map((change, i) => (
                      <div className={`change-item change-${change.kind}`} key={`${change.label}-${i}`}>
                        <div className="change-item-header">
                          <span className="change-label">{change.label}</span>
                          <span className="change-kind">{change.kind}</span>
                        </div>
                        {change.before && (
                          <div className="change-line change-before">
                            <span className="change-line-label">Before</span>
                            <span className="change-text">{renderInlineDiff(change, 'before')}</span>
                          </div>
                        )}
                        {change.after && (
                          <div className="change-line change-after">
                            <span className="change-line-label">After</span>
                            <span className="change-text">{renderInlineDiff(change, 'after')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
