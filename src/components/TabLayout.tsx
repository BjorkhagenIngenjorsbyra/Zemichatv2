import { Redirect, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonBadge,
  IonRouterOutlet,
} from '@ionic/react';
import { chatbubblesOutline, newspaperOutline, peopleOutline, settingsOutline } from 'ionicons/icons';
import { useNotifications } from '../contexts/NotificationContext';
import ChatList from '../pages/ChatList';
import Wall from '../pages/Wall';
import Friends from '../pages/Friends';
import Settings from '../pages/Settings';

const TabLayout: React.FC = () => {
  const { t } = useTranslation();
  const { unreadChatCount, pendingFriendRequests, hasNewWallPosts } = useNotifications();

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/chats" component={ChatList} />
        <Route exact path="/wall" component={Wall} />
        <Route exact path="/friends" component={Friends} />
        <Route exact path="/settings" component={Settings} />
        <Redirect exact from="/" to="/chats" />
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        <IonTabButton tab="chats" href="/chats">
          <IonIcon icon={chatbubblesOutline} />
          <IonLabel>{t('dashboard.chats')}</IonLabel>
          {unreadChatCount > 0 && (
            <IonBadge color="danger">{unreadChatCount}</IonBadge>
          )}
        </IonTabButton>
        <IonTabButton tab="wall" href="/wall">
          <IonIcon icon={newspaperOutline} />
          <IonLabel>{t('wall.title')}</IonLabel>
          {hasNewWallPosts && (
            <IonBadge color="danger" className="dot-badge" />
          )}
        </IonTabButton>
        <IonTabButton tab="friends" href="/friends">
          <IonIcon icon={peopleOutline} />
          <IonLabel>{t('friends.title')}</IonLabel>
          {pendingFriendRequests > 0 && (
            <IonBadge color="danger">{pendingFriendRequests}</IonBadge>
          )}
        </IonTabButton>
        <IonTabButton tab="settings" href="/settings">
          <IonIcon icon={settingsOutline} />
          <IonLabel>{t('settings.title')}</IonLabel>
        </IonTabButton>
      </IonTabBar>

      <style>{`
        .dot-badge {
          width: 8px;
          height: 8px;
          min-width: 8px;
          border-radius: 50%;
          --padding-start: 0;
          --padding-end: 0;
        }
      `}</style>
    </IonTabs>
  );
};

export default TabLayout;
