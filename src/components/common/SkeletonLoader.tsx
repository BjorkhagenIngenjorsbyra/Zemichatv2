import React from 'react';

interface SkeletonLoaderProps {
  variant: 'chat-list' | 'friend-list' | 'member-list' | 'messages' | 'approval-list' | 'oversight-list';
  count?: number;
}

const Bone: React.FC<{ width?: string; height?: string; borderRadius?: string; style?: React.CSSProperties }> = ({
  width = '100%',
  height = '1rem',
  borderRadius,
  style,
}) => (
  <div
    className="skeleton-bone"
    style={{ width, height, borderRadius, ...style }}
  />
);

const ChatListSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="skeleton-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'hsl(var(--card))', borderRadius: '1rem', marginBottom: '0.5rem' }}>
        <Bone width="48px" height="48px" borderRadius="50%" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <Bone width="60%" height="0.9rem" />
            <Bone width="2.5rem" height="0.7rem" />
          </div>
          <Bone width="80%" height="0.75rem" />
        </div>
      </div>
    ))}
  </>
);

const FriendListSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="skeleton-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'hsl(var(--card))', borderRadius: '1rem', marginBottom: '0.5rem' }}>
        <Bone width="40px" height="40px" borderRadius="50%" style={{ flexShrink: 0 }} />
        <Bone width="50%" height="0.9rem" />
      </div>
    ))}
  </>
);

const MemberListSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <div style={{ background: 'hsl(var(--card))', borderRadius: '1rem', overflow: 'hidden' }}>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="skeleton-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: i < count - 1 ? '1px solid hsl(var(--border))' : 'none' }}>
        <Bone width="40px" height="40px" borderRadius="50%" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <Bone width="45%" height="0.9rem" style={{ marginBottom: '0.35rem' }} />
          <Bone width="30%" height="0.7rem" />
        </div>
        <Bone width="3rem" height="1.25rem" borderRadius="9999px" style={{ flexShrink: 0 }} />
      </div>
    ))}
  </div>
);

// Deterministic bone dimensions — using Math.random() during render reshuffled
// every skeleton on each parent re-render (visible flicker) and broke render
// purity / StrictMode double-render expectations.
const MESSAGE_BONE_DIMS = [
  { w: '48%', h: '2.6rem' },
  { w: '60%', h: '2.0rem' },
  { w: '40%', h: '3.0rem' },
  { w: '55%', h: '2.3rem' },
  { w: '38%', h: '2.8rem' },
  { w: '52%', h: '2.1rem' },
  { w: '45%', h: '3.2rem' },
  { w: '58%', h: '2.4rem' },
];

const MessagesSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
    {Array.from({ length: count }, (_, i) => {
      const isOwn = i % 3 !== 0;
      const dim = MESSAGE_BONE_DIMS[i % MESSAGE_BONE_DIMS.length];
      return (
        <div key={i} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
          <Bone width={dim.w} height={dim.h} borderRadius="1rem" />
        </div>
      );
    })}
  </div>
);

const ApprovalListSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <div style={{ padding: '1rem' }}>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="skeleton-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'hsl(var(--card))', borderRadius: '1rem', marginBottom: '0.5rem' }}>
        <Bone width="40px" height="40px" borderRadius="50%" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <Bone width="55%" height="0.9rem" style={{ marginBottom: '0.35rem' }} />
          <Bone width="35%" height="0.7rem" />
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <Bone width="36px" height="36px" borderRadius="50%" />
          <Bone width="36px" height="36px" borderRadius="50%" />
        </div>
      </div>
    ))}
  </div>
);

const OversightListSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="skeleton-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'hsl(var(--card))', marginBottom: '0.5rem' }}>
        <Bone width="48px" height="48px" borderRadius="50%" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <Bone width="50%" height="0.9rem" />
            <Bone width="2.5rem" height="0.7rem" />
          </div>
          <Bone width="70%" height="0.75rem" style={{ marginBottom: '0.35rem' }} />
          <Bone width="4rem" height="1rem" borderRadius="9999px" />
        </div>
      </div>
    ))}
  </>
);

const DEFAULTS: Record<SkeletonLoaderProps['variant'], number> = {
  'chat-list': 6,
  'friend-list': 4,
  'member-list': 3,
  'messages': 8,
  'approval-list': 3,
  'oversight-list': 4,
};

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ variant, count }) => {
  const n = count ?? DEFAULTS[variant];

  switch (variant) {
    case 'chat-list':
      return <ChatListSkeleton count={n} />;
    case 'friend-list':
      return <FriendListSkeleton count={n} />;
    case 'member-list':
      return <MemberListSkeleton count={n} />;
    case 'messages':
      return <MessagesSkeleton count={n} />;
    case 'approval-list':
      return <ApprovalListSkeleton count={n} />;
    case 'oversight-list':
      return <OversightListSkeleton count={n} />;
  }
};

export default SkeletonLoader;
