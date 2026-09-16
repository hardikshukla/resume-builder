import { createKeywordMatcher } from '@/lib/utils/keywords';
import { contactParts, shortenUrl } from '@/lib/utils/contact';

describe('createKeywordMatcher', () => {
  it('splits on whole-word matches only, ignoring case', () => {
    const matcher = createKeywordMatcher(['React']);
    expect(matcher.split('react and Reactive React.')).toEqual(['', 'react', ' and Reactive ', 'React', '.']);
  });

  it('matches keywords that start or end with punctuation', () => {
    const matcher = createKeywordMatcher(['C++', '.NET']);
    expect(matcher.split('C++ and .NET').filter((p) => matcher.isKeyword(p))).toEqual(['C++', '.NET']);
  });

  it('treats regex characters in keywords literally', () => {
    const matcher = createKeywordMatcher(['a.b']);
    expect(matcher.split('axb a.b').filter((p) => matcher.isKeyword(p))).toEqual(['a.b']);
  });

  it('prefers the first listed keyword when phrases overlap', () => {
    const matcher = createKeywordMatcher(['Machine Learning', 'Machine']);
    expect(matcher.split('Machine Learning').filter((p) => matcher.isKeyword(p))).toEqual(['Machine Learning']);
  });
});

describe('contactParts', () => {
  const contact = {
    email: 'jane@example.com',
    phone: null,
    linkedin: 'https://www.linkedin.com/in/jane/',
    github: 'http://github.com/jane',
    location: 'Austin',
  };

  it('keeps full URLs by default and drops empty fields', () => {
    expect(contactParts(contact)).toEqual([
      'jane@example.com', 'https://www.linkedin.com/in/jane/', 'http://github.com/jane', 'Austin',
    ]);
  });

  it('shortens profile links when asked', () => {
    expect(contactParts(contact, { shortenUrls: true })).toEqual([
      'jane@example.com', 'linkedin.com/in/jane', 'github.com/jane', 'Austin',
    ]);
  });

  it('returns nothing for a missing contact block', () => {
    expect(contactParts(undefined)).toEqual([]);
  });

  it('shortenUrl strips protocol, www and trailing slash', () => {
    expect(shortenUrl('https://www.example.com/a/')).toBe('example.com/a');
  });
});
