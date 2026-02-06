import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonButton,
  IonIcon,
  IonSpinner,
  IonDatetime,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
} from '@ionic/react';
import { timeOutline, checkmark } from 'ionicons/icons';
import { getTexterSettings, updateTexterSettings } from '../../services/members';
import { type TexterSettings } from '../../types/database';

interface QuietHoursManagerProps {
  userId: string;
}

// Days of week: 0 = Sunday, 1 = Monday, etc.
const DAYS_OF_WEEK = [
  { value: 0, labelKey: 'quietHours.sunday' },
  { value: 1, labelKey: 'quietHours.monday' },
  { value: 2, labelKey: 'quietHours.tuesday' },
  { value: 3, labelKey: 'quietHours.wednesday' },
  { value: 4, labelKey: 'quietHours.thursday' },
  { value: 5, labelKey: 'quietHours.friday' },
  { value: 6, labelKey: 'quietHours.saturday' },
];

/**
 * Manager component for Owners to configure quiet hours for a Texter.
 */
export const QuietHoursManager: React.FC<QuietHoursManagerProps> = ({
  userId,
}) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<TexterSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [startTime, setStartTime] = useState('21:00');
  const [endTime, setEndTime] = useState('07:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const loadSettings = useCallback(async () => {
    const { settings: texterSettings } = await getTexterSettings(userId);
    setSettings(texterSettings);

    if (texterSettings) {
      const hasQuietHours = !!texterSettings.quiet_hours_start;
      setIsEnabled(hasQuietHours);

      if (texterSettings.quiet_hours_start) {
        setStartTime(texterSettings.quiet_hours_start);
      }
      if (texterSettings.quiet_hours_end) {
        setEndTime(texterSettings.quiet_hours_end);
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

  const handleToggleEnabled = async (enabled: boolean) => {
    setIsEnabled(enabled);
    setIsSaving(true);

    if (enabled) {
      // Enable with current settings
      await updateTexterSettings(userId, {
        quiet_hours_start: startTime,
        quiet_hours_end: endTime,
        quiet_hours_days: selectedDays,
      });
    } else {
      // Disable by clearing values
      await updateTexterSettings(userId, {
        quiet_hours_start: null,
        quiet_hours_end: null,
        quiet_hours_days: null,
      });
    }

    setIsSaving(false);
  };

  const handleSaveTime = async (type: 'start' | 'end', time: string) => {
    const timeOnly = time.split('T')[1]?.substring(0, 5) || time.substring(0, 5);

    if (type === 'start') {
      setStartTime(timeOnly);
      setShowStartPicker(false);
    } else {
      setEndTime(timeOnly);
      setShowEndPicker(false);
    }

    if (isEnabled) {
      setIsSaving(true);
      await updateTexterSettings(userId, {
        [type === 'start' ? 'quiet_hours_start' : 'quiet_hours_end']: timeOnly,
      });
      setIsSaving(false);
    }
  };

  const handleToggleDay = async (day: number) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day].sort();

    setSelectedDays(newDays);

    if (isEnabled) {
      setIsSaving(true);
      await updateTexterSettings(userId, {
        quiet_hours_days: newDays,
      });
      setIsSaving(false);
    }
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (isLoading) {
    return (
      <div className="quiet-hours-loading">
        <IonSpinner name="crescent" />
      </div>
    );
  }

  return (
    <div className="quiet-hours-manager">
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
          />
        </IonItem>

        {isEnabled && (
          <>
            <IonItem button onClick={() => setShowStartPicker(true)} className="time-item">
              <IonLabel>
                <h3>{t('quietHours.startTime')}</h3>
                <p>{formatTime(startTime)}</p>
              </IonLabel>
            </IonItem>

            <IonItem button onClick={() => setShowEndPicker(true)} className="time-item">
              <IonLabel>
                <h3>{t('quietHours.endTime')}</h3>
                <p>{formatTime(endTime)}</p>
              </IonLabel>
            </IonItem>
          </>
        )}
      </IonList>

      {isEnabled && (
        <div className="days-section">
          <h4 className="days-title">{t('quietHours.activeDays')}</h4>
          <div className="days-grid">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day.value}
                className={`day-button ${selectedDays.includes(day.value) ? 'selected' : ''}`}
                onClick={() => handleToggleDay(day.value)}
                disabled={isSaving}
              >
                {t(day.labelKey).charAt(0)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Start Time Picker Modal */}
      <IonModal isOpen={showStartPicker} onDidDismiss={() => setShowStartPicker(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{t('quietHours.selectStartTime')}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowStartPicker(false)}>
                {t('common.cancel')}
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonDatetime
            presentation="time"
            value={`2024-01-01T${startTime}:00`}
            onIonChange={(e) => {
              const value = e.detail.value as string;
              if (value) handleSaveTime('start', value);
            }}
          />
        </IonContent>
      </IonModal>

      {/* End Time Picker Modal */}
      <IonModal isOpen={showEndPicker} onDidDismiss={() => setShowEndPicker(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{t('quietHours.selectEndTime')}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowEndPicker(false)}>
                {t('common.cancel')}
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonDatetime
            presentation="time"
            value={`2024-01-01T${endTime}:00`}
            onIonChange={(e) => {
              const value = e.detail.value as string;
              if (value) handleSaveTime('end', value);
            }}
          />
        </IonContent>
      </IonModal>

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
          color: hsl(var(--muted-foreground));
          text-transform: uppercase;
          letter-spacing: 0.05em;
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

        .time-item p {
          font-size: 0.85rem;
          color: hsl(var(--primary));
          font-weight: 500;
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
          color: hsl(var(--muted-foreground));
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
