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

  it('buildDownloadFilename should build PascalCase FirstnameLastname_Company[_CoverLetter].docx', () => {
    // Normal cases
    expect(buildDownloadFilename('John Smith', 'Google')).toBe('JohnSmith_Google.docx');
    expect(buildDownloadFilename('John Smith', 'Google', 'coverLetter')).toBe('JohnSmith_Google_CoverLetter.docx');
    
    // Spaces, special characters, multi-word
    expect(buildDownloadFilename('John A. Smith', 'Google LLC')).toBe('JohnASmith_GoogleLlc.docx');
    expect(buildDownloadFilename('Jane-Doe', 'Yahoo! Inc.')).toBe('JaneDoe_YahooInc.docx');
    
    // Empty inputs / fallbacks
    expect(buildDownloadFilename('', '')).toBe('Candidate_Tailored.docx');
    expect(buildDownloadFilename('', 'Google')).toBe('Candidate_Google.docx');
    expect(buildDownloadFilename('John Smith', '')).toBe('JohnSmith_Tailored.docx');
  });
});
