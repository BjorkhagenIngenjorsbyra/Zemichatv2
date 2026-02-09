import React, { useState, useCallback } from 'react';
import { IonButton } from '@ionic/react';
import { useSwipeable } from 'react-swipeable';
import { ConfettiAnimation } from './ConfettiAnimation';

export interface OnboardingSlide {
  icon: string;
  title: string;
  description: string;
  color: string;
  animation?: 'bounce' | 'pulse' | 'float' | 'shake';
}

interface OnboardingSlidesProps {
  slides: OnboardingSlide[];
  onComplete: () => void;
  skipLabel?: string;
  nextLabel?: string;
  doneLabel?: string;
  showConfetti?: boolean;
}

export const OnboardingSlides: React.FC<OnboardingSlidesProps> = ({
  slides,
  onComplete,
  skipLabel = 'Skip',
  nextLabel = 'Next',
  doneLabel = 'Done',
  showConfetti = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [isAnimating, setIsAnimating] = useState(false);

  const isLastSlide = currentIndex === slides.length - 1;
  const slide = slides[currentIndex];

  const goTo = useCallback(
    (index: number) => {
      if (isAnimating || index < 0 || index >= slides.length || index === currentIndex) return;
      setDirection(index > currentIndex ? 'right' : 'left');
      setIsAnimating(true);
      setCurrentIndex(index);
      setTimeout(() => setIsAnimating(false), 400);
    },
    [currentIndex, isAnimating, slides.length]
  );

  const goNext = useCallback(() => {
    if (isLastSlide) {
      onComplete();
    } else {
      goTo(currentIndex + 1);
    }
  }, [isLastSlide, onComplete, goTo, currentIndex]);

  const goPrev = useCallback(() => {
    goTo(currentIndex - 1);
  }, [goTo, currentIndex]);

  const handlers = useSwipeable({
    onSwipedLeft: goNext,
    onSwipedRight: goPrev,
    trackMouse: false,
    preventScrollOnSwipe: true,
  });

  return (
    <div className="onboarding-slides" {...handlers}>
      <style>{`
        .onboarding-slides {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--ion-background-color, #fff);
          touch-action: pan-y;
        }

        .onboarding-skip-btn {
          position: absolute;
          top: env(safe-area-inset-top, 16px);
          right: 16px;
          z-index: 10;
          --color: hsl(0 0% 50%);
          font-size: 14px;
        }

        .onboarding-slide-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 32px;
          text-align: center;
          animation-duration: 0.4s;
          animation-fill-mode: both;
          animation-timing-function: ease-out;
        }
        .onboarding-slide-content.slide-in-right {
          animation-name: onbSlideInRight;
        }
        .onboarding-slide-content.slide-in-left {
          animation-name: onbSlideInLeft;
        }

        .onboarding-icon {
          font-size: 72px;
          margin-bottom: 32px;
          line-height: 1;
        }
        .onboarding-icon.anim-bounce {
          animation: onbBounce 2s ease infinite;
        }
        .onboarding-icon.anim-pulse {
          animation: onbPulse 2s ease-in-out infinite;
        }
        .onboarding-icon.anim-float {
          animation: onbFloat 3s ease-in-out infinite;
        }
        .onboarding-icon.anim-shake {
          animation: onbShake 2.5s ease-in-out infinite;
        }

        .onboarding-title {
          font-size: 26px;
          font-weight: 700;
          margin-bottom: 12px;
          animation: onbFadeInUp 0.5s ease-out 0.15s both;
        }
        .onboarding-description {
          font-size: 16px;
          line-height: 1.5;
          color: hsl(0 0% 45%);
          max-width: 320px;
          animation: onbFadeInUp 0.5s ease-out 0.3s both;
        }

        .onboarding-footer {
          padding: 16px 32px;
          padding-bottom: calc(env(safe-area-inset-bottom, 16px) + 16px);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .onboarding-dots {
          display: flex;
          gap: 8px;
        }
        .onboarding-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: none;
          padding: 0;
          cursor: pointer;
          transition: all 0.3s ease;
          background: hsl(0 0% 80%);
        }
        .onboarding-dot.active {
          width: 24px;
          border-radius: 4px;
        }

        .onboarding-next-btn {
          width: 100%;
          max-width: 320px;
          --border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          height: 48px;
        }

        @keyframes onbSlideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes onbSlideInLeft {
          from { opacity: 0; transform: translateX(-60px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes onbFadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes onbBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-16px); }
        }
        @keyframes onbPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.85; }
        }
        @keyframes onbFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-10px) rotate(2deg); }
          66% { transform: translateY(-5px) rotate(-2deg); }
        }
        @keyframes onbShake {
          0%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(-8deg); }
          20% { transform: rotate(8deg); }
          30% { transform: rotate(-5deg); }
          40% { transform: rotate(5deg); }
          50%, 100% { transform: rotate(0deg); }
        }
      `}</style>

      {!isLastSlide && (
        <IonButton
          fill="clear"
          className="onboarding-skip-btn"
          onClick={onComplete}
        >
          {skipLabel}
        </IonButton>
      )}

      <div
        key={currentIndex}
        className={`onboarding-slide-content ${
          direction === 'right' ? 'slide-in-right' : 'slide-in-left'
        }`}
      >
        <div className={`onboarding-icon${slide.animation ? ` anim-${slide.animation}` : ''}`}>
          {slide.icon}
        </div>
        <div className="onboarding-title" style={{ color: slide.color }}>
          {slide.title}
        </div>
        <div className="onboarding-description">{slide.description}</div>
      </div>

      <div className="onboarding-footer">
        <div className="onboarding-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`onboarding-dot${i === currentIndex ? ' active' : ''}`}
              style={i === currentIndex ? { background: slide.color } : undefined}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <IonButton
          className="onboarding-next-btn"
          expand="block"
          onClick={goNext}
          style={{ '--background': slide.color } as React.CSSProperties}
        >
          {isLastSlide ? doneLabel : nextLabel}
        </IonButton>
      </div>

      {showConfetti && isLastSlide && <ConfettiAnimation active={true} />}
    </div>
  );
};
