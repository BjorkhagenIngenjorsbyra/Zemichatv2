import React, { useRef } from 'react';
import { IonInput } from '@ionic/react';

interface ZemiNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Formatted input for Zemi numbers (ZEMI-XXX-XXX).
 */
export const ZemiNumberInput: React.FC<ZemiNumberInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'ZEMI-XXX-XXX',
  disabled = false,
}) => {
  const inputRef = useRef<HTMLIonInputElement>(null);

  const handleInput = (e: CustomEvent) => {
    // Single source of truth for formatting so backspacing into the prefix
    // doesn't re-grow the field. The parent's `value` prop (controlled) is the
    // only state — no derived displayValue.
    onChange(formatZemiNumber(e.detail.value || ''));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSubmit) {
      onSubmit();
    }
  };

  return (
    <div className="zemi-input-container">
      <IonInput
        ref={inputRef}
        value={formatZemiNumber(value)}
        onIonInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="zemi-input"
        inputmode="text"
        autocapitalize="characters"
      />

      <style>{`
        .zemi-input-container {
          width: 100%;
        }

        .zemi-input {
          --background: hsl(var(--card));
          --border-radius: 1rem;
          --padding-start: 1rem;
          --padding-end: 1rem;
          --padding-top: 0.75rem;
          --padding-bottom: 0.75rem;
          border: 1px solid hsl(var(--border));
          border-radius: 1rem;
          font-family: monospace;
          font-size: 1.25rem;
          font-weight: 600;
          text-align: center;
          letter-spacing: 0.1em;
        }

        .zemi-input input {
          text-align: center !important;
          text-transform: uppercase;
        }

        .zemi-input:focus-within {
          border-color: hsl(var(--primary));
        }
      `}</style>
    </div>
  );
};

/**
 * Format a raw string as a Zemi number (ZEMI-XXX-XXX).
 */
function formatZemiNumber(value: string): string {
  if (!value) return '';

  // Clean and uppercase
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  // Empty after cleaning — allow the field to be cleared.
  if (cleaned.length === 0) return '';

  // Already fully formatted
  if (value.match(/^ZEMI-[A-Z0-9]{3}-[A-Z0-9]{3}$/)) {
    return value.toUpperCase();
  }

  // A partial 'ZEMI' prefix still being typed or deleted (Z, ZE, ZEM, ZEMI):
  // return it verbatim so backspace shrinks the field instead of re-growing it
  // into 'ZEMI-ZEM'.
  if ('ZEMI'.startsWith(cleaned)) {
    return cleaned;
  }

  // Body is everything after a leading ZEMI, or the raw digits if the user
  // typed the body directly (we then assume the ZEMI- prefix).
  const body = cleaned.startsWith('ZEMI') ? cleaned.slice(4) : cleaned;
  let formatted = 'ZEMI';
  if (body.length > 0) formatted += '-' + body.slice(0, 3);
  if (body.length > 3) formatted += '-' + body.slice(3, 6);
  return formatted;
}

/**
 * Validate if a string is a complete, valid Zemi number.
 */
export function isValidZemiNumber(value: string): boolean {
  return /^ZEMI-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(value.toUpperCase());
}

export default ZemiNumberInput;
