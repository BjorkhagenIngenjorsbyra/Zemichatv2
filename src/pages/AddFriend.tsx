import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonSpinner,
  IonIcon,
  IonAvatar,
  IonText,
  IonBadge,
} from '@ionic/react';
import {
  searchOutline,
  personAddOutline,
  checkmarkCircleOutline,
  timeOutline,
  closeCircleOutline,
  copyOutline,
  checkmarkOutline,
} from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';
import {
  searchUserByZemiNumber,
  sendFriendRequest,
  getFriendshipStatus,
  acceptFriendRequest,
} from '../services/friend';
import { ZemiNumberInput, isValidZemiNumber } from '../components/friends';
import { getAvatarColor, getInitial } from '../utils/userDisplay';
import { type User, UserRole } from '../types/database';

const AddFriend: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuthContext();
  const [zemiNumber, setZemiNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchResult, setSearchResult] = useState<User | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<
    'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted' | 'denied'
  >('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  // Texters' friend requests are gated by Owner approval, so they must not
  // accept directly here — mirror the Friends page (onAccept disabled for Texter).
  const canAccept = profile?.role !== UserRole.TEXTER;
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  const handleCopyOwnNumber = useCallback(async () => {
    if (!profile?.zemi_number) return;
    try {
      await navigator.clipboard.writeText(profile.zemi_number);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context) — fail silently.
    }
  }, [profile?.zemi_number]);

  const handleSearch = useCallback(async () => {
    if (!isValidZemiNumber(zemiNumber)) {
      setError(t('friends.invalidZemiNumber'));
      return;
    }

    // Don't allow searching for self
    if (zemiNumber.toUpperCase() === profile?.zemi_number?.toUpperCase()) {
      setError(t('friends.cannotAddSelf'));
      return;
    }

    setIsSearching(true);
    setError(null);
    setSearchResult(null);
    setFriendshipStatus('none');
    setFriendshipId(null);
    setSuccessMessage(null);

    const { user, error: searchError } = await searchUserByZemiNumber(zemiNumber);

    if (searchError) {
      // Don't render raw server/PostgREST text (untranslated, can leak RLS
      // internals) — log it, show a generic message.
      console.error('User search failed:', searchError);
      setError(t('errors.generic'));
      setIsSearching(false);
      return;
    }

    if (!user) {
      setError(t('friends.userNotFound'));
      setIsSearching(false);
      return;
    }

    setSearchResult(user);

    // Check existing friendship status
    const { status, friendship } = await getFriendshipStatus(user.id);
    setFriendshipStatus(status);
    setFriendshipId(friendship?.id ?? null);

    setIsSearching(false);
  }, [zemiNumber, profile?.zemi_number, t]);

  const handleAcceptIncoming = async () => {
    if (!friendshipId) return;

    setIsSending(true);
    setError(null);
    setSuccessMessage(null);

    const { error: acceptError } = await acceptFriendRequest(friendshipId);

    if (acceptError) {
      console.error('Accept friend request failed:', acceptError);
      setError(t('errors.generic'));
      setIsSending(false);
      return;
    }

    setFriendshipStatus('accepted');
    setSuccessMessage(t('friends.requestSentSuccess'));
    setIsSending(false);
  };

  const handleSendRequest = async () => {
    if (!searchResult) return;

    setIsSending(true);
    setError(null);
    setSuccessMessage(null);

    const { error: sendError } = await sendFriendRequest(searchResult.id);

    if (sendError) {
      console.error('Send friend request failed:', sendError);
      setError(t('errors.generic'));
      setIsSending(false);
      return;
    }

    setFriendshipStatus('pending_outgoing');
    setSuccessMessage(t('friends.requestSentSuccess'));
    setIsSending(false);
  };

  const getStatusDisplay = () => {
    switch (friendshipStatus) {
      case 'accepted':
        return {
          icon: checkmarkCircleOutline,
          text: t('friends.alreadyFriends'),
          color: 'success',
        };
      case 'pending_outgoing':
        return {
          icon: timeOutline,
          text: t('friends.requestSent'),
          color: 'warning',
        };
      case 'pending_incoming':
        return {
          icon: timeOutline,
          text: t('friends.requestReceived'),
          color: 'primary',
        };
      case 'denied':
        return {
          icon: closeCircleOutline,
          text: t('friends.requestDenied'),
          color: 'danger',
        };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/friends" />
          </IonButtons>
          <IonTitle>{t('friends.addFriend')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" fullscreen>
        <div className="add-friend-container">
          {profile?.zemi_number && (
            <div className="own-number-card">
              <div className="own-number-info">
                <span className="own-number-label">{t('friends.yourZemiNumber')}</span>
                <span className="own-number-value">{profile.zemi_number}</span>
                <span className="own-number-hint">{t('friends.yourZemiNumberHint')}</span>
              </div>
              <IonButton
                fill="clear"
                size="small"
                onClick={handleCopyOwnNumber}
                aria-label={t('friends.copyZemiNumber')}
                className="own-number-copy"
              >
                <IonIcon slot="icon-only" icon={copied ? checkmarkOutline : copyOutline} />
              </IonButton>
            </div>
          )}

          <div className="search-section">
            <h2 className="section-title">{t('friends.enterZemiNumber')}</h2>
            <p className="section-description">{t('friends.searchDescription')}</p>

            <div className="search-input-wrapper">
              <ZemiNumberInput
                value={zemiNumber}
                onChange={setZemiNumber}
                onSubmit={handleSearch}
                disabled={isSearching}
              />
            </div>

            <IonButton
              expand="block"
              onClick={handleSearch}
              disabled={!isValidZemiNumber(zemiNumber) || isSearching}
              className="search-button"
            >
              {isSearching ? (
                <IonSpinner name="crescent" />
              ) : (
                <>
                  <IonIcon icon={searchOutline} slot="start" />
                  {t('friends.search')}
                </>
              )}
            </IonButton>
          </div>

          {error && (
            <div className="error-message">
              <IonText color="danger">{error}</IonText>
            </div>
          )}

          {successMessage && (
            <div className="success-message">
              <IonText color="success">{successMessage}</IonText>
            </div>
          )}

          {searchResult && (
            <div className="result-section">
              <div className="result-card">
                <IonAvatar className="result-avatar">
                  {searchResult.avatar_url ? (
                    <img
                      src={searchResult.avatar_url}
                      alt={searchResult.display_name || ''}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div
                      className="avatar-placeholder"
                      style={{ background: getAvatarColor(searchResult) }}
                    >
                      {getInitial(searchResult)}
                    </div>
                  )}
                </IonAvatar>

                <div className="result-info">
                  <h3 className="result-name">
                    {searchResult.display_name || t('dashboard.unnamed')}
                  </h3>
                  <p className="result-zemi">{searchResult.zemi_number}</p>
                </div>

                {friendshipStatus === 'pending_incoming' && canAccept && friendshipId ? (
                  <IonButton
                    onClick={handleAcceptIncoming}
                    disabled={isSending}
                    className="send-request-button"
                    color="success"
                  >
                    {isSending ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      <>
                        <IonIcon icon={checkmarkOutline} slot="start" />
                        {t('a11y.acceptFriendRequest')}
                      </>
                    )}
                  </IonButton>
                ) : statusDisplay ? (
                  <div className="status-display">
                    <IonBadge color={statusDisplay.color}>
                      <IonIcon icon={statusDisplay.icon} />
                      <span>{statusDisplay.text}</span>
                    </IonBadge>
                  </div>
                ) : (
                  <IonButton
                    onClick={handleSendRequest}
                    disabled={isSending}
                    className="send-request-button"
                  >
                    {isSending ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      <>
                        <IonIcon icon={personAddOutline} slot="start" />
                        {t('friends.sendRequest')}
                      </>
                    )}
                  </IonButton>
                )}
              </div>
            </div>
          )}
        </div>

        <style>{`
          .add-friend-container {
            max-width: 500px;
            margin: 0 auto;
          }

          .own-number-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
            background: hsl(var(--muted) / 0.4);
            border: 1px solid hsl(var(--border));
            border-radius: 1rem;
            padding: 1rem 1.25rem;
            margin: 0.5rem 0 0;
          }

          .own-number-info {
            display: flex;
            flex-direction: column;
            gap: 0.15rem;
          }

          .own-number-label {
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .own-number-value {
            font-family: monospace;
            font-size: 1.1rem;
            font-weight: 700;
            color: hsl(var(--foreground));
          }

          .own-number-hint {
            font-size: 0.8rem;
            color: hsl(var(--muted-foreground));
          }

          .own-number-copy {
            --color: hsl(var(--primary));
            flex-shrink: 0;
          }

          .search-section {
            padding: 1rem 0 2rem;
          }

          .section-title {
            font-size: 1.25rem;
            font-weight: 700;
            color: hsl(var(--foreground));
            margin: 0 0 0.5rem 0;
            text-align: center;
          }

          .section-description {
            font-size: 0.9rem;
            color: hsl(var(--muted-foreground));
            text-align: center;
            margin: 0 0 1.5rem 0;
          }

          .search-input-wrapper {
            margin-bottom: 1rem;
          }

          .search-button {
            --border-radius: 1rem;
            font-weight: 600;
          }

          .error-message,
          .success-message {
            text-align: center;
            padding: 1rem;
            margin-bottom: 1rem;
          }

          .result-section {
            margin-top: 1rem;
          }

          .result-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1rem;
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 1.5rem;
            padding: 2rem;
          }

          .result-avatar {
            width: 80px;
            height: 80px;
          }

          .avatar-placeholder {
            width: 100%;
            height: 100%;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            font-weight: 700;
            border-radius: 50%;
          }

          .result-info {
            text-align: center;
          }

          .result-name {
            font-size: 1.25rem;
            font-weight: 700;
            color: hsl(var(--foreground));
            margin: 0 0 0.25rem 0;
          }

          .result-zemi {
            font-family: monospace;
            font-size: 0.9rem;
            color: hsl(var(--muted-foreground));
            margin: 0;
          }

          .status-display ion-badge {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            font-size: 0.9rem;
          }

          .send-request-button {
            --border-radius: 9999px;
            font-weight: 600;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default AddFriend;
