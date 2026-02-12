import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonSpinner,
  IonCheckbox,
  IonLabel,
  IonIcon,
} from '@ionic/react';
import { warningOutline } from 'ionicons/icons';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { getTeamMembers, pauseMember } from '../../services/members';
import { type User, UserRole } from '../../types/database';
import { PLAN_FEATURES } from '../../types/subscription';
import { PlanType } from '../../types/database';

/**
 * Blocking dialog shown when trial expires and team has more members
 * than the free plan allows (3 including Owner).
 *
 * Owner must select which members to keep (max 2 others).
 * Unselected members get paused.
 */
const MemberLimitDialog: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuthContext();
  const { isTrialExpired, currentPlan, showPaywall } = useSubscription();

  const [members, setMembers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const maxAllowed = PLAN_FEATURES[PlanType.FREE].maxUsers;
  // Owner always counts as 1, so max selectable others = maxAllowed - 1
  const maxOthers = maxAllowed - 1;

  const isOwner = profile?.role === UserRole.OWNER;

  const loadMembers = useCallback(async () => {
    const { members: teamMembers } = await getTeamMembers();
    setMembers(teamMembers);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isTrialExpired && isOwner && currentPlan === PlanType.FREE) {
      loadMembers();
    }
  }, [isTrialExpired, isOwner, currentPlan, loadMembers]);

  // Only show if: trial expired, owner, free plan, and more than max members
  const otherMembers = members.filter((m) => m.id !== profile?.id && !m.is_paused);
  const totalActive = otherMembers.length + 1; // +1 for owner
  const needsReduction = totalActive > maxAllowed;
  const isOpen = isTrialExpired && isOwner && currentPlan === PlanType.FREE && needsReduction && !isLoading;

  const toggleMember = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else if (next.size < maxOthers) {
        next.add(userId);
      }
      return next;
    });
  };

  const handleKeepSelected = async () => {
    setIsProcessing(true);
    // Pause all non-selected members
    const toPause = otherMembers.filter((m) => !selectedIds.has(m.id));
    for (const member of toPause) {
      await pauseMember(member.id);
    }
    // Reload to update state
    await loadMembers();
    setIsProcessing(false);
  };

  const handleUpgrade = () => {
    showPaywall(t('paywall.upgradeToUse'));
  };

  if (!isOpen) return null;

  return (
    <IonModal isOpen={isOpen} canDismiss={false}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('memberLimit.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="member-limit-content">
        <div className="member-limit-container">
          <div className="member-limit-header">
            <IonIcon icon={warningOutline} className="member-limit-icon" />
            <h2>{t('memberLimit.heading')}</h2>
            <p>{t('memberLimit.description', { max: maxAllowed, maxOthers })}</p>
          </div>

          <div className="member-limit-list">
            {/* Owner - always selected, disabled */}
            <div className="member-limit-item owner">
              <IonCheckbox checked disabled />
              <IonLabel>
                <h3>{profile?.display_name || t('roles.owner')}</h3>
                <p>{t('memberLimit.ownerAlwaysIncluded')}</p>
              </IonLabel>
            </div>

            {/* Other members */}
            {otherMembers.map((member) => (
              <div
                key={member.id}
                className={`member-limit-item ${selectedIds.has(member.id) ? 'selected' : ''}`}
                onClick={() => toggleMember(member.id)}
              >
                <IonCheckbox
                  checked={selectedIds.has(member.id)}
                  disabled={!selectedIds.has(member.id) && selectedIds.size >= maxOthers}
                />
                <IonLabel>
                  <h3>{member.display_name || member.zemi_number}</h3>
                  <p>{member.role === UserRole.SUPER ? t('roles.super') : t('roles.texter')}</p>
                </IonLabel>
              </div>
            ))}
          </div>

          <p className="member-limit-hint">
            {t('memberLimit.selectedCount', { count: selectedIds.size, max: maxOthers })}
          </p>

          <IonButton
            expand="block"
            className="member-limit-keep-btn"
            onClick={handleKeepSelected}
            disabled={isProcessing || selectedIds.size === 0}
          >
            {isProcessing ? (
              <IonSpinner name="crescent" />
            ) : (
              t('memberLimit.keepSelected')
            )}
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            onClick={handleUpgrade}
            disabled={isProcessing}
          >
            {t('memberLimit.upgradeInstead')}
          </IonButton>
        </div>

        <style>{`
          .member-limit-content {
            --background: hsl(var(--background));
          }

          .member-limit-container {
            padding: 1.5rem;
            max-width: 500px;
            margin: 0 auto;
          }

          .member-limit-header {
            text-align: center;
            margin-bottom: 1.5rem;
          }

          .member-limit-icon {
            font-size: 3rem;
            color: hsl(var(--destructive));
            margin-bottom: 0.5rem;
          }

          .member-limit-header h2 {
            margin: 0;
            font-size: 1.25rem;
            color: hsl(var(--foreground));
          }

          .member-limit-header p {
            margin: 0.5rem 0 0;
            color: hsl(var(--muted-foreground));
            font-size: 0.875rem;
          }

          .member-limit-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin-bottom: 1rem;
          }

          .member-limit-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
            background: hsl(var(--card));
            border: 2px solid hsl(var(--border));
            border-radius: 0.75rem;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .member-limit-item.owner {
            cursor: default;
            opacity: 0.7;
          }

          .member-limit-item.selected {
            border-color: hsl(var(--primary));
            background: hsl(var(--primary) / 0.05);
          }

          .member-limit-item h3 {
            margin: 0;
            font-size: 0.95rem;
            color: hsl(var(--foreground));
          }

          .member-limit-item p {
            margin: 0;
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
          }

          .member-limit-hint {
            text-align: center;
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
            margin: 0 0 1rem 0;
          }

          .member-limit-keep-btn {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            margin-bottom: 0.5rem;
          }
        `}</style>
      </IonContent>
    </IonModal>
  );
};

export default MemberLimitDialog;
