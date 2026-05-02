export type SectionKey = 'summary' | 'experience' | 'skills' | 'education' | 'projects' | 'other';

const SECTION_HEADERS: Record<Exclude<SectionKey, 'other'>, RegExp[]> = {
  summary:    [/^(summary|objective|profile|about me)\s*$/i, /^professional summary\s*$/i],
  experience: [/^(experience|work history|employment|work experience|professional experience)\s*$/i],
  skills:     [/^(skills|technical skills|competencies|core competencies)\s*$/i],
  education:  [/^(education|academic|academic background)\s*$/i],
  projects:   [/^(projects|portfolio|personal projects)\s*$/i],
};

/**
 * Parses raw resume text into sections. 
 * This parsing is used strictly for generating granular cache keys.
 * If no recognizable headers are found, it dumps everything into 'other'.
 */
export function parseSections(resumeText: string): Partial<Record<SectionKey, string>> {
  const sections: Partial<Record<SectionKey, string>> = {};
  const lines = resumeText.split('\n');

  let currentSection: SectionKey = 'other';
  let currentContent: string[] = [];

  const flush = () => {
    if (currentContent.length > 0) {
      sections[currentSection] = (sections[currentSection] || '') + currentContent.join('\n') + '\n';
      currentContent = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    let matchedKey: SectionKey | null = null;

    // See if line matches any section header
    for (const [key, regexes] of Object.entries(SECTION_HEADERS)) {
      if (regexes.some(r => r.test(trimmed))) {
        matchedKey = key as SectionKey;
        break;
      }
    }

    if (matchedKey && matchedKey !== currentSection) {
      flush();
      currentSection = matchedKey;
    }
    
    currentContent.push(line);
  }

  flush();

  return sections;
}
