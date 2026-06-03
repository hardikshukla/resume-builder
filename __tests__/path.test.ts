import { parsePath, getAtPath, setAtPath, levenshtein } from '../lib/utils/path';

describe('Path Utilities', () => {
  describe('parsePath', () => {
    it('parses standard dot notation', () => {
      expect(parsePath('resume.experience')).toEqual(['resume', 'experience']);
    });

    it('parses bracket notation with numbers', () => {
      expect(parsePath('resume.experience[0].bullets[1]')).toEqual([
        'resume',
        'experience',
        0,
        'bullets',
        1,
      ]);
    });

    it('parses brackets with quotes or string keys', () => {
      expect(parsePath("resume['skills']['languages']")).toEqual([
        'resume',
        'skills',
        'languages',
      ]);
    });
  });

  describe('getAtPath', () => {
    const data = {
      resume: {
        name: 'Alice',
        experience: [
          {
            company: 'Google',
            bullets: ['Did React stuff', 'Did Next.js stuff'],
          },
        ],
      },
    };

    it('retrieves nested string values', () => {
      expect(getAtPath(data, 'resume.name')).toBe('Alice');
    });

    it('retrieves nested array items', () => {
      expect(getAtPath(data, 'resume.experience[0].company')).toBe('Google');
      expect(getAtPath(data, 'resume.experience[0].bullets[1]')).toBe(
        'Did Next.js stuff'
      );
    });

    it('returns undefined for non-existent paths', () => {
      expect(getAtPath(data, 'resume.experience[1].company')).toBeUndefined();
      expect(getAtPath(data, 'resume.education')).toBeUndefined();
    });
  });

  describe('setAtPath', () => {
    const data = {
      resume: {
        name: 'Alice',
        experience: [
          {
            company: 'Google',
            bullets: ['Did React stuff', 'Did Next.js stuff'],
          },
        ],
      },
    };

    it('immutably sets nested string values', () => {
      const updated = setAtPath(data, 'resume.name', 'Bob');
      expect(updated.resume.name).toBe('Bob');
      expect(data.resume.name).toBe('Alice'); // original unchanged
      expect(updated).not.toBe(data);
      expect(updated.resume).not.toBe(data.resume);
      expect(updated.resume.experience).toBe(data.resume.experience); // shared reference
    });

    it('immutably sets items in nested arrays', () => {
      const updated = setAtPath(data, 'resume.experience[0].bullets[0]', 'Did Vue stuff');
      expect(updated.resume.experience[0].bullets[0]).toBe('Did Vue stuff');
      expect(data.resume.experience[0].bullets[0]).toBe('Did React stuff');
    });

    it('creates nested structures if path does not exist', () => {
      const empty: any = {};
      const updated = setAtPath(empty, 'a.b[0].c', 'hello');
      expect(updated).toEqual({
        a: {
          b: [
            {
              c: 'hello',
            },
          ],
        },
      });
    });
  });

  describe('levenshtein', () => {
    it('calculates distance correctly', () => {
      expect(levenshtein('kitten', 'sitting')).toBe(3);
      expect(levenshtein('hello', 'hello')).toBe(0);
      expect(levenshtein('', 'abc')).toBe(3);
      expect(levenshtein('abc', '')).toBe(3);
      expect(levenshtein('a', 'b')).toBe(1);
    });
  });
});
