import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { ProjectEntry, ResumeData } from '@/types';
import {
  BODY_RUN,
  FONT,
  LETTER_PAGE,
  SIZE,
  buildCandidateHeader,
  buildTextRunsWithBolding,
} from '@/lib/docx/shared';

const JUSTIFY = AlignmentType.BOTH;

/** Numbering reference used by every bulleted paragraph in the resume. */
const BULLETS = 'resume-bullets';

const BULLET_NUMBERING = {
  config: [
    {
      reference: BULLETS,
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: {
              indent: { left: 360, hanging: 180 },
              alignment: JUSTIFY,
              spacing: { before: 40, after: 40 },
            },
          },
        },
      ],
    },
  ],
};

/** Italic, slightly smaller text used for "Stack:" lines. */
const STACK_RUN = { font: FONT, size: SIZE.stack, italics: true } as const;

/** Invisible border, for the borderless skills table. */
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto' } as const;
const NO_CELL_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

/** Column widths of the skills table, in twentieths of a point. */
const SKILLS_TABLE_WIDTH = 9360; // 6.5in: the printable width on Letter with 1in margins
const SKILL_CATEGORY_WIDTH = 2304; // 1.6in
const SKILL_ITEMS_WIDTH = 7056; // 4.9in

// ── Paragraph builders ───────────────────────────────────────────────────────

/** Upper-case section title with a rule underneath, e.g. "EXPERIENCE". */
function sectionHeader(text: string): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2C3E50', space: 1 } },
    alignment: JUSTIFY,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, ...BODY_RUN, bold: true, allCaps: true })],
  });
}

/** One bulleted line. Bullets are never keyword-bolded, to keep them readable. */
function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: BULLETS, level: 0 },
    children: buildTextRunsWithBolding(text, [], BODY_RUN),
  });
}

/** "Stack: React, GraphQL", with an optional trailing link. */
function stackParagraph(tech: string[], link?: string | null): Paragraph {
  const linkRun = link
    ? [new TextRun({ text: `  |  ${link}`, font: FONT, size: SIZE.link, color: '2563EB', italics: true })]
    : [];
  return new Paragraph({
    alignment: JUSTIFY,
    spacing: { before: 40, after: 20 },
    children: [
      new TextRun({ text: 'Stack: ', ...STACK_RUN }),
      ...buildTextRunsWithBolding(tech.join(', '), [], STACK_RUN),
      ...linkRun,
    ],
  });
}

/**
 * A project: bold name, optional italic description, bullets, and a stack
 * line. Projects nested under a role are indented and spaced slightly more
 * than standalone ones.
 */
function projectParagraphs(project: ProjectEntry, { nested }: { nested: boolean }): Paragraph[] {
  const indent = nested ? { indent: { left: 180 } } : {};
  const paragraphs: Paragraph[] = [
    new Paragraph({
      alignment: JUSTIFY,
      spacing: { before: nested ? 120 : 100, after: 20 },
      ...indent,
      children: [new TextRun({ text: project.name, ...BODY_RUN, bold: true })],
    }),
  ];

  if (project.description) {
    paragraphs.push(
      new Paragraph({
        alignment: JUSTIFY,
        spacing: { before: 0, after: 40 },
        ...indent,
        children: buildTextRunsWithBolding(project.description, [], { ...BODY_RUN, italics: true }),
      })
    );
  }

  paragraphs.push(...(project.bullets ?? []).map(bulletParagraph));

  if (project.tech && project.tech.length > 0) {
    paragraphs.push(stackParagraph(project.tech, project.link));
  }
  return paragraphs;
}

/** A titled section of plain bullets (certifications, awards, …). */
function listSection(title: string, items: string[] | undefined): Paragraph[] {
  if (!items || items.length === 0) return [];
  return [
    sectionHeader(title),
    ...items.map((item) => new Paragraph({
      numbering: { reference: BULLETS, level: 0 },
      children: [new TextRun({ text: item, ...BODY_RUN })],
    })),
  ];
}

