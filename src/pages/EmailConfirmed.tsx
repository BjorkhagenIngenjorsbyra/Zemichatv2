import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IonPage, IonContent } from '@ionic/react';
import '../theme/auth-forms.css';

const EmailConfirmed: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [countdown, setCountdown] = useState(3);

  // Keep the state updater pure — just tick down. Navigation is a side effect
  // and belongs in its own effect (StrictMode may invoke updaters twice).
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      history.replace('/login');
    }
  }, [countdown, history]);

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="auth-container" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
            {t('emailConfirmed.title')}
          </h2>
          <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '24px' }}>
            {t('emailConfirmed.description')}
          </p>
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
            {t('emailConfirmed.redirect', { seconds: countdown })}
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default EmailConfirmed;
