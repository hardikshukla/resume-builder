import React, { useState, useEffect, useRef } from 'react';

interface EditableFieldProps {
  path: string;
  value: string;
  multiline?: boolean;
  onSave: (path: string, newValue: string) => void;
  isEdited?: boolean;
  children: React.ReactNode;
}

export const EditableField: React.FC<EditableFieldProps> = ({
  path,
  value,
  multiline = false,
  onSave,
  isEdited = false,
  children,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const isCancellingRef = useRef(false);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      isCancellingRef.current = false;
      if (inputRef.current) {
        inputRef.current.focus();
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }
  }, [isEditing]);

  const handleSave = () => {
    if (isCancellingRef.current) {
      isCancellingRef.current = false;
      return;
    }
    setIsEditing(false);
    if (editValue !== value) {
      onSave(path, editValue);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      isCancellingRef.current = true;
      handleCancel();
    } else if (e.key === 'Enter') {
      if (!multiline) {
        e.preventDefault();
        handleSave();
      } else if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSave();
      }
    }
  };

  const handleViewKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsEditing(true);
    }
  };

  if (isEditing) {
    const commonProps = {
      value: editValue,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditValue(e.target.value),
      onBlur: handleSave,
      onKeyDown: handleKeyDown,
      className: `editable-field--input ${multiline ? 'editable-field--textarea' : ''}`,
      style: {
        width: '100%',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        fontWeight: 'inherit',
        lineHeight: 'inherit',
        color: 'inherit',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        resize: 'none' as const,
        padding: 0,
        margin: 0,
      },
    };

    return (
      <div 
        className="editable-field-container editable-field-container--editing"
        style={{
          borderLeft: '2px solid var(--primary-main, #1976d2)',
          paddingLeft: '4px',
          background: 'rgba(25, 118, 210, 0.04)',
        }}
      >
        {multiline ? (
          <textarea {...commonProps} ref={inputRef as React.RefObject<HTMLTextAreaElement>} rows={3} />
        ) : (
          <input type="text" {...commonProps} ref={inputRef as React.RefObject<HTMLInputElement>} />
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      onKeyDown={handleViewKeyDown}
      tabIndex={0}
      role="textbox"
      aria-label={`Edit ${path}`}
      className={`editable-field ${isEdited ? 'editable-field--edited' : ''}`}
      style={{
        cursor: 'text',
        display: 'inline-block',
        width: '100%',
        outline: 'none',
        position: 'relative',
      }}
    >
      {children}
    </div>
  );
};