/** Two-column, borderless table: category on the left, skills on the right. */
function skillsTable(skills: NonNullable<ResumeData['skills']>, keywords: string[]): Table {
  const cell = (width: number, rightMargin: number, paragraph: Paragraph) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      margins: { top: 40, bottom: 40, left: 113, right: rightMargin },
      verticalAlign: VerticalAlign.TOP,
      borders: NO_CELL_BORDERS,
      children: [paragraph],
    });

  const rows = skills.map((group) => new TableRow({
    children: [
      cell(SKILL_CATEGORY_WIDTH, 113, new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: `${group.category}:`, ...BODY_RUN, bold: true })],
      })),
      cell(SKILL_ITEMS_WIDTH, 0, new Paragraph({
        alignment: JUSTIFY,
        spacing: { before: 0, after: 0 },
        children: buildTextRunsWithBolding(group.items.join(', '), keywords, BODY_RUN),
      })),
    ],
  }));

  return new Table({
    width: { size: SKILLS_TABLE_WIDTH, type: WidthType.DXA },
    borders: { ...NO_CELL_BORDERS, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    rows,
  });
}

// ── Document ─────────────────────────────────────────────────────────────────

/**
 * Generates the tailored resume as a DOCX blob.
 *
 * @param resume    The resume to render.
 * @param keywords  Terms to bold in the summary and skills.
 */
export async function generateResumeDOCX(resume: ResumeData, keywords: string[] = []): Promise<Blob> {
  const children: (Paragraph | Table)[] = [...buildCandidateHeader(resume.name, resume.contact)];

  if (resume.summary) {
    children.push(
      sectionHeader('SUMMARY'),
      new Paragraph({
        alignment: JUSTIFY,
        spacing: { before: 60, after: 60 },
        children: buildTextRunsWithBolding(resume.summary, keywords, BODY_RUN),
      })
    );
  }

  if (resume.skills && resume.skills.length > 0) {
    children.push(sectionHeader('CORE COMPETENCIES'), skillsTable(resume.skills, keywords));
  }

  if (resume.experience && resume.experience.length > 0) {
    children.push(sectionHeader('EXPERIENCE'));

    for (const exp of resume.experience) {
      // "Title  |  2020 – Present", then the company (and location) in italics.
      children.push(
        new Paragraph({
          alignment: JUSTIFY,
          spacing: { before: 100, after: 20 },
          children: [
            new TextRun({ text: exp.title, ...BODY_RUN, bold: true }),
            new TextRun({ text: `  |  ${exp.startDate} – ${exp.endDate}`, ...BODY_RUN }),
          ],
        }),
        new Paragraph({
          alignment: JUSTIFY,
          spacing: { before: 0, after: 60 },
          children: [
            new TextRun({
              text: exp.location ? `${exp.company}  ·  ${exp.location}` : exp.company,
              ...BODY_RUN,
              italics: true,
            }),
          ],
        })
      );

      const hasProjects = Boolean(exp.projects && exp.projects.length > 0);
      if (hasProjects) {
        // A role with projects lists its work under each project instead.
        for (const project of exp.projects) {
          children.push(...projectParagraphs(project, { nested: true }));
        }
      } else {
        children.push(...exp.bullets.map(bulletParagraph));
        if (exp.tech && exp.tech.length > 0) {
          children.push(stackParagraph(exp.tech));
        }
      }
    }
  }

  if (resume.projects && resume.projects.length > 0) {
    children.push(sectionHeader('PROJECTS'));
    for (const project of resume.projects) {
      children.push(...projectParagraphs(project, { nested: false }));
    }
  }

  if (resume.education && resume.education.length > 0) {
    children.push(sectionHeader('EDUCATION'));
    for (const edu of resume.education) {
      children.push(
        new Paragraph({
          alignment: JUSTIFY,
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({ text: edu.degree, ...BODY_RUN, bold: true }),
            new TextRun({ text: `  —  ${edu.institution}${edu.year ? '  (' + edu.year + ')' : ''}`, ...BODY_RUN }),
          ],
        })
      );
    }
  }

  children.push(
    ...listSection('CERTIFICATIONS', resume.certifications),
    ...listSection('PUBLICATIONS', resume.publications),
    ...listSection('AWARDS & HONOURS', resume.awards),
    ...listSection('LANGUAGES', resume.languages)
  );

  const doc = new Document({
    numbering: BULLET_NUMBERING,
    sections: [{ properties: { page: LETTER_PAGE }, children }],
  });

  return await Packer.toBlob(doc);
}
