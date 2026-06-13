import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonIcon,
  IonSpinner,
  useIonToast,
} from '@ionic/react';
import { timeOutline } from 'ionicons/icons';
import { getTexterSettings, updateTexterSettings } from '../../services/members';
import { type TexterSettings } from '../../types/database';

interface QuietHoursManagerProps {
  userId: string;
}

// Stored values follow JS getDay() (0 = Sunday), but display Monday-first to
// match Swedish/ISO-8601 convention (Fable flagged the Sunday-first order).
const DAYS_OF_WEEK = [
  { value: 1, labelKey: 'quietHours.monday' },
  { value: 2, labelKey: 'quietHours.tuesday' },
  { value: 3, labelKey: 'quietHours.wednesday' },
  { value: 4, labelKey: 'quietHours.thursday' },
  { value: 5, labelKey: 'quietHours.friday' },
  { value: 6, labelKey: 'quietHours.saturday' },
  { value: 0, labelKey: 'quietHours.sunday' },
];

/**
 * Manager component for Owners to configure quiet hours for a Texter.
 *
 * Time entry uses native <input type="time"> rather than an IonDatetime modal:
 * the modal rendered as an unstyled box in dark mode with no confirm button and
 * saved on every wheel tick (Fable round-3 flagged it as unusable). The native
 * control brings the OS/browser time picker — consistent dark-mode rendering,
 * its own confirm, 24h locale formatting, and built-in accessibility.
 */
