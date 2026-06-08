import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { IonButton, IonSpinner, IonIcon, IonToast, IonAlert } from '@ionic/react';
import { shieldCheckmarkOutline } from 'ionicons/icons';
import { useAuthContext } from '../../contexts/AuthContext';
import { isMFAEnabled, disableMFA } from '../../services/mfa';
import { UserRole } from '../../types/database';

/**
 * Two-factor authentication entry point in Settings. Opt-in, and only offered to
 * Owners and Supers (the adults) — Texters are never burdened with 2FA. Links to
 * the existing authenticator-app (TOTP) setup flow and shows current status.
 */
export const TwoFactorSetting: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { profile } = useAuthContext();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isOwnerOrSuper = profile?.role === UserRole.OWNER || profile?.role === UserRole.SUPER;

  useEffect(() => {
    if (!isOwnerOrSuper) return;
    isMFAEnabled().then(({ enabled: e }) => setEnabled(e));
  }, [isOwnerOrSuper]);

  if (!isOwnerOrSuper) return null;

  const handleDisable = async () => {
    setBusy(true);
    const { error } = await disableMFA();
    setBusy(false);
    if (!error) {
      setEnabled(false);
      setToast(t('mfa.disabledToast'));
    }
  };

  return (
    <div className="section">
      <h3 className="section-title">{t('mfa.settingsTitle')}</h3>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <IonIcon
            icon={shieldCheckmarkOutline}
            style={{ fontSize: '1.6rem', color: enabled ? 'hsl(var(--secondary))' : 'hsl(var(--muted-foreground))' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>
              {enabled === null ? '…' : enabled ? t('mfa.statusEnabled') : t('mfa.statusDisabled')}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
              {t('mfa.settingsDescription')}
            </div>
          </div>
        </div>
        {enabled === null ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : enabled ? (
          <IonButton expand="block" fill="outline" color="danger" disabled={busy} onClick={() => setConfirmOpen(true)}>
            {busy ? <IonSpinner name="crescent" /> : t('mfa.disable')}
          </IonButton>
        ) : (
          <IonButton expand="block" onClick={() => history.push('/mfa-setup')}>
            {t('mfa.enable')}
          </IonButton>
        )}
      </div>

      <IonAlert
        isOpen={confirmOpen}
        onDidDismiss={() => setConfirmOpen(false)}
        header={t('mfa.disable')}
        message={t('mfa.disableConfirm')}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          { text: t('mfa.disable'), role: 'destructive', handler: handleDisable },
        ]}
      />
      <IonToast isOpen={!!toast} message={toast || ''} duration={2500} onDidDismiss={() => setToast(null)} />
    </div>
  );
};
