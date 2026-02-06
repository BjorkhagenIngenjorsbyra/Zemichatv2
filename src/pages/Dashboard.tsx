import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonText,
} from '@ionic/react';
import { logOutOutline, peopleOutline, chatbubblesOutline, settingsOutline } from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { profile, signOut } = useAuthContext();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Zemichat</IonTitle>
          <IonButton slot="end" fill="clear" onClick={handleSignOut}>
            <IonIcon icon={logOutOutline} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" fullscreen>
        <div className="dashboard-container">
          {/* Profile Card */}
          <div className="profile-card">
            <IonAvatar className="profile-avatar">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.display_name || 'Avatar'} />
              ) : (
                <div className="avatar-placeholder">
                  {profile?.display_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
            </IonAvatar>
            <div className="profile-info">
              <h2 className="profile-name">{profile?.display_name || 'Anvandare'}</h2>
              <p className="profile-zemi">{profile?.zemi_number}</p>
              <span className="role-badge owner">Team Owner</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="section">
            <h3 className="section-title">Snabbval</h3>
            <IonList className="action-list">
              <IonItem button detail className="action-item">
                <IonIcon icon={chatbubblesOutline} slot="start" className="action-icon" />
                <IonLabel>
                  <h3>Chattar</h3>
                  <p>Starta en konversation</p>
                </IonLabel>
              </IonItem>
              <IonItem button detail className="action-item">
                <IonIcon icon={peopleOutline} slot="start" className="action-icon" />
                <IonLabel>
                  <h3>Bjud in familjemedlem</h3>
                  <p>Lagg till Super eller Texter</p>
                </IonLabel>
              </IonItem>
              <IonItem button detail className="action-item">
                <IonIcon icon={settingsOutline} slot="start" className="action-icon" />
                <IonLabel>
                  <h3>Installningar</h3>
                  <p>Hantera team och profil</p>
                </IonLabel>
              </IonItem>
            </IonList>
          </div>

          {/* Team Members Placeholder */}
          <div className="section">
            <h3 className="section-title">Ditt team</h3>
            <div className="empty-state">
              <IonIcon icon={peopleOutline} className="empty-icon" />
              <IonText>
                <p>Du har inte bjudit in nagra medlemmar an.</p>
              </IonText>
              <IonButton className="invite-button glow-primary">
                Bjud in forsta medlemmen
              </IonButton>
            </div>
          </div>
        </div>

        <style>{`
          .dashboard-container {
            max-width: 600px;
            margin: 0 auto;
          }

          .profile-card {
            display: flex;
            align-items: center;
            gap: 1rem;
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 1.5rem;
            padding: 1.5rem;
            margin-bottom: 2rem;
          }

          .profile-avatar {
            width: 64px;
            height: 64px;
            flex-shrink: 0;
          }

          .avatar-placeholder {
            width: 100%;
            height: 100%;
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            font-weight: 700;
            border-radius: 50%;
          }

          .profile-info {
            flex: 1;
          }

          .profile-name {
            margin: 0 0 0.25rem 0;
            font-size: 1.25rem;
            font-weight: 700;
            color: hsl(var(--foreground));
          }

          .profile-zemi {
            margin: 0 0 0.5rem 0;
            font-size: 0.875rem;
            color: hsl(var(--muted-foreground));
            font-family: monospace;
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

          .action-list {
            background: hsl(var(--card));
            border-radius: 1rem;
            overflow: hidden;
            padding: 0;
          }

          .action-item {
            --background: transparent;
            --border-color: hsl(var(--border));
            --padding-start: 1rem;
            --padding-end: 1rem;
            --inner-padding-end: 0;
          }

          .action-item::part(native) {
            padding-top: 0.75rem;
            padding-bottom: 0.75rem;
          }

          .action-icon {
            color: hsl(var(--primary));
            font-size: 1.5rem;
          }

          .action-item h3 {
            font-weight: 600;
            color: hsl(var(--foreground));
          }

          .action-item p {
            color: hsl(var(--muted-foreground));
            font-size: 0.875rem;
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 2rem;
            background: hsl(var(--card));
            border: 1px dashed hsl(var(--border));
            border-radius: 1rem;
          }

          .empty-icon {
            font-size: 3rem;
            color: hsl(var(--muted));
            margin-bottom: 1rem;
          }

          .empty-state p {
            color: hsl(var(--muted-foreground));
            margin: 0 0 1rem 0;
          }

          .invite-button {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            --border-radius: 9999px;
            font-weight: 700;
          }
        `}</style>
      </IonContent>
    </IonPage>
  );
};

export default Dashboard;
