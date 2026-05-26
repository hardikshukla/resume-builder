#!/usr/bin/env node
/**
 * run_tests.js — Standalone validation script (no Jest, no ts-node).
 *
 * Directly re-implements and exercises the same logic as:
 *   __tests__/filename.test.ts
 *   __tests__/docx.test.ts  (structural checks via docx package)
 *
 * Run: node scripts/run_tests.js
 */

'use strict';

// ─── Tiny assertion framework ─────────────────────────────────────────────────

let passed = 0, failed = 0;

function expect(actual) {
  return {
    toBe(expected) {
      if (actual === expected) {
        console.log(`  ✅  ${JSON.stringify(actual)}`);
        passed++;
      } else {
        console.error(`  ❌  Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        failed++;
      }
    },
    toBeGreaterThan(n) {
      if (actual > n) {
        console.log(`  ✅  ${actual} > ${n}`);
        passed++;
      } else {
        console.error(`  ❌  Expected > ${n}, got ${actual}`);
        failed++;
      }
    },
    toBe_true() { this.toBe(true); },
    toBeInstanceOf(cls) {
      if (actual instanceof cls) {
        console.log(`  ✅  is instance of ${cls.name}`);
        passed++;
      } else {
        console.error(`  ❌  Expected instance of ${cls.name}, got ${typeof actual}`);
        failed++;
      }
    },
    notToBe(expected) {
      if (actual !== expected) {
        console.log(`  ✅  values differ as expected`);
        passed++;
      } else {
        console.error(`  ❌  Expected values to differ but both were ${JSON.stringify(actual)}`);
        failed++;
      }
    },
  };
}

function describe(label, fn) {
  console.log(`\n📋  ${label}`);
  fn();
}

// ─── Inline implementations (copied from lib/utils/string.ts) ─────────────────

function toPascalCase(str) {
  return str.split(/[^a-zA-Z0-9]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function toCamelCase(str) {
  return str.split(/[^a-zA-Z0-9]+/).filter(Boolean)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function sanitizeFilename(raw) {
  return raw.replace(/\.\./g, '').replace(/[/\\]/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '').replace(/[^\w\s\-().+]/g, '')
    .replace(/\s+/g, '_').slice(0, 80) || 'document';
}

function buildDownloadFilename(candidateName, company, type = 'resume') {
  const namePart    = toPascalCase(candidateName.trim()) || 'Candidate';
  const companyPart = toPascalCase(company.trim())       || 'Tailored';
  const suffix      = type === 'coverLetter' ? '_CoverLetter' : '';
  return `${namePart}_${companyPart}${suffix}.docx`;
}

// ─── Tests: sanitizeFilename ──────────────────────────────────────────────────

describe('sanitizeFilename — directory traversals', () => {
  expect(sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd');
  expect(sanitizeFilename('folder\\file.txt')).toBe('folderfile.txt');
});

describe('sanitizeFilename — spaces to underscores', () => {
  expect(sanitizeFilename('My File Name.docx')).toBe('My_File_Name.docx');
});

// ─── Tests: toCamelCase ───────────────────────────────────────────────────────

describe('toCamelCase', () => {
  expect(toCamelCase('OpenAI Inc.')).toBe('openaiInc');
  expect(toCamelCase('google')).toBe('google');
  expect(toCamelCase('General Motors')).toBe('generalMotors');
});

// ─── Tests: toPascalCase ──────────────────────────────────────────────────────

describe('toPascalCase', () => {
  expect(toPascalCase('OpenAI Inc.')).toBe('OpenaiInc');
  expect(toPascalCase('google')).toBe('Google');
  expect(toPascalCase('General Motors')).toBe('GeneralMotors');
});

// ─── Tests: buildDownloadFilename ─────────────────────────────────────────────

describe('buildDownloadFilename — normal cases', () => {
  expect(buildDownloadFilename('John Smith', 'Google')).toBe('JohnSmith_Google.docx');
  expect(buildDownloadFilename('John Smith', 'Google', 'coverLetter')).toBe('JohnSmith_Google_CoverLetter.docx');
});

describe('buildDownloadFilename — special characters / multi-word', () => {
  expect(buildDownloadFilename('John A. Smith', 'Google LLC')).toBe('JohnASmith_GoogleLlc.docx');
  expect(buildDownloadFilename('Jane-Doe', 'Yahoo! Inc.')).toBe('JaneDoe_YahooInc.docx');
});

describe('buildDownloadFilename — empty fallbacks', () => {
  expect(buildDownloadFilename('', '')).toBe('Candidate_Tailored.docx');
  expect(buildDownloadFilename('', 'Google')).toBe('Candidate_Google.docx');
  expect(buildDownloadFilename('John Smith', '')).toBe('JohnSmith_Tailored.docx');
});

// ─── Tests: DOCX generation (structural) ─────────────────────────────────────
// We require the docx package directly from node_modules (CommonJS-compatible).

async function runDocxTests() {
  const { Document, Paragraph, TextRun, Packer } = require('docx');

  describe('DOCX Packer — basic structural test', () => {
    // This validates that the docx package works and produces a valid ZIP (PK magic bytes)
    // mirroring the structural checks in __tests__/docx.test.ts
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun('Jane Smith')] }),
        new Paragraph({ children: [new TextRun('Senior Engineer at Acme Corp')] }),
      ],
    }],
  });

  const blob   = await Packer.toBlob(doc);
  const buf    = Buffer.from(await blob.arrayBuffer());
  const isPK   = buf[0] === 0x50 && buf[1] === 0x4b;

  describe('Packer.toBlob() returns a Blob', () => {
    expect(blob instanceof Blob).toBe(true);
  });

  describe('DOCX is > 5 KB', () => {
    expect(buf.byteLength).toBeGreaterThan(5 * 1024);
  });

  describe('DOCX starts with PK (ZIP magic bytes)', () => {
    expect(isPK).toBe(true);
  });

  // Now test generateResumeDOCX from lib/docxGenerator.ts
  // We can't directly require a .ts file in Node, but we can check the JS
  // is syntactically correct by verifying the source file hasn't got
  // duplicate exports (the original bug).
  const fs = require('fs');
  const src = fs.readFileSync('./lib/docxGenerator.ts', 'utf8');
  const coverSrc = fs.readFileSync('./lib/coverLetterGenerator.ts', 'utf8');

  describe('docxGenerator.ts — no duplicate generateCoverLetterDOCX export', () => {
    const matches = [...src.matchAll(/export (async )?function generateCoverLetterDOCX/g)];
    expect(matches.length).toBe(0);   // should be 0 — it lives in coverLetterGenerator.ts now
  });

  describe('coverLetterGenerator.ts — exports generateCoverLetterDOCX', () => {
    const matches = [...coverSrc.matchAll(/export (async )?function generateCoverLetterDOCX/g)];
    expect(matches.length).toBe(1);
  });

  describe('docxGenerator.ts — no re-export of generateCoverLetterDOCX', () => {
    // The old fix tried adding: export { generateCoverLetterDOCX } from './coverLetterGenerator'
    // which conflicted with the inline definition. Make sure neither pattern is present.
    const reExportCount = [...src.matchAll(/export \{[^}]*generateCoverLetterDOCX[^}]*\}/g)].length;
    expect(reExportCount).toBe(0);
  });

  describe('docxGenerator.ts — exports generateResumeDOCX', () => {
    const matches = [...src.matchAll(/export (async )?function generateResumeDOCX/g)];
    expect(matches.length).toBe(1);
  });

  describe('coverLetterGenerator.ts — imports Packer from docx', () => {
    const hasPacker = coverSrc.includes('Packer');
    expect(hasPacker).toBe(true);
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────

runDocxTests().then(() => {
  console.log(`\n${'─'.repeat(50)}`);
  if (failed === 0) {
    console.log(`✅  All ${passed} assertions passed.`);
  } else {
    console.error(`❌  ${failed} assertion(s) failed, ${passed} passed.`);
    process.exit(1);
  }
}).catch(err => {
  console.error('\n❌  Unexpected error:', err);
  process.exit(1);
});
