import { useState, useEffect, useCallback } from 'react';
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
import { chatbubblesOutline, newspaperOutline, peopleOutline, settingsOutline, callOutline } from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useNotifications } from '../contexts/NotificationContext';
import { UserRole } from '../types/database';
import { supabase } from '../services/supabase';
import ChatList from '../pages/ChatList';
import Wall from '../pages/Wall';
import Friends from '../pages/Friends';
import Calls from '../pages/Calls';
import Settings from '../pages/Settings';

const TabLayout: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuthContext();
  const { canUseFeature } = useSubscription();
  const { unreadChatCount, pendingFriendRequests, hasNewWallPosts } = useNotifications();
  const [wallVisible, setWallVisible] = useState(true);
  const callsVisible = canUseFeature('canVoiceCall');

  const checkWallAccess = useCallback(async () => {
    if (!profile) return;

    if (profile.role === UserRole.TEXTER) {
      // Texter: check texter_settings.can_access_wall
      const { data } = await supabase
        .from('texter_settings')
        .select('can_access_wall')
        .eq('user_id', profile.id)
        .maybeSingle();

      const typed = data as unknown as { can_access_wall: boolean } | null;
      setWallVisible(typed?.can_access_wall ?? true);
    } else {
      // Owner/Super: check own wall_enabled
      setWallVisible(profile.wall_enabled ?? true);
    }
  }, [profile]);

  useEffect(() => {
    checkWallAccess();
  }, [checkWallAccess]);

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/chats" component={ChatList} />
        <Route exact path="/wall" component={Wall} />
        <Route exact path="/friends" component={Friends} />
        <Route exact path="/calls" component={Calls} />
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
        {wallVisible && (
          <IonTabButton tab="wall" href="/wall">
            <IonIcon icon={newspaperOutline} />
            <IonLabel>{t('wall.title')}</IonLabel>
            {hasNewWallPosts && (
              <IonBadge color="danger" className="dot-badge" />
            )}
          </IonTabButton>
        )}
        <IonTabButton tab="friends" href="/friends">
          <IonIcon icon={peopleOutline} />
          <IonLabel>{t('friends.title')}</IonLabel>
          {pendingFriendRequests > 0 && (
            <IonBadge color="danger">{pendingFriendRequests}</IonBadge>
          )}
        </IonTabButton>
        {callsVisible && (
          <IonTabButton tab="calls" href="/calls">
            <IonIcon icon={callOutline} />
            <IonLabel>{t('calls.title')}</IonLabel>
          </IonTabButton>
        )}
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
