import {
  sanitizeFilename,
  toCamelCase,
  toPascalCase,
  buildDownloadFilename,
  capitalizeName,
} from '../lib/utils/string';

describe('Filename and Path Helpers', () => {
  it('sanitizeFilename should remove directory traversals', () => {
    expect(sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeFilename('folder\\file.txt')).toBe('folderfile.txt');
  });

  it('sanitizeFilename should collapse spaces to underscores', () => {
    expect(sanitizeFilename('My File Name.docx')).toBe('My_File_Name.docx');
  });

  it('toCamelCase should camelCase strings', () => {
    expect(toCamelCase('OpenAI Inc.')).toBe('openaiInc');
    expect(toCamelCase('google')).toBe('google');
    expect(toCamelCase('General Motors')).toBe('generalMotors');
  });

  it('toPascalCase should pascalCase strings', () => {
    expect(toPascalCase('OpenAI Inc.')).toBe('OpenaiInc');
    expect(toPascalCase('google')).toBe('Google');
    expect(toPascalCase('General Motors')).toBe('GeneralMotors');
  });

  it('capitalizeName should format names to Title Case', () => {
    expect(capitalizeName('MITAVA THAKER')).toBe('Mitava Thaker');
    expect(capitalizeName('mitava thaker')).toBe('Mitava Thaker');
    expect(capitalizeName('Mitava Thaker')).toBe('Mitava Thaker');
    expect(capitalizeName('john-david o\'connor')).toBe('John-David O\'connor');
    expect(capitalizeName('')).toBe('');
  });

  it('buildDownloadFilename should build PascalCase FirstnameLastname[_Company]_Resume[_CoverLetter].docx', () => {
    // Resume format
    expect(buildDownloadFilename('John Smith', 'Google', 'resume')).toBe('JohnSmith_Google_Resume.docx');
    expect(buildDownloadFilename('John Smith', '', 'resume')).toBe('JohnSmith_Resume.docx');
    expect(buildDownloadFilename('', '', 'resume')).toBe('Candidate_Resume.docx');
    expect(buildDownloadFilename('', 'Google', 'resume')).toBe('Candidate_Google_Resume.docx');
    
    // Cover Letter format
    expect(buildDownloadFilename('John Smith', 'Google', 'coverLetter')).toBe('JohnSmith_Google_CoverLetter.docx');
    expect(buildDownloadFilename('John Smith', '', 'coverLetter')).toBe('JohnSmith_CoverLetter.docx');
    expect(buildDownloadFilename('', '', 'coverLetter')).toBe('Candidate_CoverLetter.docx');
    
    // Spaces, special characters, multi-word
    expect(buildDownloadFilename('John A. Smith', 'Google LLC', 'resume')).toBe('JohnASmith_GoogleLlc_Resume.docx');
    expect(buildDownloadFilename('Jane-Doe', 'Yahoo! Inc.', 'resume')).toBe('JaneDoe_YahooInc_Resume.docx');
  });
});
