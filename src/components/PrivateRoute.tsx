import { ReactNode } from 'react';
import { Redirect, Route, RouteProps } from 'react-router-dom';
import { IonSpinner } from '@ionic/react';
import { useAuthContext } from '../contexts/AuthContext';

interface PrivateRouteProps extends Omit<RouteProps, 'children'> {
  children: ReactNode;
  requireProfile?: boolean;
}

const LoadingSpinner: React.FC = () => (
  <div className="loading-container">
    <IonSpinner name="crescent" />
    <style>{`
      .loading-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background: hsl(var(--background));
      }
    `}</style>
  </div>
);

/**
 * Route guard that redirects unauthenticated users to login.
 * If requireProfile is true, also checks that user has completed profile setup.
 */
export const PrivateRoute: React.FC<PrivateRouteProps> = ({
  children,
  requireProfile = true,
  ...rest
}) => {
  const { isLoading, isAuthenticated, hasProfile } = useAuthContext();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // Authenticated but no profile - redirect to create team
  if (requireProfile && !hasProfile) {
    return <Redirect to="/create-team" />;
  }

  return <Route {...rest}>{children}</Route>;
};

interface PublicRouteProps extends Omit<RouteProps, 'children'> {
  children: ReactNode;
}

/**
 * Route guard that redirects authenticated users away from auth pages.
 */
export const PublicRoute: React.FC<PublicRouteProps> = ({ children, ...rest }) => {
  const { isLoading, isAuthenticated, hasProfile } = useAuthContext();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Authenticated with profile - redirect to chats
  if (isAuthenticated && hasProfile) {
    return <Redirect to="/chats" />;
  }

  // Authenticated without profile - let them stay on public pages.
  // They will reach /create-team via PrivateRoute after explicit login.

  return <Route {...rest}>{children}</Route>;
};
