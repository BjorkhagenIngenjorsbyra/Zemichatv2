import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { IonButton, IonSpinner, IonIcon, IonToast } from '@ionic/react';
import { phonePortraitOutline, logOutOutline } from 'ionicons/icons';
import {
  listSessions,
  signOutOtherDevices,
  removeSession,
  type UserSession,
} from '../../services/sessions';
import { formatDateTime } from '../../utils/datetime';

/**
 * Active sessions / devices section for Settings. Shows where the user is signed
 * in and lets them sign out other devices.
 */
export const ActiveSessions: React.FC = () => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const { sessions: rows, currentId: cur } = await listSessions();
      setSessions(rows);
      setCurrentId(cur);
    } catch (err) {
      // A thrown rejection previously left the spinner running forever.
      console.error('Failed to load sessions:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSignOutOthers = async () => {
    setSigningOut(true);
    const { error } = await signOutOtherDevices();
    setSigningOut(false);
    setToast(error ? t('sessions.signOutError') : t('sessions.signedOutOthers'));
    await load();
  };

  const handleRemove = async (id: string) => {
    if (removingId) return; // guard against double-tap firing removeSession twice
    setRemovingId(id);
    try {
      const { error } = await removeSession(id);
      if (error) {
        setToast(t('sessions.signOutError'));
        return;
      }
      await load();
    } catch (err) {
      console.error('Failed to remove session:', err);
      setToast(t('sessions.signOutError'));
    } finally {
      setRemovingId(null);
    }
  };

  const others = sessions.filter((s) => s.id !== currentId);

  return (
    <div className="section">
      <h3 className="section-title">{t('sessions.title')}</h3>
      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : loadError ? (
          <div style={{ textAlign: 'center', padding: '0.5rem' }}>
            <p style={{ color: 'hsl(var(--muted-foreground))', margin: '0 0 0.5rem' }}>{t('errors.generic')}</p>
            <IonButton fill="outline" size="small" onClick={() => { setLoading(true); load(); }}>
              {t('errors.boundaryRetry')}
            </IonButton>
          </div>
        ) : sessions.length === 0 ? (
          <p style={{ color: 'hsl(var(--muted-foreground))', margin: 0 }}>{t('sessions.none')}</p>
        ) : (
          <>
            {sessions.map((s) => {
              const isCurrent = s.id === currentId;
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0',
                  }}
                >
                  <IonIcon icon={phonePortraitOutline} style={{ fontSize: '1.4rem', color: 'hsl(var(--muted-foreground))' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {s.device_name || t('sessions.unknownDevice')}
                      {isCurrent && (
                        <span style={{ color: 'hsl(var(--primary))', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                          {t('sessions.thisDevice')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                      {t('sessions.lastActive')}: {formatDateTime(s.last_active_at)}
                    </div>
                  </div>
                  {!isCurrent && (
                    <IonButton
                      fill="clear"
                      size="small"
                      onClick={() => handleRemove(s.id)}
                      disabled={removingId === s.id}
                      aria-label={t('sessions.remove')}
                    >
                      {removingId === s.id ? (
                        <IonSpinner slot="icon-only" name="crescent" />
                      ) : (
                        <IonIcon slot="icon-only" icon={logOutOutline} />
                      )}
                    </IonButton>
                  )}
                </div>
              );
            })}
            {others.length > 0 && (
              <IonButton
                expand="block"
                fill="outline"
                color="danger"
                onClick={handleSignOutOthers}
                disabled={signingOut}
                style={{ marginTop: '0.75rem' }}
              >
                {signingOut ? <IonSpinner name="crescent" /> : t('sessions.signOutOthers')}
              </IonButton>
            )}
          </>
        )}
      </div>
      <IonToast
        isOpen={!!toast}
        message={toast || ''}
        duration={2500}
        onDidDismiss={() => setToast(null)}
      />
    </div>
  );
};
