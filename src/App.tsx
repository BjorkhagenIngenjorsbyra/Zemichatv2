import { useEffect } from 'react';
import { Redirect, Route, Switch, useHistory } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

/* Auth */
import { AuthProvider } from './contexts/AuthContext';
import { useAuthContext } from './contexts/AuthContext';
import { CallProvider } from './contexts/CallContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { PrivateRoute, PublicRoute } from './components/PrivateRoute';

/* Push */
import { setNavigationHandler } from './services/push';

/* Call */
import { IncomingCallModal, CallView, CallPiP } from './components/call';

/* Network */
import { OfflineBanner, TrialBanner } from './components/common';

/* Subscription */
import { Paywall } from './components/subscription';

/* Tab layout */
import TabLayout from './components/TabLayout';

/* Pages */
import Login from './pages/Login';
import TexterLogin from './pages/TexterLogin';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import EmailConfirmed from './pages/EmailConfirmed';
import CreateTeam from './pages/CreateTeam';
import ChoosePlan from './pages/ChoosePlan';
import Dashboard from './pages/Dashboard';
import TexterDetail from './pages/TexterDetail';
import OwnerOversight from './pages/OwnerOversight';
import OwnerChatView from './pages/OwnerChatView';
import NewChat from './pages/NewChat';
import ChatView from './pages/ChatView';
import AddFriend from './pages/AddFriend';
import OwnerApprovals from './pages/OwnerApprovals';
import MFASetup from './pages/MFASetup';
import MFAVerify from './pages/MFAVerify';
import Support from './pages/Support';

/* Welcome & Onboarding */
import Welcome from './pages/Welcome';
import SuperInvite from './pages/SuperInvite';
import SuperTour from './pages/SuperTour';
import TexterTour from './pages/TexterTour';
import InviteSuper from './pages/InviteSuper';

/* Legal */
import LegalPage from './pages/LegalPage';

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

/**
 * Detects Supabase auth callback hash fragments (email verification, password reset)
 * and redirects to the appropriate confirmation page.
 */
const AuthCallbackHandler: React.FC = () => {
  const history = useHistory();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=signup')) {
      // Email verification callback — clear the hash and show confirmation
      window.location.hash = '';
      history.replace('/email-confirmed');
    }
  }, [history]);

  return null;
};

/**
 * Registers push notification navigation handler and initializes
 * push once the user is authenticated with a profile.
 */
const PushInit: React.FC = () => {
  const history = useHistory();
  const { isAuthenticated, hasProfile, initializePush } = useAuthContext();

  useEffect(() => {
    setNavigationHandler((chatId) => {
      history.push(`/chat/${chatId}`);
    });
  }, [history]);

  useEffect(() => {
    if (isAuthenticated && hasProfile) {
      initializePush();
    }
  }, [isAuthenticated, hasProfile, initializePush]);

  return null;
};

const App: React.FC = () => (
  <IonApp>
    <AuthProvider>
      <SubscriptionProvider>
        <CallProvider>
          <IonReactRouter>
          <AuthCallbackHandler />
          <PushInit />
          <IonRouterOutlet>
            <Switch>
            {/* Public routes - redirect to chats if authenticated */}
            <PublicRoute exact path="/welcome">
              <Welcome />
            </PublicRoute>
            <PublicRoute exact path="/invite/:token">
              <SuperInvite />
            </PublicRoute>
            <PublicRoute exact path="/login">
              <Login />
            </PublicRoute>
            <PublicRoute exact path="/texter-login">
              <TexterLogin />
            </PublicRoute>
            <PublicRoute exact path="/signup">
              <Signup />
            </PublicRoute>
            <PublicRoute exact path="/verify-email">
              <VerifyEmail />
            </PublicRoute>
            <Route exact path="/email-confirmed">
              <EmailConfirmed />
            </Route>

            {/* Semi-protected routes - needs auth but not profile */}
            <PrivateRoute exact path="/create-team" requireProfile={false}>
              <CreateTeam />
            </PrivateRoute>
            <PrivateRoute exact path="/choose-plan">
              <ChoosePlan />
            </PrivateRoute>
            <PrivateRoute exact path="/mfa-verify" requireProfile={false}>
              <MFAVerify />
            </PrivateRoute>

            {/* Onboarding tours - need auth and profile */}
            <PrivateRoute exact path="/super-tour">
              <SuperTour />
            </PrivateRoute>
            <PrivateRoute exact path="/texter-tour">
              <TexterTour />
            </PrivateRoute>

            {/* Tab pages - main navigation with bottom tab bar */}
            <PrivateRoute path="/chats">
              <TabLayout />
            </PrivateRoute>
            <PrivateRoute path="/friends">
              <TabLayout />
            </PrivateRoute>
            <PrivateRoute path="/settings">
              <TabLayout />
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
            <PrivateRoute exact path="/new-chat">
              <NewChat />
            </PrivateRoute>
            <PrivateRoute exact path="/chat/:chatId">
              <ChatView />
            </PrivateRoute>
            <PrivateRoute exact path="/add-friend">
              <AddFriend />
            </PrivateRoute>
            <PrivateRoute exact path="/owner-approvals">
              <OwnerApprovals />
            </PrivateRoute>
            <PrivateRoute exact path="/mfa-setup">
              <MFASetup />
            </PrivateRoute>
            <PrivateRoute exact path="/invite-super">
              <InviteSuper />
            </PrivateRoute>
            <PrivateRoute exact path="/support">
              <Support />
            </PrivateRoute>

            {/* Legal pages - accessible regardless of auth state */}
            <Route exact path="/privacy">
              <LegalPage type="privacy" />
            </Route>
            <Route exact path="/terms">
              <LegalPage type="terms" />
            </Route>

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

          {/* Global call overlays */}
          <IncomingCallModal />
          <CallView />
          <CallPiP />

          {/* Subscription paywall */}
          <Paywall />

          {/* Network status */}
          <OfflineBanner />

          {/* Trial countdown */}
          <TrialBanner />
        </IonReactRouter>
      </CallProvider>
    </SubscriptionProvider>
  </AuthProvider>
</IonApp>
);

export default App;
