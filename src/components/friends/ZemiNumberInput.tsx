import React, { useState, useEffect, useRef } from 'react';
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
  const [displayValue, setDisplayValue] = useState('');
  const inputRef = useRef<HTMLIonInputElement>(null);

  // Format the value for display
  useEffect(() => {
    const formatted = formatZemiNumber(value);
    setDisplayValue(formatted);
  }, [value]);

  const handleInput = (e: CustomEvent) => {
    const inputValue = e.detail.value || '';

    // Remove all non-alphanumeric characters and convert to uppercase
    const cleaned = inputValue.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    // Format as ZEMI-XXX-XXX
    let formatted = '';

    // Add ZEMI prefix if user types it or starts with Z
    if (cleaned.startsWith('ZEMI')) {
      formatted = 'ZEMI';
      const rest = cleaned.slice(4);

      if (rest.length > 0) {
        formatted += '-' + rest.slice(0, 3);
      }
      if (rest.length > 3) {
        formatted += '-' + rest.slice(3, 6);
      }
    } else if (cleaned.length > 0) {
      // User is typing numbers directly - assume they want ZEMI- prefix
      formatted = 'ZEMI-' + cleaned.slice(0, 3);
      if (cleaned.length > 3) {
        formatted += '-' + cleaned.slice(3, 6);
      }
    }

    setDisplayValue(formatted);
    onChange(formatted);
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
        value={displayValue}
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

  // Already formatted
  if (value.match(/^ZEMI-[A-Z0-9]{3}-[A-Z0-9]{3}$/)) {
    return value.toUpperCase();
  }

  // Format
  if (cleaned.startsWith('ZEMI')) {
    const rest = cleaned.slice(4);
    if (rest.length >= 6) {
      return `ZEMI-${rest.slice(0, 3)}-${rest.slice(3, 6)}`;
    } else if (rest.length >= 3) {
      return `ZEMI-${rest.slice(0, 3)}-${rest.slice(3)}`;
    } else if (rest.length > 0) {
      return `ZEMI-${rest}`;
    }
    return 'ZEMI';
  }

  // Just numbers
  if (cleaned.length >= 6) {
    return `ZEMI-${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
  } else if (cleaned.length >= 3) {
    return `ZEMI-${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  } else if (cleaned.length > 0) {
    return `ZEMI-${cleaned}`;
  }

  return '';
}

/**
 * Validate if a string is a complete, valid Zemi number.
 */
export function isValidZemiNumber(value: string): boolean {
  return /^ZEMI-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(value.toUpperCase());
}

export default ZemiNumberInput;
