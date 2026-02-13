import { Redirect, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
} from '@ionic/react';
import { chatbubblesOutline, newspaperOutline, peopleOutline, settingsOutline } from 'ionicons/icons';
import ChatList from '../pages/ChatList';
import Wall from '../pages/Wall';
import Friends from '../pages/Friends';
import Settings from '../pages/Settings';

const TabLayout: React.FC = () => {
  const { t } = useTranslation();

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
        </IonTabButton>
        <IonTabButton tab="wall" href="/wall">
          <IonIcon icon={newspaperOutline} />
          <IonLabel>{t('wall.title')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="friends" href="/friends">
          <IonIcon icon={peopleOutline} />
          <IonLabel>{t('friends.title')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="settings" href="/settings">
          <IonIcon icon={settingsOutline} />
          <IonLabel>{t('settings.title')}</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

export default TabLayout;
