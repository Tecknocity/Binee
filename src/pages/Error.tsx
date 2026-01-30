import React from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../styles/theme';
import { Home, RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorPageProps {
  title?: string;
  message?: string;
  showTryAgain?: boolean;
}

const Error: React.FC<ErrorPageProps> = ({
  title = 'Something Went Wrong',
  message = "We're sorry, but something unexpected happened. Please try again or return to the dashboard.",
  showTryAgain = true,
}) => {
  const buttonStyle: React.CSSProperties = {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    background: theme.colors.gradient,
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: `all ${theme.transitions.normal}`,
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    textDecoration: 'none',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: 'transparent',
    border: `1px solid ${theme.colors.mutedBorder}`,
    color: theme.colors.textSecondary,
  };

  const handleTryAgain = () => {
    window.location.reload();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.colors.bg,
        color: theme.colors.text,
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing['3xl'],
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '500px' }}>
        {/* Error Icon */}
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: theme.borderRadius.full,
            background: theme.colors.dangerLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            marginBottom: theme.spacing['2xl'],
          }}
        >
          <AlertTriangle size={48} color={theme.colors.danger} />
        </div>

        {/* Error Text */}
        <h1
          style={{
            fontSize: theme.fontSize['3xl'],
            fontWeight: theme.fontWeight.bold,
            marginBottom: theme.spacing.lg,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: theme.fontSize.lg,
            color: theme.colors.textSecondary,
            marginBottom: theme.spacing['2xl'],
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>

        {/* Error Details Box */}
        <div
          style={{
            background: theme.colors.dark,
            borderRadius: theme.borderRadius.lg,
            padding: theme.spacing.xl,
            marginBottom: theme.spacing['2xl'],
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: theme.fontSize.sm,
              color: theme.colors.textMuted,
              marginBottom: theme.spacing.md,
            }}
          >
            If this problem persists, please contact support with the following information:
          </div>
          <div
            style={{
              background: theme.colors.darkSolid,
              borderRadius: theme.borderRadius.md,
              padding: theme.spacing.md,
              fontSize: theme.fontSize.sm,
              fontFamily: 'monospace',
            }}
          >
            <div style={{ color: theme.colors.textSecondary }}>
              <span style={{ color: theme.colors.accent }}>Timestamp:</span>{' '}
              {new Date().toISOString()}
            </div>
            <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
              <span style={{ color: theme.colors.accent }}>URL:</span> {window.location.href}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'center' }}>
          {showTryAgain && (
            <button onClick={handleTryAgain} style={buttonStyle}>
              <RefreshCw size={18} />
              Try Again
            </button>
          )}
          <Link to="/" style={secondaryButtonStyle}>
            <Home size={18} />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Error;
