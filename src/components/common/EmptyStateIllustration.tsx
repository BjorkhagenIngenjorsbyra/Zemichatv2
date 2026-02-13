import React from 'react';

interface EmptyStateIllustrationProps {
  type: 'no-chats' | 'no-friends' | 'no-members' | 'no-requests' | 'no-messages' | 'no-posts';
}

const NoChats: React.FC = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
    {/* Single chat bubble */}
    <rect x="24" y="24" width="72" height="52" rx="16" fill="hsl(var(--primary))" opacity="0.1" />
    <rect x="24" y="24" width="72" height="52" rx="16" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" />
    {/* Tail */}
    <path d="M36 76 L30 88 L48 76" fill="hsl(var(--primary))" opacity="0.1" />
    <path d="M36 76 L30 88 L48 76" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" strokeLinejoin="round" />
    {/* Plus inside bubble */}
    <line x1="60" y1="40" x2="60" y2="60" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="50" y1="50" x2="70" y2="50" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const NoFriends: React.FC = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
    {/* Person 1 */}
    <circle cx="38" cy="42" r="14" fill="hsl(var(--border))" opacity="0.5" />
    <circle cx="38" cy="38" r="8" fill="hsl(var(--muted))" />
    <path d="M22 68 C22 56 54 56 54 68" fill="hsl(var(--border))" opacity="0.5" />
    {/* Person 2 */}
    <circle cx="82" cy="42" r="14" fill="hsl(var(--primary))" opacity="0.15" />
    <circle cx="82" cy="38" r="8" fill="hsl(var(--primary))" opacity="0.3" />
    <path d="M66 68 C66 56 98 56 98 68" fill="hsl(var(--primary))" opacity="0.15" />
    {/* Dashed connection line */}
    <line x1="52" y1="50" x2="68" y2="50" stroke="hsl(var(--muted))" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
  </svg>
);

const NoMembers: React.FC = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
    {/* Center person */}
    <circle cx="60" cy="34" r="10" fill="hsl(var(--muted))" opacity="0.4" />
    <path d="M42 60 C42 48 78 48 78 60" fill="hsl(var(--border))" opacity="0.5" />
    {/* Left person (smaller) */}
    <circle cx="32" cy="44" r="7" fill="hsl(var(--muted))" opacity="0.3" />
    <path d="M22 64 C22 56 42 56 42 64" fill="hsl(var(--border))" opacity="0.3" />
    {/* Right person (smaller) */}
    <circle cx="88" cy="44" r="7" fill="hsl(var(--muted))" opacity="0.3" />
    <path d="M78 64 C78 56 98 56 98 64" fill="hsl(var(--border))" opacity="0.3" />
    {/* Plus badge – positioned below group, no overlap */}
    <circle cx="60" cy="80" r="12" fill="hsl(var(--primary))" opacity="0.15" />
    <circle cx="60" cy="80" r="12" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none" />
    <line x1="60" y1="74" x2="60" y2="86" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
    <line x1="54" y1="80" x2="66" y2="80" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const NoRequests: React.FC = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
    {/* Clock body */}
    <circle cx="60" cy="52" r="28" fill="hsl(var(--border))" opacity="0.3" />
    <circle cx="60" cy="52" r="28" stroke="hsl(var(--muted))" strokeWidth="2" fill="none" />
    {/* Clock hands */}
    <line x1="60" y1="52" x2="60" y2="36" stroke="hsl(var(--muted))" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="60" y1="52" x2="72" y2="52" stroke="hsl(var(--muted))" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="60" cy="52" r="3" fill="hsl(var(--muted))" />
    {/* Checkmark badge */}
    <circle cx="82" cy="34" r="12" fill="hsl(var(--primary))" opacity="0.2" />
    <circle cx="82" cy="34" r="12" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none" />
    <path d="M76 34 L80 38 L88 30" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const NoMessages: React.FC = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
    {/* Chat bubble */}
    <rect x="24" y="28" width="72" height="52" rx="16" fill="hsl(var(--primary))" opacity="0.1" />
    <rect x="24" y="28" width="72" height="52" rx="16" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" />
    {/* Tail */}
    <path d="M36 80 L30 92 L48 80" fill="hsl(var(--primary))" opacity="0.1" />
    <path d="M36 80 L30 92 L48 80" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" strokeLinejoin="round" />
    {/* Three dots */}
    <circle cx="48" cy="54" r="4" fill="hsl(var(--primary))" opacity="0.4" />
    <circle cx="60" cy="54" r="4" fill="hsl(var(--primary))" opacity="0.4" />
    <circle cx="72" cy="54" r="4" fill="hsl(var(--primary))" opacity="0.4" />
  </svg>
);

const NoPosts: React.FC = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
    {/* Camera body */}
    <rect x="24" y="36" width="72" height="52" rx="12" fill="hsl(var(--primary))" opacity="0.1" />
    <rect x="24" y="36" width="72" height="52" rx="12" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" />
    {/* Camera lens */}
    <circle cx="60" cy="62" r="16" fill="hsl(var(--primary))" opacity="0.15" />
    <circle cx="60" cy="62" r="16" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" />
    <circle cx="60" cy="62" r="8" fill="hsl(var(--primary))" opacity="0.25" />
    {/* Flash */}
    <rect x="44" y="28" width="24" height="12" rx="4" fill="hsl(var(--primary))" opacity="0.15" />
    <rect x="44" y="28" width="24" height="12" rx="4" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none" />
    {/* Plus badge */}
    <circle cx="88" cy="42" r="12" fill="hsl(var(--primary))" opacity="0.2" />
    <circle cx="88" cy="42" r="12" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none" />
    <line x1="88" y1="36" x2="88" y2="48" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
    <line x1="82" y1="42" x2="94" y2="42" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const EmptyStateIllustration: React.FC<EmptyStateIllustrationProps> = ({ type }) => {
  return (
    <div className="empty-illustration" style={{ animation: 'gentle-float 3s ease-in-out infinite' }}>
      {type === 'no-chats' && <NoChats />}
      {type === 'no-friends' && <NoFriends />}
      {type === 'no-members' && <NoMembers />}
      {type === 'no-requests' && <NoRequests />}
      {type === 'no-messages' && <NoMessages />}
      {type === 'no-posts' && <NoPosts />}
    </div>
  );
};

export default EmptyStateIllustration;
