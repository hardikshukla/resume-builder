/**
 * __tests__/EditableField.test.tsx
 * Tests for the EditableField component, verifying inline edit, Enter (save), and Escape (cancel without save/blur).
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EditableField } from '../components/EditableField';

describe('EditableField Component', () => {
  it('renders children initially in view mode', () => {
    const onSave = jest.fn();
    render(
      <EditableField path="resume.summary" value="Original text" onSave={onSave}>
        <span>Original text</span>
      </EditableField>
    );

    expect(screen.getByText('Original text')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Edit resume.summary');
  });

  it('enters editing mode when clicked', () => {
    const onSave = jest.fn();
    render(
      <EditableField path="resume.summary" value="Original text" onSave={onSave}>
        <span>Original text</span>
      </EditableField>
    );

    fireEvent.click(screen.getByText('Original text'));
    
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.value).toBe('Original text');
  });

  it('saves on Enter key for single-line input', () => {
    const onSave = jest.fn();
    render(
      <EditableField path="resume.summary" value="Original text" onSave={onSave}>
        <span>Original text</span>
      </EditableField>
    );

    fireEvent.click(screen.getByText('Original text'));
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'New text' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onSave).toHaveBeenCalledWith('resume.summary', 'New text');
  });

  it('saves on blur', () => {
    const onSave = jest.fn();
    render(
      <EditableField path="resume.summary" value="Original text" onSave={onSave}>
        <span>Original text</span>
      </EditableField>
    );

    fireEvent.click(screen.getByText('Original text'));
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'New text via blur' } });
    fireEvent.blur(input);

    expect(onSave).toHaveBeenCalledWith('resume.summary', 'New text via blur');
  });

  it('cancels on Escape key without triggering save during blur', () => {
    const onSave = jest.fn();
    render(
      <EditableField path="resume.summary" value="Original text" onSave={onSave}>
        <span>Original text</span>
      </EditableField>
    );

    fireEvent.click(screen.getByText('Original text'));
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Draft changes' } });
    
    // Press Escape
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

    // Ensure save callback is NOT called
    expect(onSave).not.toHaveBeenCalled();
  });
});
