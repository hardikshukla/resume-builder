import { ResumeData } from '@/types';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  LevelFormat,
  BorderStyle,
} from 'docx';



/**
 * Strips protocol, www, and trailing slash from a URL so it displays cleanly.
 */
function shortenUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

/**
 * Shared candidate header function for both Resume and Cover Letter.
 */
function buildCandidateHeader(name?: string, contact?: ResumeData['contact']): Paragraph[] {
  const children: Paragraph[] = [];

  const formattedName = name ? name.toUpperCase() : 'FIRST LAST';

  // Name (Bold, 14pt, centered)
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: formattedName,
          font: 'Times New Roman',
          size: 28, // 14pt (specified in half-points)
          bold: true,
        }),
      ],
    })
  );

  // Contact line (11pt, centered, pipe-separated)
  const contactParts: string[] = [];
  if (contact?.email) contactParts.push(contact.email);
  if (contact?.phone) contactParts.push(contact.phone);
  if (contact?.linkedin) contactParts.push(shortenUrl(contact.linkedin));
  if (contact?.github) contactParts.push(shortenUrl(contact.github));
  if (contact?.location) contactParts.push(contact.location);

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: contactParts.join('  |  '),
          font: 'Times New Roman',
          size: 22, // 11pt
        }),
      ],
    })
  );

  // Thin horizontal rule
  children.push(
    new Paragraph({
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: 'A0A0A0',
          space: 1,
        },
      },
      spacing: { before: 0, after: 200 },
      children: [],
    })
  );

  return children;
}

function buildTextRunsWithBolding(
  text: string,
  keywords: string[] = [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  baseOptions: any = {}
): TextRun[] {
  if (!text) return [];
  if (keywords.length === 0) {
    return [new TextRun({ ...baseOptions, text })];
  }

  // Construct regex pattern using safe word boundary matching
  const patterns = keywords.map(kw => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const startsWithWord = /^\w/.test(kw);
    const endsWithWord = /\w$/.test(kw);
    let pattern = escaped;
    if (startsWithWord) pattern = '(?<!\\w)' + pattern;
    if (endsWithWord) pattern = pattern + '(?!\\w)';
    return pattern;
  });

  const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
  const parts = text.split(regex);
  const lowercaseKeywords = new Set(keywords.map(k => k.toLowerCase()));

  return parts
    .filter(part => part !== '')
    .map(part => {
      const isKeyword = lowercaseKeywords.has(part.toLowerCase());
      return new TextRun({
        ...baseOptions,
        text: part,
        bold: isKeyword ? true : baseOptions.bold,
      });
    });
}

