import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonSpinner,
  IonInput,
  IonText,
  IonToggle,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/react';
import {
  downloadOutline,
  trashOutline,
  warningOutline,
  createOutline,
  checkmarkOutline,
  documentTextOutline,
  shieldCheckmarkOutline,
  helpCircleOutline,
  gridOutline,
  chevronForwardOutline,
  logOutOutline,
  shareSocialOutline,
  copyOutline,
  peopleOutline,
  newspaperOutline,
} from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../services/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { getTeamMembers } from '../services/members';
import { exportUserData, deleteOwnerAccount, deleteSuperAccount, updateUserProfile, downloadJSON } from '../services/gdpr';
import { claimReferralRewards, getReferralStats } from '../services/referral';
import { UserRole, PlanType, type ReferralStats } from '../types/database';
import { SOSButton } from '../components/sos';
import { supportedLanguages, changeLanguage, getCurrentLanguage } from '../i18n';

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { profile, signOut, refreshProfile } = useAuthContext();
  const { currentPlan, isTrialActive, isTrialExpired, trialDaysLeft, status, showPaywall } = useSubscription();

  const isOwner = profile?.role === UserRole.OWNER;
  const isSuper = profile?.role === UserRole.SUPER;
  const isTexter = profile?.role === UserRole.TEXTER;

  const [memberCount, setMemberCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteSection, setShowDeleteSection] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'more'>('general');

  // Profile editing
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(profile?.display_name || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Language
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());

  // Wall visibility
  const [wallEnabled, setWallEnabled] = useState(profile?.wall_enabled ?? true);

  // Referral
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);

  const confirmWord = t('settings.deleteAccountConfirmWord');
  const canDelete = confirmText === confirmWord;

  const loadMemberCount = useCallback(async () => {
    if (!isOwner) return;
    const { members } = await getTeamMembers();
    setMemberCount(members.length);
  }, [isOwner]);

  const loadReferralStats = useCallback(async () => {
    if (!isOwner) return;
    // Auto-claim any pending rewards, then fetch stats
    await claimReferralRewards();
    const { stats } = await getReferralStats();
    setReferralStats(stats);
  }, [isOwner]);

  useEffect(() => {
    loadMemberCount();
    loadReferralStats();
  }, [loadMemberCount, loadReferralStats]);

  useEffect(() => {
    if (profile?.display_name) {
      setEditName(profile.display_name);
    }
  }, [profile?.display_name]);

  useEffect(() => {
    if (profile?.wall_enabled !== undefined) {
      setWallEnabled(profile.wall_enabled);
    }
  }, [profile?.wall_enabled]);

  const handleWallToggle = async (checked: boolean) => {
    if (!profile) return;
    setWallEnabled(checked);
    const { error } = await supabase
      .from('users')
      .update({ wall_enabled: checked } as never)
      .eq('id', profile.id);
    if (error) {
      setWallEnabled(!checked);
    } else {
      await refreshProfile();
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    setExportError(null);

    const { data, error } = await exportUserData();

    if (error || !data) {
      setExportError(error?.message || t('settings.exportDataError'));
      setIsExporting(false);
      return;
    }

    const filename = `zemichat-data-${profile?.zemi_number || 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      await downloadJSON(data, filename);
      setExportSuccess(true);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('settings.exportDataError'));
    }
    setIsExporting(false);
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);

    const { error } = await updateUserProfile(editName.trim() || null);

    if (error) {
      setProfileError(error.message);
    } else {
      setProfileSaved(true);
      setIsEditingProfile(false);
    }
    setIsSavingProfile(false);
  };

  const handleDelete = async () => {
    if (!canDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    const { error } = isOwner
      ? await deleteOwnerAccount()
      : await deleteSuperAccount();

    if (error) {
      setDeleteError(error.message);
      setIsDeleting(false);
      return;
    }

    await signOut();
    history.replace('/login');
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleCopyReferralCode = async () => {
    if (!referralStats?.referral_code) return;
    try {
      await navigator.clipboard.writeText(referralStats.referral_code);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  const handleShareReferral = async () => {
    if (!referralStats?.referral_code) return;
    const text = t('referral.shareText', { code: referralStats.referral_code });

    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ text });
    } else {
      // Web fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(text);
        setReferralCopied(true);
        setTimeout(() => setReferralCopied(false), 2000);
      } catch {
        // Fallback: do nothing
      }
    }
  };

  const handleLanguageChange = async (langCode: string) => {
    await changeLanguage(langCode as Parameters<typeof changeLanguage>[0]);
    setCurrentLang(getCurrentLanguage());
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('settings.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" fullscreen>
        <div className="settings-container">
          <IonSegment
            value={activeTab}
            onIonChange={(e) => setActiveTab(e.detail.value as 'general' | 'more')}
            className="settings-segment"
          >
            <IonSegmentButton value="general">
              <IonLabel>{t('settings.tabGeneral')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="more">
              <IonLabel>{t('settings.tabMore')}</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          {activeTab === 'general' && (<>
          {/* Team Dashboard - Owner only */}
          {isOwner && (
            <div className="section">
              <div className="card legal-card">
                <IonButton
                  fill="clear"
                  expand="block"
                  className="legal-link-btn dashboard-link-btn"
                  routerLink="/dashboard"
                >
                  <IonIcon icon={gridOutline} slot="start" />
                  <div className="dashboard-link-text">
                    <strong>{t('settings.teamDashboard')}</strong>
                    <span>{t('settings.teamDashboardDescription')}</span>
                  </div>
                  <IonIcon icon={chevronForwardOutline} slot="end" />
                </IonButton>
              </div>
            </div>
          )}

          {/* My Plan - Owner only */}
          {isOwner && (
            <div className="section">
              <h3 className="section-title">{t('settings.myPlan')}</h3>
              <div className="card plan-card">
                <div className="plan-row">
                  <span className="profile-label">{t('settings.currentPlan')}</span>
                  <span className={`plan-badge plan-${currentPlan}`}>
                    {currentPlan === PlanType.FREE
                      ? t('paywall.planStart')
                      : currentPlan === PlanType.BASIC
                        ? t('paywall.planPlus')
                        : t('paywall.planPlusRinga')}
                  </span>
                </div>
                <div className="plan-row">
                  <span className="plan-status-text">
                    {isTrialActive
                      ? t('settings.trialActive', { days: trialDaysLeft })
                      : isTrialExpired
                        ? t('settings.trialExpired')
                        : status?.isActive
                          ? t('settings.activePlan')
                          : t('settings.noPlan')}
                  </span>
                </div>
                <IonButton
                  expand="block"
                  size="small"
                  onClick={() => showPaywall()}
                >
                  {status?.isActive && !isTrialActive
                    ? t('settings.changePlan')
                    : t('settings.upgradePlan')}
                </IonButton>
              </div>
            </div>
          )}

          {/* Referral Section - Owner only */}
          {isOwner && referralStats && (
            <div className="section">
              <h3 className="section-title">{t('referral.title')}</h3>
              <div className="card referral-card">
                <div className="referral-code-box">
                  <span className="referral-code-label">{t('referral.yourCode')}</span>
                  <div className="referral-code-row">
                    <span className="referral-code-value">{referralStats.referral_code}</span>
                    <IonButton
                      fill="clear"
                      size="small"
                      onClick={handleCopyReferralCode}
                      className="referral-copy-btn"
                    >
                      <IonIcon icon={copyOutline} />
                    </IonButton>
                  </div>
                  {referralCopied && (
                    <p className="success-text" style={{ margin: '0.25rem 0 0 0' }}>{t('referral.copied')}</p>
                  )}
                </div>

                <IonButton
                  expand="block"
                  size="small"
                  onClick={handleShareReferral}
                >
                  <IonIcon icon={shareSocialOutline} slot="start" />
                  {t('referral.share')}
                </IonButton>

                <div className="referral-stats">
                  <div className="referral-stat-row">
                    <IonIcon icon={peopleOutline} />
                    <span>{t('referral.referredCount', { count: referralStats.total_referred })}</span>
                  </div>
                  {referralStats.rewards_earned > 0 && (
                    <div className="referral-stat-row">
                      <span>{t('referral.rewardsEarned', { count: referralStats.rewards_earned })}</span>
                    </div>
                  )}
                  {referralStats.pending_rewards > 0 && (
                    <div className="referral-stat-row referral-pending">
                      <span>{t('referral.pendingRewards', { count: referralStats.pending_rewards })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SOS - Texter only */}
          {isTexter && (
            <div className="section">
              <SOSButton />
            </div>
          )}

          {/* Profile Section */}
          <div className="section">
            <h3 className="section-title">{t('settings.profile')}</h3>
            <div className="profile-card" data-testid="profile-card">
              <div className="profile-row">
                <span className="profile-label">{t('texter.name')}</span>
                {isEditingProfile ? (
                  <div className="profile-edit-row">
                    <IonInput
                      value={editName}
                      onIonInput={(e) => setEditName(e.detail.value || '')}
                      placeholder={t('auth.yourName')}
                      className="profile-edit-input"
                    />
                    <IonButton
                      fill="clear"
                      size="small"
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                    >
                      {isSavingProfile ? (
                        <IonSpinner name="crescent" />
                      ) : (
                        <IonIcon icon={checkmarkOutline} />
                      )}
                    </IonButton>
                  </div>
                ) : (
                  <div className="profile-value-row">
                    <span className="profile-value">{profile?.display_name || '-'}</span>
                    <IonButton
                      fill="clear"
                      size="small"
                      onClick={() => setIsEditingProfile(true)}
                      className="edit-btn"
                    >
                      <IonIcon icon={createOutline} />
                    </IonButton>
                  </div>
                )}
              </div>
              {profileSaved && (
                <p className="success-text">{t('settings.profileSaved')}</p>
              )}
              {profileError && (
                <p className="error-text">{profileError}</p>
              )}
              <div className="profile-row">
                <span className="profile-label">{t('texter.zemiNumber')}</span>
                <span className="profile-value mono">{profile?.zemi_number}</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">{t('roles.teamOwner')}</span>
                <span className={`role-badge ${profile?.role}`}>
                  {profile?.role === 'owner'
                    ? t('roles.teamOwner')
                    : profile?.role === 'super'
                      ? t('roles.super')
                      : t('roles.texter')}
                </span>
              </div>
            </div>
          </div>

          {/* Wall Visibility - Owner and Super only */}
          {(isOwner || isSuper) && (
            <div className="section">
              <h3 className="section-title">{t('wall.title')}</h3>
              <div className="card wall-toggle-card">
                <div className="wall-toggle-row">
                  <div className="wall-toggle-info">
                    <IonIcon icon={newspaperOutline} className="wall-toggle-icon" />
                    <div>
                      <span className="wall-toggle-label">{t('settings.wallEnabled')}</span>
                      <span className="wall-toggle-desc">{t('settings.wallEnabledDesc')}</span>
                    </div>
                  </div>
                  <IonToggle
                    checked={wallEnabled}
                    onIonChange={(e) => handleWallToggle(e.detail.checked)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Feedback & Support Section */}
          <div className="section">
            <h3 className="section-title">{t('support.title')}</h3>
            <div className="card legal-card">
              <IonButton
                fill="clear"
                expand="block"
                className="legal-link-btn"
                routerLink="/support"
              >
                <IonIcon icon={helpCircleOutline} slot="start" />
                {t('support.settingsButton')}
              </IonButton>
            </div>
          </div>

          {/* Logout Section */}
          <div className="section">
            <IonButton
              expand="block"
              onClick={handleSignOut}
            >
              <IonIcon icon={logOutOutline} slot="start" />
              {t('auth.logout')}
            </IonButton>
          </div>

          </>)}

          {activeTab === 'more' && (<>
          {/* Language Section */}
          <div className="section">
            <h3 className="section-title">{t('settings.language')}</h3>
            <div className="card language-card">
              <div className="language-grid" data-testid="language-grid">
                {supportedLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    className={`language-option ${currentLang === lang.code ? 'active' : ''}`}
                    onClick={() => handleLanguageChange(lang.code)}
                  >
                    <span className="language-flag">{lang.flag}</span>
                    <span className="language-name">{lang.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Export Data Section */}
          <div className="section">
            <h3 className="section-title">{t('settings.exportData')}</h3>
            <div className="card">
              <p className="card-description">{t('settings.exportDataDescription')}</p>
              <IonButton
                expand="block"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <IonSpinner name="crescent" slot="start" />
                    {t('settings.exportDataProgress')}
                  </>
                ) : (
                  <>
                    <IonIcon icon={downloadOutline} slot="start" />
                    {t('settings.exportData')}
                  </>
                )}
              </IonButton>
              {exportSuccess && (
                <p className="success-text">{t('settings.exportDataSuccess')}</p>
              )}
              {exportError && (
                <p className="error-text">{exportError}</p>
              )}
            </div>
          </div>

          {/* Legal Section */}
          <div className="section">
            <h3 className="section-title">{t('settings.legal')}</h3>
            <div className="card legal-card">
              <IonButton
                fill="clear"
                expand="block"
                className="legal-link-btn"
                routerLink="/privacy"
              >
                <IonIcon icon={shieldCheckmarkOutline} slot="start" />
                {t('settings.privacyPolicy')}
              </IonButton>
              <IonButton
                fill="clear"
                expand="block"
                className="legal-link-btn"
                routerLink="/terms"
              >
                <IonIcon icon={documentTextOutline} slot="start" />
                {t('settings.termsOfService')}
              </IonButton>
            </div>
          </div>

          {/* Delete Account - subtle link that expands */}
          <div className="section delete-account-section">
            {!showDeleteSection ? (
              <button
                className="delete-account-link"
                onClick={() => setShowDeleteSection(true)}
              >
                {t('settings.deleteAccount')}
              </button>
            ) : (
              <div className="card danger-card">
                <div className="danger-card-header">
                  <IonIcon icon={warningOutline} className="warning-icon" />
                  <h3 className="danger-card-title">{t('settings.deleteAccount')}</h3>
                </div>

                {isTexter ? (
                  <p className="info-text">
                    {t('settings.deleteAccountTexterMessage')}
                  </p>
                ) : (
                  <>
                    <IonText>
                      <p className="danger-description">
                        {isOwner
                          ? t('settings.deleteAccountDescription', { count: memberCount })
                          : t('settings.deleteAccountSuperDescription')}
                      </p>
                      <p className="danger-warning">
                        {t('settings.deleteAccountWarning')}
                      </p>
                    </IonText>

                    <div className="confirm-input">
                      <label className="confirm-label">
                        {t('settings.deleteAccountConfirmLabel')}
                      </label>
                      <IonInput
                        value={confirmText}
                        onIonInput={(e) => setConfirmText(e.detail.value || '')}
                        placeholder={confirmWord}
                        className="confirm-field"
                        disabled={isDeleting}
                      />
                    </div>

                    <IonButton
                      expand="block"
                      color="danger"
                      onClick={handleDelete}
                      disabled={!canDelete || isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <IonSpinner name="crescent" slot="start" />
                          {t('settings.deleteAccountProgress')}
                        </>
                      ) : (
                        <>
                          <IonIcon icon={trashOutline} slot="start" />
                          {t('settings.deleteAccountButton')}
                        </>
                      )}
                    </IonButton>

                    {deleteError && (
                      <p className="error-text">{deleteError}</p>
                    )}
                  </>
                )}

                <button
                  className="delete-cancel-link"
                  onClick={() => { setShowDeleteSection(false); setConfirmText(''); setDeleteError(null); }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}
          </div>
          </>)}
        </div>

        <style>{`
          .settings-container {
            max-width: 600px;
            margin: 0 auto;
          }

          .settings-segment {
            margin-bottom: 1.5rem;
          }

          .section {
            margin-bottom: 2rem;
          }

          .section-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: hsl(var(--muted-foreground));
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin: 0 0 1rem 0;
          }

          .profile-card, .card {
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 1rem;
            padding: 1rem;
          }

          .profile-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 0;
          }

          .profile-row:not(:last-child) {
            border-bottom: 1px solid hsl(var(--border));
          }

          .profile-label {
            color: hsl(var(--muted-foreground));
            font-size: 0.875rem;
          }

          .profile-value {
            color: hsl(var(--foreground));
            font-weight: 600;
          }

          .profile-value.mono {
            font-family: monospace;
          }

          .profile-value-row {
            display: flex;
            align-items: center;
            gap: 0.25rem;
          }

          .profile-edit-row {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            flex: 1;
            margin-left: 1rem;
          }

          .profile-edit-input {
            --background: hsl(var(--background));
            --border-color: hsl(var(--border));
            --border-radius: 0.5rem;
            --padding-start: 0.5rem;
            border: 1px solid hsl(var(--border));
            border-radius: 0.5rem;
            font-size: 0.875rem;
          }

          .edit-btn {
            --color: hsl(var(--muted-foreground));
            --padding-start: 4px;
            --padding-end: 4px;
          }

          .role-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
          }

          .role-badge.owner {
            background: hsl(var(--primary) / 0.15);
            color: hsl(var(--primary));
          }

          .role-badge.super {
            background: hsl(var(--secondary) / 0.15);
            color: hsl(var(--secondary));
          }

          .role-badge.texter {
            background: hsl(var(--muted) / 0.3);
            color: hsl(var(--muted-foreground));
          }

          .plan-card {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .plan-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .plan-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
          }

          .plan-badge.plan-free {
            background: hsl(var(--muted) / 0.3);
            color: hsl(var(--muted-foreground));
          }

          .plan-badge.plan-basic {
            background: hsl(var(--primary) / 0.15);
            color: hsl(var(--primary));
          }

          .plan-badge.plan-pro {
            background: hsl(var(--secondary) / 0.15);
            color: hsl(var(--secondary));
          }

          .plan-status-text {
            font-size: 0.85rem;
            color: hsl(var(--muted-foreground));
          }

          .dashboard-link-btn {
            --padding-top: 0.75rem;
            --padding-bottom: 0.75rem;
          }

          .dashboard-link-text {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            flex: 1;
            text-align: left;
          }

          .dashboard-link-text strong {
            font-size: 0.95rem;
            color: hsl(var(--foreground));
          }

          .dashboard-link-text span {
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
          }

          .language-card {
            padding: 0.75rem;
          }

          .language-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 0.5rem;
          }

          .language-option {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 0.75rem;
            background: transparent;
            border: 1px solid hsl(var(--border));
            border-radius: 0.75rem;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .language-option.active {
            background: hsl(var(--primary) / 0.1);
            border-color: hsl(var(--primary));
          }

          .language-flag {
            font-size: 1.25rem;
          }

          .language-name {
            font-size: 0.85rem;
            color: hsl(var(--foreground));
            font-weight: 500;
          }

          .wall-toggle-card {
            padding: 0.75rem 1rem;
          }

          .wall-toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
          }

          .wall-toggle-info {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }

          .wall-toggle-icon {
            font-size: 1.25rem;
            color: hsl(var(--primary));
            flex-shrink: 0;
          }

          .wall-toggle-label {
            display: block;
            font-weight: 600;
            font-size: 0.9rem;
            color: hsl(var(--foreground));
          }

          .wall-toggle-desc {
            display: block;
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
          }

          .card-description {
            color: hsl(var(--muted-foreground));
            margin: 0 0 1rem 0;
            font-size: 0.875rem;
          }

          .success-text {
            color: hsl(var(--secondary));
            font-size: 0.875rem;
            margin: 0.75rem 0 0 0;
            text-align: center;
          }

          .error-text {
            color: hsl(var(--destructive));
            font-size: 0.875rem;
            margin: 0.75rem 0 0 0;
            text-align: center;
          }

          .legal-card {
            padding: 0;
            overflow: hidden;
          }

          .legal-link-btn {
            --color: hsl(var(--foreground));
            --padding-start: 1rem;
            justify-content: flex-start;
            text-transform: none;
            font-weight: 500;
            letter-spacing: 0;
            font-size: 0.9rem;
          }

          .legal-link-btn:not(:last-child) {
            border-bottom: 1px solid hsl(var(--border));
          }

          .delete-account-section {
            text-align: center;
            padding-bottom: 2rem;
          }

          .delete-account-link {
            background: none;
            border: none;
            color: hsl(var(--muted-foreground));
            font-size: 0.8rem;
            cursor: pointer;
            padding: 0.5rem 1rem;
            opacity: 0.7;
          }

          .delete-account-link:hover {
            opacity: 1;
            color: hsl(var(--destructive));
          }

          .danger-card {
            border-color: hsl(var(--destructive) / 0.3);
          }

          .danger-card-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 1rem;
          }

          .danger-card-title {
            margin: 0;
            font-size: 1rem;
            font-weight: 700;
            color: hsl(var(--destructive));
          }

          .warning-icon {
            color: hsl(var(--destructive));
            font-size: 1.25rem;
            flex-shrink: 0;
          }

          .danger-description {
            color: hsl(var(--foreground));
            margin: 0 0 0.5rem 0;
            font-size: 0.875rem;
            line-height: 1.5;
          }

          .danger-warning {
            color: hsl(var(--destructive));
            font-weight: 700;
            margin: 0 0 1rem 0;
            font-size: 0.875rem;
          }

          .confirm-input {
            margin-bottom: 1rem;
          }

          .confirm-label {
            display: block;
            font-size: 0.875rem;
            color: hsl(var(--muted-foreground));
            margin-bottom: 0.5rem;
          }

          .confirm-field {
            --background: hsl(var(--background));
            --border-color: hsl(var(--border));
            --border-radius: 0.5rem;
            --padding-start: 0.75rem;
            border: 1px solid hsl(var(--border));
            border-radius: 0.5rem;
          }

          .delete-cancel-link {
            display: block;
            width: 100%;
            background: none;
            border: none;
            color: hsl(var(--muted-foreground));
            font-size: 0.85rem;
            cursor: pointer;
            padding: 0.75rem 0 0.25rem;
            text-align: center;
          }

          .delete-cancel-link:hover {
            color: hsl(var(--foreground));
          }

          .info-text {
            color: hsl(var(--muted-foreground));
            margin: 0;
            font-size: 0.875rem;
            line-height: 1.5;
          }

          .referral-card {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .referral-code-box {
            text-align: center;
            padding: 0.5rem 0;
          }

          .referral-code-label {
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .referral-code-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.25rem;
            margin-top: 0.25rem;
          }

          .referral-code-value {
            font-size: 1.5rem;
            font-weight: 800;
            font-family: monospace;
            color: hsl(var(--primary));
            letter-spacing: 0.05em;
          }

          .referral-copy-btn {
            --color: hsl(var(--muted-foreground));
            --padding-start: 4px;
            --padding-end: 4px;
          }

          .referral-stats {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
            padding-top: 0.5rem;
            border-top: 1px solid hsl(var(--border));
          }

          .referral-stat-row {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.85rem;
            color: hsl(var(--muted-foreground));
          }

          .referral-stat-row ion-icon {
            font-size: 1rem;
          }

          .referral-pending {
            color: hsl(var(--primary));
            font-weight: 500;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