export const QuietHoursManager: React.FC<QuietHoursManagerProps> = ({
  userId,
}) => {
  const { t } = useTranslation();
  const [present] = useIonToast();
  const [, setSettings] = useState<TexterSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [startTime, setStartTime] = useState('21:00');
  const [endTime, setEndTime] = useState('07:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const loadSettings = useCallback(async () => {
    const { settings: texterSettings } = await getTexterSettings(userId);
    setSettings(texterSettings);

    if (texterSettings) {
      const hasQuietHours = !!texterSettings.quiet_hours_start;
      setIsEnabled(hasQuietHours);

      if (texterSettings.quiet_hours_start) {
        setStartTime(texterSettings.quiet_hours_start.substring(0, 5));
      }
      if (texterSettings.quiet_hours_end) {
        setEndTime(texterSettings.quiet_hours_end.substring(0, 5));
      }
      if (texterSettings.quiet_hours_days) {
        setSelectedDays(texterSettings.quiet_hours_days);
      }
    }

    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // This is a child-safety control: if a save silently fails, the Owner would
  // believe a quiet-hours restriction is active when it isn't. Revert the
  // optimistic change and surface the failure on error.
  const saveFailed = () => {
    present({ message: t('errors.generic'), duration: 3000, color: 'danger' });
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    const prev = isEnabled;
    setIsEnabled(enabled);
    setIsSaving(true);

    const { error } = enabled
      ? await updateTexterSettings(userId, {
          quiet_hours_start: startTime,
          quiet_hours_end: endTime,
          quiet_hours_days: selectedDays,
        })
      : await updateTexterSettings(userId, {
          quiet_hours_start: null,
          quiet_hours_end: null,
          quiet_hours_days: null,
        });

    setIsSaving(false);
    if (error) {
      console.error('Failed to update quiet hours:', error);
      setIsEnabled(prev);
      saveFailed();
    }
  };

  const handleSaveTime = async (type: 'start' | 'end', time: string) => {
    // Native time inputs yield "HH:MM"; ignore an empty/cleared value.
    const timeOnly = (time || '').substring(0, 5);
    if (!/^\d{2}:\d{2}$/.test(timeOnly)) return;

    const prev = type === 'start' ? startTime : endTime;
    if (type === 'start') {
      setStartTime(timeOnly);
    } else {
      setEndTime(timeOnly);
    }

    if (isEnabled) {
      setIsSaving(true);
      const { error } = await updateTexterSettings(userId, {
        [type === 'start' ? 'quiet_hours_start' : 'quiet_hours_end']: timeOnly,
      });
      setIsSaving(false);
      if (error) {
        console.error('Failed to update quiet hours time:', error);
        if (type === 'start') setStartTime(prev);
        else setEndTime(prev);
        saveFailed();
      }
    }
  };

  const handleToggleDay = async (day: number) => {
    const prev = selectedDays;
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day].sort();

    setSelectedDays(newDays);

    if (isEnabled) {
      setIsSaving(true);
      const { error } = await updateTexterSettings(userId, {
        quiet_hours_days: newDays,
      });
      setIsSaving(false);
      if (error) {
        console.error('Failed to update quiet hours days:', error);
        setSelectedDays(prev);
        saveFailed();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="quiet-hours-loading">
        <IonSpinner name="crescent" />
      </div>
    );
  }

  return (
    <div className="quiet-hours-manager" data-testid="quiet-hours-manager">
      <div className="manager-header">
        <h3 className="section-title">{t('quietHours.title')}</h3>
      </div>

      <p className="manager-description">{t('quietHours.description')}</p>

      <IonList className="settings-list">
        <IonItem className="toggle-item">
          <IonIcon icon={timeOutline} slot="start" className="toggle-icon" />
          <IonLabel>{t('quietHours.enable')}</IonLabel>
          <IonToggle
            checked={isEnabled}
            onIonChange={(e) => handleToggleEnabled(e.detail.checked)}
            disabled={isSaving}
            data-testid="quiet-hours-toggle"
          />
        </IonItem>

        {isEnabled && (
          <>
            <IonItem className="time-item">
              <IonLabel>
                <h3>{t('quietHours.startTime')}</h3>
              </IonLabel>
              <input
                type="time"
                className="time-input"
                value={startTime}
                disabled={isSaving}
                aria-label={t('quietHours.startTime')}
                onChange={(e) => handleSaveTime('start', e.target.value)}
                data-testid="quiet-hours-start"
                slot="end"
              />
            </IonItem>

            <IonItem className="time-item">
              <IonLabel>
                <h3>{t('quietHours.endTime')}</h3>
              </IonLabel>
              <input
                type="time"
                className="time-input"
                value={endTime}
                disabled={isSaving}
                aria-label={t('quietHours.endTime')}
                onChange={(e) => handleSaveTime('end', e.target.value)}
                data-testid="quiet-hours-end"
                slot="end"
              />
            </IonItem>
          </>
        )}
      </IonList>

      {isEnabled && (
        <div className="days-section">
          <h4 className="days-title">{t('quietHours.activeDays')}</h4>
          <div className="days-grid">
            {DAYS_OF_WEEK.map((day) => {
              const selected = selectedDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  className={`day-button ${selected ? 'selected' : ''}`}
                  onClick={() => handleToggleDay(day.value)}
                  disabled={isSaving}
                  aria-pressed={selected}
                  aria-label={t(day.labelKey)}
                  data-testid={`day-button-${day.value}`}
                >
                  {t(day.labelKey).charAt(0)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .quiet-hours-manager {
          margin-bottom: 1rem;
        }

        .quiet-hours-loading {
          display: flex;
          justify-content: center;
          padding: 2rem;
        }

        .manager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .section-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: hsl(var(--foreground));
          letter-spacing: 0.05em;
          text-transform: uppercase;
          opacity: 0.7;
          margin: 0;
        }

        .manager-description {
          font-size: 0.85rem;
          color: hsl(var(--muted-foreground));
          margin: 0 0 1rem 0;
        }

        .settings-list {
          background: hsl(var(--card));
          border-radius: 1rem;
          overflow: hidden;
          padding: 0;
          margin-bottom: 1rem;
        }

        .toggle-item,
        .time-item {
          --background: transparent;
          --border-color: hsl(var(--border));
          --padding-start: 1rem;
          --color: hsl(var(--foreground));
        }

        .toggle-icon {
          color: hsl(var(--primary));
          font-size: 1.25rem;
        }

        .time-item h3 {
          font-weight: 600;
          font-size: 0.95rem;
          color: hsl(var(--foreground));
        }

        /* Native time field, themed to read clearly in dark mode. */
        .time-input {
          color-scheme: dark light;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          padding: 0.4rem 0.6rem;
          font-size: 0.95rem;
          font-weight: 600;
          font-family: inherit;
        }

        .time-input:disabled {
          opacity: 0.5;
        }

        .days-section {
          background: hsl(var(--card));
          border-radius: 1rem;
          padding: 1rem;
        }

        .days-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: hsl(var(--foreground));
          margin: 0 0 0.75rem 0;
        }

        .days-grid {
          display: flex;
          gap: 0.5rem;
          justify-content: space-between;
        }

        .day-button {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid hsl(var(--border));
          background: transparent;
          color: hsl(var(--foreground));
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .day-button.selected {
          background: hsl(var(--primary));
          border-color: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
        }

        .day-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default QuietHoursManager;
