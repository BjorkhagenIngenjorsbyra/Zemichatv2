import React, { useMemo } from 'react';

interface ConfettiAnimationProps {
  active: boolean;
  duration?: number;
}

const CONFETTI_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA',
];

const PARTICLE_COUNT = 24;

export const ConfettiAnimation: React.FC<ConfettiAnimationProps> = ({
  active,
  duration = 3000,
}) => {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotation: Math.random() * 360,
        size: 6 + Math.random() * 6,
        shape: i % 3, // 0=square, 1=circle, 2=rectangle
      })),
    []
  );

  if (!active) return null;

  return (
    <div className="confetti-container" aria-hidden="true">
      <style>{`
        .confetti-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 9999;
          overflow: hidden;
        }
        .confetti-particle {
          position: absolute;
          top: -12px;
          animation: confettiFall ${duration}ms ease-in forwards;
        }
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          75% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            backgroundColor: p.color,
            width: p.shape === 2 ? p.size * 0.5 : p.size,
            height: p.size,
            borderRadius: p.shape === 1 ? '50%' : '2px',
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
};
