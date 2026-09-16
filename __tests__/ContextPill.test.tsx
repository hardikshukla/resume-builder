/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContextPill } from '@/components/ContextPill';

describe('ContextPill', () => {
  it('shows the model name it is given, not a hardcoded mapping', () => {
    render(<ContextPill modelName="Claude Sonnet 4.6" matchScore={80} editCount={0} appliedRecsCount={0} />);
    expect(screen.getByText('Model: Claude Sonnet 4.6')).toBeInTheDocument();
  });

  it('pluralises edit and recommendation counts', () => {
    render(<ContextPill modelName="Claude Opus 5" matchScore={40} editCount={1} appliedRecsCount={2} />);
    expect(screen.getByText('1 edit')).toBeInTheDocument();
    expect(screen.getByText('2 recs applied')).toBeInTheDocument();
  });
});