export async function generateResumeDOCX(resume: ResumeData, keywords: string[] = []): Promise<Blob> {
  const JUSTIFY = AlignmentType.BOTH;

  const bulletNumbering = {
    config: [
      {
        reference: 'resume-bullets',
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '\u2022',
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

  const sectionHeader = (text: string) =>
    new Paragraph({
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: '2C3E50',
          space: 1,
        },
      },
      alignment: JUSTIFY,
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({
          text,
          font: 'Times New Roman',
          size: 22, // 11pt
          bold: true,
          allCaps: true,
        }),
      ],
    });

  const children: Paragraph[] = [];

  // Header (Shared)
  children.push(...buildCandidateHeader(resume.name, resume.contact));

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  if (resume.summary) {
    children.push(sectionHeader('SUMMARY'));
    children.push(
      new Paragraph({
        alignment: JUSTIFY,
        spacing: { before: 60, after: 60 },
        children: buildTextRunsWithBolding(resume.summary, keywords, { font: 'Times New Roman', size: 22 }),
      })
    );
  }

  // ── SKILLS ─────────────────────────────────────────────────────────────────
  if (resume.skills && resume.skills.length > 0) {
    children.push(sectionHeader('CORE COMPETENCIES'));
    for (const group of resume.skills) {
      children.push(
        new Paragraph({
          alignment: JUSTIFY,
          spacing: { before: 30, after: 30 },
          children: [
            new TextRun({
              text: `${group.category}: `,
              font: 'Times New Roman',
              size: 22,
              bold: true,
            }),
            ...buildTextRunsWithBolding(group.items.join(', '), keywords, {
              font: 'Times New Roman',
              size: 22,
            }),
          ],
        })
      );
    }
  }

  // ── EXPERIENCE ─────────────────────────────────────────────────────────────
  if (resume.experience && resume.experience.length > 0) {
    children.push(sectionHeader('EXPERIENCE'));

    for (const exp of resume.experience) {
      // Role + dates row
      children.push(
        new Paragraph({
          alignment: JUSTIFY,
          spacing: { before: 100, after: 20 },
          children: [
            new TextRun({
              text: exp.title,
              font: 'Times New Roman',
              size: 22,
              bold: true,
            }),
            new TextRun({
              text: `  |  ${exp.startDate} – ${exp.endDate}`,
              font: 'Times New Roman',
              size: 22,
            }),
          ],
        })
      );

      // Company + location row
      const companyLine = exp.location
        ? `${exp.company}  ·  ${exp.location}`
        : exp.company;
      children.push(
        new Paragraph({
          alignment: JUSTIFY,
          spacing: { before: 0, after: 60 },
          children: [
            new TextRun({
              text: companyLine,
              font: 'Times New Roman',
              size: 22,
              italics: true,
            }),
          ],
        })
      );

      // Role-level bullets (no projects)
      if (!exp.projects || exp.projects.length === 0) {
        for (const bullet of exp.bullets) {
          children.push(
            new Paragraph({
              numbering: { reference: 'resume-bullets', level: 0 },
              children: buildTextRunsWithBolding(bullet, keywords, { font: 'Times New Roman', size: 22 }),
            })
          );
        }

        if (exp.tech && exp.tech.length > 0) {
          children.push(
            new Paragraph({
              alignment: JUSTIFY,
              spacing: { before: 40, after: 20 },
              children: [
                new TextRun({
                  text: 'Stack: ',
                  font: 'Times New Roman',
                  size: 20,
                  italics: true,
                }),
                ...buildTextRunsWithBolding(exp.tech.join(', '), keywords, {
                  font: 'Times New Roman',
                  size: 20,
                  italics: true,
                }),
              ],
            })
          );
        }
      }

      // Nested Projects
      if (exp.projects && exp.projects.length > 0) {
        for (const project of exp.projects) {
          children.push(
            new Paragraph({
              alignment: JUSTIFY,
              spacing: { before: 120, after: 20 },
              indent: { left: 180 },
              children: [
                new TextRun({
                  text: project.name,
                  font: 'Times New Roman',
                  size: 22,
                  bold: true,
                }),
              ],
            })
          );

          // Project description (italic), if present
          if (project.description) {
            children.push(
              new Paragraph({
                alignment: JUSTIFY,
                spacing: { before: 0, after: 40 },
                indent: { left: 180 },
                children: buildTextRunsWithBolding(project.description, keywords, {
                  font: 'Times New Roman',
                  size: 22,
                  italics: true,
                }),
              })
            );
          }

          for (const bullet of project.bullets ?? []) {
            children.push(
              new Paragraph({
                numbering: { reference: 'resume-bullets', level: 0 },
                children: buildTextRunsWithBolding(bullet, keywords, {
                  font: 'Times New Roman',
                  size: 22,
                }),
              })
            );
          }

          if (project.tech && project.tech.length > 0) {
            children.push(
              new Paragraph({
                alignment: JUSTIFY,
                spacing: { before: 40, after: 20 },
                children: [
                  new TextRun({
                    text: 'Stack: ',
                    font: 'Times New Roman',
                    size: 20,
                    italics: true,
                  }),
                  ...buildTextRunsWithBolding(project.tech.join(', '), keywords, {
                    font: 'Times New Roman',
                    size: 20,
                    italics: true,
                  }),
                  ...(project.link
                    ? [
                        new TextRun({
                          text: `  |  ${project.link}`,
                          font: 'Times New Roman',
                          size: 18,
                          color: '2563EB',
                          italics: true,
                        }),
                      ]
                    : []),
                ],
              })
            );
          }
        }
      }
    }
  }

  // ── PROJECTS (Standalone) ──────────────────────────────────────────────────
  if (resume.projects && resume.projects.length > 0) {
    children.push(sectionHeader('PROJECTS'));

    for (const project of resume.projects) {
      children.push(
        new Paragraph({
          alignment: JUSTIFY,
          spacing: { before: 100, after: 20 },
          children: [
            new TextRun({
              text: project.name,
              font: 'Times New Roman',
              size: 22,
              bold: true,
            }),
          ],
        })
      );

      // Project description (italic), if present
      if (project.description) {
        children.push(
          new Paragraph({
            alignment: JUSTIFY,
            spacing: { before: 0, after: 40 },
            children: buildTextRunsWithBolding(project.description, keywords, {
              font: 'Times New Roman',
              size: 22,
              italics: true,
            }),
          })
        );
      }

      for (const bullet of project.bullets ?? []) {
        children.push(
          new Paragraph({
            numbering: { reference: 'resume-bullets', level: 0 },
            children: buildTextRunsWithBolding(bullet, keywords, {
              font: 'Times New Roman',
              size: 22,
            }),
          })
        );
      }

      if (project.tech && project.tech.length > 0) {
        children.push(
          new Paragraph({
            alignment: JUSTIFY,
            spacing: { before: 40, after: 20 },
            children: [
              new TextRun({
                text: 'Stack: ',
                font: 'Times New Roman',
                size: 20,
                italics: true,
              }),
              ...buildTextRunsWithBolding(project.tech.join(', '), keywords, {
                font: 'Times New Roman',
                size: 20,
                italics: true,
              }),
              ...(project.link
                ? [
                    new TextRun({
                      text: `  |  ${project.link}`,
                      font: 'Times New Roman',
                      size: 18,
                      color: '2563EB',
                      italics: true,
                    }),
                  ]
                : []),
            ],
          })
        );
      }
    }
  }

  // ── EDUCATION ──────────────────────────────────────────────────────────────
  if (resume.education && resume.education.length > 0) {
    children.push(sectionHeader('EDUCATION'));
    for (const edu of resume.education) {
      children.push(
        new Paragraph({
          alignment: JUSTIFY,
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({
              text: edu.degree,
              font: 'Times New Roman',
              size: 22,
              bold: true,
            }),
            new TextRun({
              text: `  —  ${edu.institution}${edu.year ? '  (' + edu.year + ')' : ''}`,
              font: 'Times New Roman',
              size: 22,
            }),
          ],
        })
      );
    }
  }

  // ── CERTIFICATIONS ─────────────────────────────────────────────────────────
  if (resume.certifications && resume.certifications.length > 0) {
    children.push(sectionHeader('CERTIFICATIONS'));
    for (const cert of resume.certifications) {
      children.push(
        new Paragraph({
          numbering: { reference: 'resume-bullets', level: 0 },
          children: [new TextRun({ text: cert, font: 'Times New Roman', size: 22 })],
        })
      );
    }
  }

  // ── PUBLICATIONS ────────────────────────────────────────────────────────────
  if (resume.publications && resume.publications.length > 0) {
    children.push(sectionHeader('PUBLICATIONS'));
    for (const pub of resume.publications) {
      children.push(
        new Paragraph({
          numbering: { reference: 'resume-bullets', level: 0 },
          children: [new TextRun({ text: pub, font: 'Times New Roman', size: 22 })],
        })
      );
    }
  }

  // ── AWARDS ──────────────────────────────────────────────────────────────────
  if (resume.awards && resume.awards.length > 0) {
    children.push(sectionHeader('AWARDS & HONOURS'));
    for (const award of resume.awards) {
      children.push(
        new Paragraph({
          numbering: { reference: 'resume-bullets', level: 0 },
          children: [new TextRun({ text: award, font: 'Times New Roman', size: 22 })],
        })
      );
    }
  }

  // ── LANGUAGES ───────────────────────────────────────────────────────────────
  if (resume.languages && resume.languages.length > 0) {
    children.push(sectionHeader('LANGUAGES'));
    for (const lang of resume.languages) {
      children.push(
        new Paragraph({
          numbering: { reference: 'resume-bullets', level: 0 },
          children: [new TextRun({ text: lang, font: 'Times New Roman', size: 22 })],
        })
      );
    }
  }

  const doc = new Document({
    numbering: bulletNumbering,
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // letter size
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // standard 1-inch margins
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

