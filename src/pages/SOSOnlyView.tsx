import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import {
  IonPage,
  IonContent,
  IonButton,
  IonIcon,
  IonText,
} from '@ionic/react';
import { logOutOutline, checkmarkCircle } from 'ionicons/icons';
import { SOSButton } from '../components/sos';
import { signOut } from '../services/auth';

/**
 * Locked-down SOS-only screen for Texters whose account is paused or
 * deactivated. The session is allowed to exist (audit fix #23) precisely
 * so this button still works in an emergency — RLS for sos_alerts
 * intentionally has no is_active/is_paused check.
 *
 * No other in-app navigation is available here. The router (PrivateRoute)
 * redirects regular routes back to /sos-only when the auth state has
 * `sosOnly = true` so the user can't slip past this screen.
 */
const SOSOnlyView: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [alertSent, setAlertSent] = useState(false);

  // Defensive: if we land on this page without being in sosOnly mode,
  // bounce back to chats. We don't query the AuthContext here because
  // the context-level guard is what put us here — but if a user types
  // the URL manually and isn't paused, we still don't want to render
  // a stuck screen. The router-level guard does the actual enforcement.

  useEffect(() => {
    if (alertSent) {
      const timer = setTimeout(() => setAlertSent(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [alertSent]);

  const handleSignOut = async () => {
    await signOut();
    history.replace('/welcome');
  };

  return (
    <IonPage>
      <IonContent fullscreen className="ion-padding">
        <div className="sos-only-container">
          <div className="sos-only-header">
            <h1>{t('sosOnly.title', 'Ditt konto är pausat')}</h1>
            <p className="sos-only-subtitle">
              {t(
                'sosOnly.subtitle',
                'Kontakta din vuxen för att aktivera kontot igen. Du kan fortfarande skicka SOS i en nödsituation.'
              )}
            </p>
          </div>

          {alertSent ? (
            <div className="sos-only-confirmation">
              <IonIcon icon={checkmarkCircle} className="sos-only-confirm-icon" />
              <IonText>
                <p>{t('sos.alertSent', 'SOS skickat!')}</p>
              </IonText>
            </div>
          ) : (
            <div className="sos-only-button-wrapper">
              <SOSButton
                size="large"
                onAlertSent={() => setAlertSent(true)}
              />
              <p className="sos-only-helper">
                {t(
                  'sosOnly.helper',
                  'Tryck på SOS endast i en akut situation.'
                )}
              </p>
            </div>
          )}

          <div className="sos-only-footer">
            <IonButton
              fill="clear"
              size="small"
              onClick={handleSignOut}
            >
              <IonIcon icon={logOutOutline} slot="start" />
              {t('common.signOut', 'Logga ut')}
            </IonButton>
          </div>
        </div>

        <style>{`
          .sos-only-container {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 100%;
            padding: 1.5rem 1rem;
          }

          .sos-only-header h1 {
            margin: 1rem 0 0.5rem;
            font-size: 1.5rem;
            font-weight: 700;
            color: hsl(var(--foreground));
          }

          .sos-only-subtitle {
            color: hsl(var(--muted-foreground));
            font-size: 0.95rem;
            line-height: 1.5;
          }

          .sos-only-button-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1rem;
            padding: 2rem 0;
          }

          .sos-only-helper {
            color: hsl(var(--muted-foreground));
            font-size: 0.85rem;
            text-align: center;
          }

          .sos-only-confirmation {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.75rem;
            padding: 2rem 0;
            color: hsl(140 60% 45%);
          }

          .sos-only-confirm-icon {
            font-size: 3rem;
          }

          .sos-only-footer {
            display: flex;
            justify-content: center;
            margin-top: 1rem;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default SOSOnlyView;
