import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonButton,
} from '@ionic/react';
import '../theme/auth-forms.css';

const PasswordChanged: React.FC = () => {
  const { t } = useTranslation();

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div className="auth-container">
          <div className="auth-header">
            <img
              src="/favicon-192.png"
              alt="Zemichat"
              className="auth-logo"
            />
            <h1 className="auth-title">{t('auth.passwordChangedTitle')}</h1>
            <p className="auth-subtitle">{t('auth.passwordChangedMessage')}</p>
          </div>

          <div className="auth-form">
            <IonButton
              expand="block"
              routerLink="/login"
              className="auth-button"
            >
              {t('auth.backToLogin')}
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default PasswordChanged;
