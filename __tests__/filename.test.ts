// Simulating the functions from app/api/dropbox/sync/route.ts
function sanitizeFilename(raw: string): string {
  return raw
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[^\w\s\-().+]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80)
    || 'document';
}

function toCamelCase(str: string): string {
  return str
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function toPascalCase(str: string): string {
  return str
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

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
});
