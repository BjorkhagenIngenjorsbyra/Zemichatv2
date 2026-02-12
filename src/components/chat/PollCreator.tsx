import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IonIcon } from '@ionic/react';
import { close, add, trash } from 'ionicons/icons';

interface PollCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (question: string, options: string[], allowsMultiple: boolean) => void;
}

const PollCreator: React.FC<PollCreatorProps> = ({ isOpen, onClose, onCreate }) => {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowsMultiple, setAllowsMultiple] = useState(false);

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleCreate = () => {
    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);

    if (!trimmedQuestion || trimmedOptions.length < 2) return;

    onCreate(trimmedQuestion, trimmedOptions, allowsMultiple);
    // Reset form
    setQuestion('');
    setOptions(['', '']);
    setAllowsMultiple(false);
    onClose();
  };

  const isValid = question.trim().length > 0 && options.filter((o) => o.trim().length > 0).length >= 2;

  if (!isOpen) return null;

  return (
    <div className="poll-creator-overlay">
      <div className="poll-creator">
        <div className="poll-creator-header">
          <button className="poll-close-btn" onClick={onClose}>
            <IonIcon icon={close} />
          </button>
          <span className="poll-creator-title">{t('poll.createTitle')}</span>
          <button
            className={`poll-create-btn ${isValid ? 'active' : ''}`}
            onClick={handleCreate}
            disabled={!isValid}
          >
            {t('poll.create')}
          </button>
        </div>

        <div className="poll-creator-body">
          <div className="poll-field">
            <label className="poll-label">{t('poll.question')}</label>
            <input
              type="text"
              className="poll-input"
              placeholder={t('poll.questionPlaceholder')}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="poll-field">
            <label className="poll-label">{t('poll.options')}</label>
            {options.map((opt, i) => (
              <div key={i} className="poll-option-row">
                <input
                  type="text"
                  className="poll-input"
                  placeholder={`${t('poll.option')} ${i + 1}`}
                  value={opt}
                  onChange={(e) => handleOptionChange(i, e.target.value)}
                  maxLength={100}
                />
                {options.length > 2 && (
                  <button
                    className="poll-remove-option"
                    onClick={() => handleRemoveOption(i)}
                  >
                    <IonIcon icon={trash} />
                  </button>
                )}
              </div>
            ))}

            {options.length < 10 && (
              <button className="poll-add-option" onClick={handleAddOption}>
                <IonIcon icon={add} />
                <span>{t('poll.addOption')}</span>
              </button>
            )}
          </div>

          <label className="poll-checkbox-row">
            <input
              type="checkbox"
              checked={allowsMultiple}
              onChange={(e) => setAllowsMultiple(e.target.checked)}
            />
            <span>{t('poll.allowMultiple')}</span>
          </label>
        </div>
      </div>

      <style>{`
        .poll-creator-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: hsl(var(--background));
          z-index: 300;
          display: flex;
          flex-direction: column;
          animation: fadeIn 0.2s ease-out;
        }

        .poll-creator {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .poll-creator-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid hsl(var(--border));
        }

        .poll-close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background: transparent;
          border: none;
          cursor: pointer;
          color: hsl(var(--foreground));
          font-size: 1.25rem;
        }

        .poll-creator-title {
          flex: 1;
          font-weight: 600;
          font-size: 1rem;
          color: hsl(var(--foreground));
        }

        .poll-create-btn {
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          background: hsl(var(--muted) / 0.3);
          border: none;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.85rem;
          color: hsl(var(--muted-foreground));
          transition: all 0.15s;
        }

        .poll-create-btn.active {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
        }

        .poll-create-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .poll-creator-body {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
        }

        .poll-field {
          margin-bottom: 1.25rem;
        }

        .poll-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: hsl(var(--muted-foreground));
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .poll-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 0.75rem;
          color: hsl(var(--foreground));
          font-size: 0.95rem;
          outline: none;
          font-family: inherit;
        }

        .poll-input::placeholder {
          color: hsl(var(--muted-foreground));
        }

        .poll-input:focus {
          border-color: hsl(var(--primary));
        }

        .poll-option-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .poll-option-row .poll-input {
          flex: 1;
        }

        .poll-remove-option {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          background: transparent;
          border: 1px solid hsl(var(--border));
          border-radius: 0.75rem;
          cursor: pointer;
          color: hsl(var(--destructive, 0 84% 60%));
          font-size: 1rem;
        }

        .poll-add-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.6rem 1rem;
          background: transparent;
          border: 1px dashed hsl(var(--border));
          border-radius: 0.75rem;
          cursor: pointer;
          color: hsl(var(--primary));
          font-size: 0.9rem;
          font-weight: 500;
          margin-top: 0.5rem;
        }

        .poll-add-option:hover {
          background: hsl(var(--primary) / 0.05);
        }

        .poll-checkbox-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 0;
          cursor: pointer;
          font-size: 0.9rem;
          color: hsl(var(--foreground));
        }

        .poll-checkbox-row input[type="checkbox"] {
          width: 1.25rem;
          height: 1.25rem;
          accent-color: hsl(var(--primary));
        }
      `}</style>
    </div>
  );
};

export default PollCreator;
