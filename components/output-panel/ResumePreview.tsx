import { User, Briefcase, GraduationCap, Award, Zap, FileText } from 'lucide-react';
import { ResumeBuilderOutput } from '@/types';

/** Strips protocol, www, and trailing slash for clean display (e.g. linkedin.com/in/user) */
function shortenUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

export function ResumePreview({ resume }: { resume: ResumeBuilderOutput['resume'] }) {
  // Build contact parts: plain strings for email/phone/location, {href, label} for links
  type ContactItem = string | { href: string; label: string };
  const contactItems: ContactItem[] = [];
  if (resume.contact?.email) contactItems.push(resume.contact.email);
  if (resume.contact?.phone) contactItems.push(resume.contact.phone);
  if (resume.contact?.linkedin) contactItems.push({ href: resume.contact.linkedin, label: shortenUrl(resume.contact.linkedin) });
  if (resume.contact?.github) contactItems.push({ href: resume.contact.github, label: shortenUrl(resume.contact.github) });
  if (resume.contact?.location) contactItems.push(resume.contact.location);

  return (
    <div className="resume-preview">
      {/* Header */}
      <div className="rp-header">
        <div className="rp-name">{resume.name}</div>
        <div className="rp-contact">
          {contactItems.map((item, i) => (
            <span key={i}>
              {i > 0 && <span className="rp-contact-sep">  ·  </span>}
              {typeof item === 'string' ? (
                item
              ) : (
                <a href={item.href} target="_blank" rel="noopener noreferrer" className="rp-contact-link">
                  {item.label}
                </a>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Summary */}
      {resume.summary && (
        <div className="rp-section">
          <div className="rp-section-header">
            <User size={14} />
            SUMMARY
          </div>
          <p className="rp-text">{resume.summary}</p>
        </div>
      )}

      {/* Skills — categorized */}
      {(resume.skills || []).length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <Zap size={14} />
            CORE COMPETENCIES
          </div>
          <div className="rp-skill-categories">
            {(resume.skills || []).map((group, i) => (
              <div key={i} className="rp-skill-row">
                <span className="rp-skill-cat">{group.category}:</span>
                <span className="rp-skill-items">{group.items.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experience + nested Projects */}
      {(resume.experience || []).length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <Briefcase size={14} />
            EXPERIENCE
          </div>
          {(resume.experience || []).map((exp, i) => (
            <div key={i} className="rp-exp-block">
              <div className="rp-exp-meta">
                <span className="rp-exp-title">{exp.title}</span>
                <span className="rp-exp-dates">
                  {exp.startDate} – {exp.endDate}
                </span>
              </div>
              <div className="rp-exp-company">
                {exp.company}
                {exp.location ? `  ·  ${exp.location}` : ''}
              </div>
              {/* Role-level bullets — only shown when role has no projects */}
              {(!exp.projects || exp.projects.length === 0) && exp.bullets?.length > 0 && (
                <>
                  <ul className="rp-bullets">
                    {exp.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                  {/* Stack line for no-project roles */}
                  {exp.tech?.length > 0 && (
                    <p className="rp-proj-stack">Stack: {exp.tech.join(', ')}</p>
                  )}
                </>
              )}
              {/* Nested projects / work streams under this role */}
              {exp.projects?.length > 0 && (
                <div className="rp-nested-projects">
                  {exp.projects.map((proj, j) => (
                    <div key={j} className="rp-proj-nested">

                      {/* Project name — bold sub-header, no prefix */}
                      <div className="rp-proj-nested-name">{proj.name}</div>

                      {/* Project bullets — same visual as role bullets */}
                      {proj.bullets?.length > 0 && (
                        <ul className="rp-bullets">
                          {proj.bullets.map((b, k) => (
                            <li key={k}>{b}</li>
                          ))}
                        </ul>
                      )}

                      {/* Stack line at the bottom — italic, like reference */}
                      {proj.tech?.length > 0 && (
                        <p className="rp-proj-stack">
                          Stack: {proj.tech.join(', ')}
                          {proj.link && (
                            <>
                              {' · '}
                              <a
                                href={proj.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rp-proj-link"
                              >
                                {proj.link}
                              </a>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}


      {/* Education */}
      {(resume.education || []).length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <GraduationCap size={14} />
            EDUCATION
          </div>
          {(resume.education || []).map((edu, i) => (
            <div key={i} className="rp-edu-block">
              <span className="rp-edu-degree">{edu.degree}</span>
              <span className="rp-edu-inst">
                {edu.institution}
                {edu.year ? ` · ${edu.year}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {(resume.certifications || []).length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <Award size={14} />
            CERTIFICATIONS
          </div>
          <ul className="rp-bullets">
            {(resume.certifications || []).map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Publications */}
      {resume.publications && resume.publications.length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <FileText size={14} />
            PUBLICATIONS
          </div>
          <ul className="rp-bullets">
            {resume.publications.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Awards */}
      {resume.awards && resume.awards.length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <Award size={14} />
            AWARDS &amp; HONOURS
          </div>
          <ul className="rp-bullets">
            {resume.awards.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Languages */}
      {resume.languages && resume.languages.length > 0 && (
        <div className="rp-section">
          <div className="rp-section-header">
            <Zap size={14} />
            LANGUAGES
          </div>
          <ul className="rp-bullets">
            {resume.languages.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
