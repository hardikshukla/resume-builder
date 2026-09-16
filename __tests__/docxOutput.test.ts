/**
 * docxOutput.test.ts — golden output for the Word exports.
 *
 * Snapshots the XML inside each generated .docx (the document body, bullet
 * numbering and styles). Any change to what a user downloads shows up here as a
 * snapshot diff, so refactors of the generators can be verified byte-for-byte.
 * If a change is intentional, review the diff and update with `npx jest -u`.
 */
import JSZip from 'jszip';
import { generateResumeDOCX } from '@/lib/docxGenerator';
import { generateCoverLetterDOCX } from '@/lib/coverLetterGenerator';
import { CoverLetterData, ResumeData } from '@/types';

/** Covers every section and branch the resume generator has. */
const RESUME: ResumeData = {
  name: 'Jane Doe',
  contact: {
    email: 'jane@example.com',
    phone: '555-0100',
    linkedin: 'https://www.linkedin.com/in/janedoe/',
    github: 'https://github.com/janedoe',
    location: 'Austin, TX',
  },
  summary: 'Frontend engineer building React and TypeScript platforms on AWS.',
  skills: [
    { category: 'Languages', items: ['TypeScript', 'JavaScript', 'Python'] },
    { category: 'Cloud', items: ['AWS', 'Docker'] },
  ],
  experience: [
    {
      title: 'Senior Engineer', company: 'Globex', location: 'Remote', startDate: '2020', endDate: 'Present',
      bullets: [], tech: ['React'],
      projects: [
        { name: 'Project Atlas', description: 'Design system rebuild', bullets: ['Led migration of 40 screens to React'], link: 'https://atlas.example.com', tech: ['React', 'GraphQL'] },
        { name: 'Project Beacon', description: null, bullets: ['Built alerting'], link: null, tech: [] },
      ],
    },
    {
      title: 'Engineer', company: 'Initech', location: null, startDate: '2016', endDate: '2020',
      bullets: ['Built AWS Lambda pipelines', 'Cut page load by 30%'], tech: ['AWS'], projects: [],
    },
  ],
  projects: [
    { name: 'OSS Toolkit', description: 'Lint presets', bullets: ['Maintained a TypeScript lint preset'], link: 'https://oss.example.com', tech: ['TypeScript'] },
    { name: 'Side App', description: null, bullets: [], link: null, tech: [] },
  ],
  education: [
    { degree: 'BSc Computer Science', institution: 'State University', year: '2016' },
    { degree: 'Bootcamp', institution: 'Code School', year: null },
  ],
  certifications: ['AWS Certified Developer'],
  publications: ['Scaling Design Systems (2022)'],
  awards: ['Engineer of the Year'],
  languages: ['English', 'Spanish'],
};

const COVER_LETTER: CoverLetterData = {
  subject: 'Application for Frontend Engineer at Acme',
  body: 'I am excited to apply to Acme.\n\nAt Globex I led Project Atlas in React.\n\nI would welcome a conversation.',
};

const KEYWORDS = ['React', 'TypeScript', 'AWS', 'C++'];

/** The XML parts of a .docx that carry its content and formatting. */
async function contentParts(blob: Blob): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const parts: Record<string, string> = {};
  for (const name of ['word/document.xml', 'word/numbering.xml', 'word/styles.xml']) {
    const file = zip.file(name);
    if (file) parts[name] = await file.async('string');
  }
  return parts;
}

describe('Word export output', () => {
  beforeAll(() => {
    // The cover letter prints today's date; pin it so the snapshot is stable.
    jest.useFakeTimers({ now: new Date('2026-03-15T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
  });
  afterAll(() => jest.useRealTimers());

  it('resume without keywords', async () => {
    expect(await contentParts(await generateResumeDOCX(RESUME))).toMatchSnapshot();
  });

  it('resume with keyword bolding', async () => {
    expect(await contentParts(await generateResumeDOCX(RESUME, KEYWORDS))).toMatchSnapshot();
  });

  it('resume with no optional sections', async () => {
    expect(await contentParts(await generateResumeDOCX({ name: '', contact: undefined }))).toMatchSnapshot();
  });

  it('cover letter with keyword bolding', async () => {
    expect(await contentParts(await generateCoverLetterDOCX(COVER_LETTER, RESUME, KEYWORDS))).toMatchSnapshot();
  });

  it('cover letter for a resume with no name or contact', async () => {
    expect(await contentParts(await generateCoverLetterDOCX(COVER_LETTER, {}))).toMatchSnapshot();
  });
});
