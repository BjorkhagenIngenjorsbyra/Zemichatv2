import { useState, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
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
} from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';
import {
  searchUserByZemiNumber,
  sendFriendRequest,
  getFriendshipStatus,
} from '../services/friend';
import { ZemiNumberInput, isValidZemiNumber } from '../components/friends';
import { type User } from '../types/database';

const AddFriend: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { profile } = useAuthContext();
  const [zemiNumber, setZemiNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchResult, setSearchResult] = useState<User | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<
    'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted' | 'denied'
  >('none');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    setSuccessMessage(null);

    const { user, error: searchError } = await searchUserByZemiNumber(zemiNumber);

    if (searchError) {
      setError(searchError.message);
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
    const { status } = await getFriendshipStatus(user.id);
    setFriendshipStatus(status);

    setIsSearching(false);
  }, [zemiNumber, profile?.zemi_number, t]);

  const handleSendRequest = async () => {
    if (!searchResult) return;

    setIsSending(true);
    setError(null);
    setSuccessMessage(null);

    const { error: sendError } = await sendFriendRequest(searchResult.id);

    if (sendError) {
      setError(sendError.message);
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
                    />
                  ) : (
                    <div className="avatar-placeholder">
                      {searchResult.display_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                </IonAvatar>

                <div className="result-info">
                  <h3 className="result-name">
                    {searchResult.display_name || t('dashboard.unnamed')}
                  </h3>
                  <p className="result-zemi">{searchResult.zemi_number}</p>
                </div>

                {statusDisplay ? (
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
