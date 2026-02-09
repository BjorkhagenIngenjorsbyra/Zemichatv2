import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface PasswordStrengthProps {
  password: string;
}

interface StrengthLevel {
  level: number;
  label: string;
  color: string;
  emoji: string;
}

function calculateStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password }) => {
  const { t } = useTranslation();

  const strength: StrengthLevel = useMemo(() => {
    if (!password) {
      return { level: 0, label: '', color: '#ccc', emoji: '' };
    }
    const score = calculateStrength(password);
    switch (score) {
      case 0:
      case 1:
        return { level: 1, label: t('passwordStrength.weak'), color: '#EF4444', emoji: '💀' };
      case 2:
        return { level: 2, label: t('passwordStrength.fair'), color: '#F59E0B', emoji: '😐' };
      case 3:
        return { level: 3, label: t('passwordStrength.good'), color: '#EAB308', emoji: '😊' };
      case 4:
        return { level: 4, label: t('passwordStrength.strong'), color: '#22C55E', emoji: '💪' };
      default:
        return { level: 0, label: '', color: '#ccc', emoji: '' };
    }
  }, [password, t]);

  if (!password) return null;

  const widthPercent = (strength.level / 4) * 100;

  return (
    <div className="password-strength">
      <style>{`
        .password-strength {
          margin-top: 8px;
        }
        .password-strength-bar-track {
          width: 100%;
          height: 6px;
          background: hsl(0 0% 90%);
          border-radius: 3px;
          overflow: hidden;
        }
        .password-strength-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.4s ease, background-color 0.4s ease;
        }
        .password-strength-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
          font-size: 13px;
          font-weight: 500;
        }
        .password-strength-emoji {
          font-size: 18px;
          transition: transform 0.3s ease;
        }
        .password-strength-emoji.strong {
          animation: strengthPulse 0.6s ease;
        }
        @keyframes strengthPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }
      `}</style>
      <div className="password-strength-bar-track">
        <div
          className="password-strength-bar-fill"
          style={{
            width: `${widthPercent}%`,
            backgroundColor: strength.color,
          }}
        />
      </div>
      <div className="password-strength-label">
        <span style={{ color: strength.color }}>{strength.label}</span>
        <span className={`password-strength-emoji${strength.level === 4 ? ' strong' : ''}`}>
          {strength.emoji}
        </span>
      </div>
    </div>
  );
};
