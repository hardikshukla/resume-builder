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
 * Strips protocol, www, and trailing slash from a URL so it displays
 * cleanly on the resume, e.g. "linkedin.com/in/username".
 * ATS systems still detect these as URLs via the domain pattern.
 */
function shortenUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}
export async function generateResumeDOCX(resume: ResumeData): Promise<Blob> {
  const JUSTIFY = AlignmentType.BOTH; // justified alignment throughout

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
          size: 22,
          bold: true,
          allCaps: true,
        }),
      ],
    });

  const children: Paragraph[] = [];

  // ── HEADER ─────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: resume.name,
          font: 'Times New Roman',
          size: 32,
          bold: true,
        }),
      ],
    })
  );

  // Contact line
  const contactParts: string[] = [];
  if (resume.contact?.email) contactParts.push(resume.contact.email);
  if (resume.contact?.phone) contactParts.push(resume.contact.phone);
  if (resume.contact?.linkedin) contactParts.push(shortenUrl(resume.contact.linkedin));
  if (resume.contact?.github) contactParts.push(shortenUrl(resume.contact.github));
  if (resume.contact?.location) contactParts.push(resume.contact.location);

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [
        new TextRun({
          text: contactParts.join('  |  '),
          font: 'Times New Roman',
          size: 18,
        }),
      ],
    })
  );

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  if (resume.summary) {
    children.push(sectionHeader('SUMMARY'));
    children.push(
      new Paragraph({
        alignment: JUSTIFY,
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({ text: resume.summary, font: 'Times New Roman', size: 20 }),
        ],
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
              size: 20,
              bold: true,
            }),
            new TextRun({
              text: group.items.join(', '),
              font: 'Times New Roman',
              size: 20,
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
              size: 20,
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
              size: 20,
              italics: true,
            }),
          ],
        })
      );

      // Role-level bullets — only rendered when this role has no projects
      if (!exp.projects || exp.projects.length === 0) {
        for (const bullet of exp.bullets) {
          children.push(
            new Paragraph({
              numbering: { reference: 'resume-bullets', level: 0 },
              children: [
                new TextRun({ text: bullet, font: 'Times New Roman', size: 20 }),
              ],
            })
          );
        }

        // Stack line for no-project roles (same italic style as project Stack lines)
        if (exp.tech && exp.tech.length > 0) {
          children.push(
            new Paragraph({
              alignment: JUSTIFY,
              spacing: { before: 40, after: 20 },
              children: [
                new TextRun({
                  text: `Stack: ${exp.tech.join(', ')}`,
                  font: 'Times New Roman',
                  size: 18,
                  italics: true,
                }),
              ],
            })
          );
        }
      }
      // ── Nested Projects / Work Streams (under this role) ───────────────────
      if (exp.projects && exp.projects.length > 0) {
        for (const project of exp.projects) {
          // Project name — bold sub-header, indented slightly, no prefix symbol
          children.push(
            new Paragraph({
              alignment: JUSTIFY,
              spacing: { before: 120, after: 20 },
              indent: { left: 180 },
              children: [
                new TextRun({
                  text: project.name,
                  font: 'Times New Roman',
                  size: 20,
                  bold: true,
                }),
              ],
            })
          );

          // Project bullets — same style as role bullets
          for (const bullet of project.bullets ?? []) {
            children.push(
              new Paragraph({
                numbering: { reference: 'resume-bullets', level: 0 },
                children: [
                  new TextRun({
                    text: bullet,
                    font: 'Times New Roman',
                    size: 20,
                  }),
                ],
              })
            );
          }

          // Stack line — italic, at the bottom of this project block
          if (project.tech && project.tech.length > 0) {
            children.push(
              new Paragraph({
                alignment: JUSTIFY,
                spacing: { before: 40, after: 20 },
                children: [
                  new TextRun({
                    text: `Stack: ${project.tech.join(', ')}`,
                    font: 'Times New Roman',
                    size: 18,
                    italics: true,
                  }),
                  ...(project.link
                    ? [
                        new TextRun({
                          text: `  |  ${project.link}`,
                          font: 'Times New Roman',
                          size: 16,
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
              size: 20,
              bold: true,
            }),
            new TextRun({
              text: `  —  ${edu.institution}${edu.year ? '  (' + edu.year + ')' : ''}`,
              font: 'Times New Roman',
              size: 20,
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
          children: [new TextRun({ text: cert, font: 'Times New Roman', size: 20 })],
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
          children: [new TextRun({ text: pub, font: 'Times New Roman', size: 20 })],
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
          children: [new TextRun({ text: award, font: 'Times New Roman', size: 20 })],
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
          children: [new TextRun({ text: lang, font: 'Times New Roman', size: 20 })],
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
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
