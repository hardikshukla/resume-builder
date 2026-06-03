export function parsePath(path: string): (string | number)[] {
  const parts: (string | number)[] = [];
  let i = 0;
  while (i < path.length) {
    if (path[i] === '.') {
      i++;
      continue;
    }
    if (path[i] === '[') {
      let close = path.indexOf(']', i);
      if (close === -1) {
        close = path.length;
      }
      const bracketContent = path.substring(i + 1, close);
      if (/^\d+$/.test(bracketContent)) {
        parts.push(parseInt(bracketContent, 10));
      } else {
        const cleanContent = bracketContent.replace(/^['"]|['"]$/g, '');
        parts.push(cleanContent);
      }
      i = close + 1;
    } else {
      const nextDot = path.indexOf('.', i);
      const nextBracket = path.indexOf('[', i);
      let end = path.length;
      if (nextDot !== -1 && nextDot < end) end = nextDot;
      if (nextBracket !== -1 && nextBracket < end) end = nextBracket;
      
      const segment = path.substring(i, end);
      if (segment) {
        parts.push(segment);
      }
      i = end;
    }
  }
  return parts;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAtPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = parsePath(path);
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setAtPath<T>(obj: T, path: string, value: any): T {
  if (!path) return obj;
  const parts = parsePath(path);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function helper(current: any, index: number): any {
    if (index === parts.length) {
      return value;
    }
    const part = parts[index];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cloned: any;
    if (Array.isArray(current)) {
      cloned = [...current];
    } else if (current && typeof current === 'object') {
      cloned = { ...current };
    } else {
      cloned = typeof part === 'number' ? [] : {};
    }
    
    cloned[part] = helper(cloned[part], index + 1);
    return cloned;
  }
  
  return helper(obj, 0) as T;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  
  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  let currRow = new Array(b.length + 1);
  
  for (let i = 0; i < a.length; i++) {
    currRow[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      currRow[j + 1] = Math.min(
        currRow[j] + 1,
        prevRow[j + 1] + 1,
        prevRow[j] + cost
      );
    }
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }
  
  return prevRow[b.length];
}
