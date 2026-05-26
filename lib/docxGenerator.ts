import { ResumeData, CoverLetterData } from '@/types';
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

  // Name (Bold, 14pt, centered)
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: name || 'FIRST LAST',
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

export async function generateResumeDOCX(resume: ResumeData): Promise<Blob> {
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
        children: [
          new TextRun({ text: resume.summary, font: 'Times New Roman', size: 22 }),
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
              size: 22,
              bold: true,
            }),
            new TextRun({
              text: group.items.join(', '),
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
              children: [
                new TextRun({ text: bullet, font: 'Times New Roman', size: 22 }),
              ],
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
                  text: `Stack: ${exp.tech.join(', ')}`,
                  font: 'Times New Roman',
                  size: 20, // 10pt
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

          for (const bullet of project.bullets ?? []) {
            children.push(
              new Paragraph({
                numbering: { reference: 'resume-bullets', level: 0 },
                children: [
                  new TextRun({
                    text: bullet,
                    font: 'Times New Roman',
                    size: 22,
                  }),
                ],
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
                    text: `Stack: ${project.tech.join(', ')}`,
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

      for (const bullet of project.bullets ?? []) {
        children.push(
          new Paragraph({
            numbering: { reference: 'resume-bullets', level: 0 },
            children: [
              new TextRun({
                text: bullet,
                font: 'Times New Roman',
                size: 22,
              }),
            ],
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
                text: `Stack: ${project.tech.join(', ')}`,
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

export async function generateCoverLetterDOCX(
  name: string,
  contact: ResumeData['contact'],
  coverLetter: CoverLetterData
): Promise<Blob> {
  const children: Paragraph[] = [];

  // Header (Shared)
  children.push(...buildCandidateHeader(name, contact));

  // Date
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 120, after: 120 },
      children: [
        new TextRun({
          text: dateStr,
          font: 'Times New Roman',
          size: 22, // 11pt
        }),
      ],
    })
  );

  // Subject line
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 120, after: 200 },
      children: [
        new TextRun({
          text: `Subject: ${coverLetter.subject}`,
          font: 'Times New Roman',
          size: 22, // 11pt
          bold: true,
        }),
      ],
    })
  );

  // Greeting
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: 'Dear Hiring Manager,',
          font: 'Times New Roman',
          size: 22,
        }),
      ],
    })
  );

  // Body paragraphs
  const paragraphs = coverLetter.body.split(/\n+/);
  for (const paraText of paragraphs) {
    const trimmed = paraText.trim();
    if (!trimmed) continue;
    children.push(
      new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { before: 0, after: 120 },
        children: [
          new TextRun({
            text: trimmed,
            font: 'Times New Roman',
            size: 22,
          }),
        ],
      })
    );
  }

  // Sign off
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 200, after: 40 },
      children: [
        new TextRun({
          text: 'Sincerely,',
          font: 'Times New Roman',
          size: 22,
        }),
      ],
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 200, after: 0 },
      children: [
        new TextRun({
          text: name || 'Candidate Name',
          font: 'Times New Roman',
          size: 22,
          bold: true,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // standard 1-inch margins
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
