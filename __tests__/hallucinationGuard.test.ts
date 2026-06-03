/**
 * __tests__/hallucinationGuard.test.ts
 * Tests for the post-generation hallucination verification guard.
 *
 * Run: npx jest __tests__/hallucinationGuard.test.ts
 */

import { verifyHallucinations, extractMetrics } from '../lib/validation/hallucinationGuard';
import { ResumeData } from '../types';

const originalResumeText = `
Jane Doe
Software Engineer at Google from Jan 2020 to Present
BS in Computer Science from Stanford University
Key Accomplishments:
- Led a team of 4 engineers to rebuild search indexing.
- Optimised MySQL queries to reduce latency by 45%.
- Saved $50k annually in cloud hosting costs.
- Handled traffic of 1.2M queries per day.
`;

describe('Hallucination Guard — extractMetrics', () => {
  it('correctly cleans commas and expands scale suffixes', () => {
    expect(extractMetrics('1M')).toContain('1000000');
    expect(extractMetrics('1.2M')).toContain('1200000');
    expect(extractMetrics('50k')).toContain('50000');
    expect(extractMetrics('50,000')).toContain('50000');
    expect(extractMetrics('1.5 billion')).toContain('1500000000');
    expect(extractMetrics('45%')).toContain('45%');
    expect(extractMetrics('10x')).toContain('10x');
  });
});

describe('Hallucination Guard — verifyHallucinations', () => {
  const baseGeneratedResume: ResumeData = {
    name: 'Jane Doe',
    experience: [
      {
        title: 'Software Engineer',
        company: 'Google',
        location: null,
        startDate: 'Jan 2020',
        endDate: 'Present',
        bullets: ['Optimised MySQL query logic to cut latency by 45%.'],
        tech: ['MySQL', 'React'],
        projects: [],
      },
    ],
    education: [
      {
        degree: 'BS in Computer Science',
        institution: 'Stanford University',
        year: '2020',
      },
    ],
  };

  it('passes when all metrics, companies, dates, and degrees are verified', () => {
    const report = verifyHallucinations(originalResumeText, baseGeneratedResume);
    expect(report.passed).toBe(true);
    expect(report.flaggedClaims.length).toBe(0);
  });

  it('ignores standard dates/years and small numbers <= 10', () => {
    const generated: ResumeData = {
      ...baseGeneratedResume,
      experience: [
        {
          title: 'Software Engineer',
          company: 'Google',
          location: null,
          startDate: 'Jan 2020',
          endDate: 'Present',
          // 4 and 8 are small numbers <= 10, 2021 is a year. None should be flagged
          bullets: ['Managed 4 engineers in 2021.', 'Developed 8 internal tools.'],
          tech: [],
          projects: [],
        },
      ],
    };

    const report = verifyHallucinations(originalResumeText, generated);
    expect(report.passed).toBe(true);
  });

  it('flags unverified company names', () => {
    const generated: ResumeData = {
      ...baseGeneratedResume,
      experience: [
        {
          title: 'Software Engineer',
          company: 'Netflix', // Netflix is not in original resume
          location: null,
          startDate: 'Jan 2020',
          endDate: 'Present',
          bullets: [],
          tech: [],
          projects: [],
        },
      ],
    };

    const report = verifyHallucinations(originalResumeText, generated);
    expect(report.passed).toBe(false);
    expect(report.flaggedClaims[0].reason).toContain('Netflix');
  });

  it('flags unverified degrees', () => {
    const generated: ResumeData = {
      ...baseGeneratedResume,
      education: [
        {
          degree: 'Master of Science', // Master is not in original resume
          institution: 'Stanford University',
          year: null,
        },
      ],
    };

    const report = verifyHallucinations(originalResumeText, generated);
    expect(report.passed).toBe(false);
    expect(report.flaggedClaims[0].reason).toContain('Master of Science');
  });

  it('flags fabricated metrics or numbers', () => {
    const generated: ResumeData = {
      ...baseGeneratedResume,
      experience: [
        {
          title: 'Software Engineer',
          company: 'Google',
          location: null,
          startDate: 'Jan 2020',
          endDate: 'Present',
          // 95% latency reduction is fabricated (original is 45%)
          bullets: ['Cut query latency by 95%.'],
          tech: [],
          projects: [],
        },
      ],
    };

    const report = verifyHallucinations(originalResumeText, generated);
    expect(report.passed).toBe(false);
    expect(report.flaggedClaims[0].reason).toContain('95%');
  });

  it('flags fabricated scaled metrics', () => {
    const generated: ResumeData = {
      ...baseGeneratedResume,
      experience: [
        {
          title: 'Software Engineer',
          company: 'Google',
          location: null,
          startDate: 'Jan 2020',
          endDate: 'Present',
          // $500k is fabricated (original is $50k)
          bullets: ['Saved $500k annually.'],
          tech: [],
          projects: [],
        },
      ],
    };

    const report = verifyHallucinations(originalResumeText, generated);
    expect(report.passed).toBe(false);
    expect(report.flaggedClaims[0].reason).toContain('500000');
  });
});
