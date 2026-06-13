import React, { useMemo } from 'react';
import { Redirect, useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IonPage, IonContent } from '@ionic/react';
import { OnboardingSlides, type OnboardingSlide } from '../components/OnboardingSlides';

const TOUR_KEY = 'zemichat-owner-onboarding-done';

const OwnerOnboarding: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();

  // Read synchronously during render so returning users redirect immediately
  // instead of flashing a frame of the slides (localStorage is sync anyway).
  const alreadyDone = useMemo(() => !!localStorage.getItem(TOUR_KEY), []);

  const slides = useMemo<OnboardingSlide[]>(
    () => [
      {
        icon: '💬',
        title: t('onboarding.ownerSlide1Title'),
        description: t('onboarding.ownerSlide1Desc'),
        color: '#4F46E5',
        animation: 'bounce',
      },
      {
        icon: '🛡️',
        title: t('onboarding.ownerSlide2Title'),
        description: t('onboarding.ownerSlide2Desc'),
        color: '#059669',
        animation: 'pulse',
      },
      {
        icon: '⚙️',
        title: t('onboarding.ownerSlide3Title'),
        description: t('onboarding.ownerSlide3Desc'),
        color: '#D97706',
        animation: 'float',
      },
      {
        icon: '👨‍👩‍👧‍👦',
        title: t('onboarding.ownerSlide4Title'),
        description: t('onboarding.ownerSlide4Desc'),
        color: '#7C3AED',
        animation: 'float',
      },
      {
        icon: '🎉',
        title: t('onboarding.ownerSlide5Title'),
        description: t('onboarding.ownerSlide5Desc'),
        color: '#EC4899',
        animation: 'shake',
      },
    ],
    [t]
  );

  const handleComplete = () => {
    localStorage.setItem(TOUR_KEY, 'true');
    history.push('/signup');
  };

  if (alreadyDone) return <Redirect to="/login" />;

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <OnboardingSlides
          slides={slides}
          onComplete={handleComplete}
          skipLabel={t('onboarding.skip')}
          nextLabel={t('onboarding.next')}
          doneLabel={t('onboarding.createAccount')}
          showConfetti
        />
      </IonContent>
    </IonPage>
  );
};

export default OwnerOnboarding;
