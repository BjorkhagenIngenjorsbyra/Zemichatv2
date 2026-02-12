import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IonPage, IonContent } from '@ionic/react';
import '../theme/auth-forms.css';

const EmailConfirmed: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          history.replace('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [history]);

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
