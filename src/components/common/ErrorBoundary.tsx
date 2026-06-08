import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../../i18n';
import { captureException } from '../../services/sentry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches uncaught render errors so a single broken page never blanks the whole
 * app to the bootstrap fallback. Shows a recoverable, localised error screen
 * with retry / go-home actions and reports the error to Sentry.
 *
 * Uses the i18n instance directly (not the hook) because this is a class
 * component and must keep working even if a child threw mid-render.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureException(error, { componentStack: info.componentStack });
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  private handleHome = (): void => {
    // Hard navigation resets all in-memory state — safest recovery path.
    window.location.assign('/');
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const t = (key: string, fallback: string): string => {
      try {
        return i18n.t(key, fallback) as string;
      } catch {
        return fallback;
      }
    };

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '1.5rem',
          textAlign: 'center',
          fontFamily: '-apple-system, system-ui, sans-serif',
          color: '#0a0d17',
          background: '#fff',
          gap: '0.75rem',
        }}
      >
        <h2 style={{ margin: 0 }}>ZemiChat</h2>
        <p style={{ margin: 0, color: '#666', maxWidth: '22rem' }}>
          {t('errors.boundaryMessage', 'Något gick fel. Försök igen.')}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: '0.6rem',
              border: 'none',
              background: '#0E6272',
              color: '#fff',
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            {t('errors.boundaryRetry', 'Försök igen')}
          </button>
          <button
            onClick={this.handleHome}
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: '0.6rem',
              border: '1px solid #ccc',
              background: '#fff',
              color: '#0a0d17',
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            {t('errors.boundaryHome', 'Till startsidan')}
          </button>
        </div>
      </div>
    );
  }
}
