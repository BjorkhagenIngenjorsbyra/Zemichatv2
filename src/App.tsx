import { Redirect, Route, Switch } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

/* Auth */
import { AuthProvider } from './contexts/AuthContext';
import { PrivateRoute, PublicRoute } from './components/PrivateRoute';

/* Pages */
import Login from './pages/Login';
import TexterLogin from './pages/TexterLogin';
import Signup from './pages/Signup';
import CreateTeam from './pages/CreateTeam';
import Dashboard from './pages/Dashboard';
import TexterDetail from './pages/TexterDetail';
import OwnerOversight from './pages/OwnerOversight';
import OwnerChatView from './pages/OwnerChatView';
import ChatList from './pages/ChatList';
import NewChat from './pages/NewChat';
import ChatView from './pages/ChatView';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <AuthProvider>
      <IonReactRouter>
        <IonRouterOutlet>
          <Switch>
            {/* Public routes - redirect to dashboard if authenticated */}
            <PublicRoute exact path="/login">
              <Login />
            </PublicRoute>
            <PublicRoute exact path="/texter-login">
              <TexterLogin />
            </PublicRoute>
            <PublicRoute exact path="/signup">
              <Signup />
            </PublicRoute>

            {/* Semi-protected route - needs auth but not profile */}
            <PrivateRoute exact path="/create-team" requireProfile={false}>
              <CreateTeam />
            </PrivateRoute>

            {/* Protected routes - need auth and profile */}
            <PrivateRoute exact path="/dashboard">
              <Dashboard />
            </PrivateRoute>
            <PrivateRoute exact path="/texter/:userId">
              <TexterDetail />
            </PrivateRoute>
            <PrivateRoute exact path="/oversight">
              <OwnerOversight />
            </PrivateRoute>
            <PrivateRoute exact path="/oversight/chat/:chatId">
              <OwnerChatView />
            </PrivateRoute>
            <PrivateRoute exact path="/chats">
              <ChatList />
            </PrivateRoute>
            <PrivateRoute exact path="/new-chat">
              <NewChat />
            </PrivateRoute>
            <PrivateRoute exact path="/chat/:chatId">
              <ChatView />
            </PrivateRoute>

            {/* Default redirect */}
            <Route exact path="/">
              <Redirect to="/login" />
            </Route>

            {/* Catch-all redirect */}
            <Route>
              <Redirect to="/login" />
            </Route>
          </Switch>
        </IonRouterOutlet>
      </IonReactRouter>
    </AuthProvider>
  </IonApp>
);

export default App;
