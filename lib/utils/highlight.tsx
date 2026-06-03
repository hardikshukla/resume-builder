import React from 'react';

// ── Simple word-level diff for highlights ────────────────────────────────────
export function diffWords(original: string, current: string): React.ReactNode[] {
  if (original === current) return [current];
  if (!original) {
    return [
      <ins key={0} style={{ textDecoration: 'none', background: 'rgba(34,197,94,0.2)', color: '#4ade80' }}>
        {current}
      </ins>
    ];
  }
  const oWords = original.split(/(\s+)/);
  const cWords = current.split(/(\s+)/);
  const dp: number[][] = Array(oWords.length + 1)
    .fill(0)
    .map(() => Array(cWords.length + 1).fill(0));
  for (let i = 1; i <= oWords.length; i++)
    for (let j = 1; j <= cWords.length; j++)
      dp[i][j] = oWords[i - 1] === cWords[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const result: React.ReactNode[] = [];
  let i = oWords.length, j = cWords.length, k = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oWords[i - 1] === cWords[j - 1]) {
      result.unshift(<span key={k++}>{oWords[i - 1]}</span>);
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift(<ins key={k++} style={{ textDecoration: 'none', background: 'rgba(34,197,94,0.2)', color: '#4ade80' }}>{cWords[j - 1]}</ins>);
      j--;
    } else {
      result.unshift(<del key={k++} style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', textDecoration: 'line-through' }}>{oWords[i - 1]}</del>);
      i--;
    }
  }
  return result;
}

// ── Recursive React helper to bold keywords ──────────────────────────────────
export function boldKeywords(node: React.ReactNode, keywords: string[]): React.ReactNode {
  if (!node || keywords.length === 0) return node;

  if (typeof node === 'string') {
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
    const parts = node.split(regex);

    return parts.map((part, index) => {
      const isMatch = keywords.some(
        kw => part.toLowerCase() === kw.toLowerCase()
      );
      return isMatch ? <strong key={index} style={{ fontWeight: 700 }}>{part}</strong> : part;
    });
  }

  if (React.isValidElement(node)) {
    const children = React.Children.map(node.props.children, child =>
      boldKeywords(child, keywords)
    );
    return React.cloneElement(node, {}, children);
  }

  if (Array.isArray(node)) {
    return node.map((item) => boldKeywords(item, keywords));
  }

  return node;
}

// ── Combined helper for diff and highlights ──────────────────────────────────
export function renderDiffText(
  original: string | undefined,
  current: string,
  showHighlights: boolean,
  boldingKeywords: string[],
  applyBolding = true
): React.ReactNode {
  let result: React.ReactNode;
  if (showHighlights && current !== original) {
    result = <>{diffWords(original || '', current)}</>;
  } else {
    result = current;
  }
  return applyBolding ? boldKeywords(result, boldingKeywords) : result;
}
