import { getInitial, getAvatarColor } from '../../utils/userDisplay';

interface GroupAvatarProps {
  members: Array<{
    display_name?: string | null;
    zemi_number?: string | null;
    avatar_url?: string | null;
  }>;
  size?: number;
}

/**
 * Stacked/overlapping avatar circles for group chats.
 * Shows up to 4 member avatars in a 2x2 or overlapping layout.
 */
const GroupAvatar: React.FC<GroupAvatarProps> = ({ members, size = 48 }) => {
  const shown = members.slice(0, 4);
  const miniSize = size * 0.55;

  if (shown.length <= 1) {
    // Single member — regular avatar
    const m = shown[0];
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }}>
        {m?.avatar_url ? (
          <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: getAvatarColor(m),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: size * 0.4,
            }}
          >
            {getInitial(m)}
          </div>
        )}
      </div>
    );
  }

  // 2-4 members: 2x2 grid layout
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 1,
        background: 'hsl(var(--border))',
      }}
    >
      {shown.map((m, i) => (
        <div key={i} style={{ overflow: 'hidden' }}>
          {m.avatar_url ? (
            <img
              src={m.avatar_url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: getAvatarColor(m),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: miniSize * 0.45,
              }}
            >
              {getInitial(m)}
            </div>
          )}
        </div>
      ))}
      {/* Fill empty slots if 2-3 members */}
      {shown.length < 4 && Array.from({ length: 4 - shown.length }, (_, i) => (
        <div key={`empty-${i}`} style={{ background: 'hsl(var(--card))' }} />
      ))}
    </div>
  );
};

export default GroupAvatar;
