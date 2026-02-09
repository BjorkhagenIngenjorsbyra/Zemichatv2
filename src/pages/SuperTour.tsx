import React from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IonPage, IonContent } from '@ionic/react';
import { useAuthContext } from '../contexts/AuthContext';
import { OnboardingSlides, type OnboardingSlide } from '../components/OnboardingSlides';

const TOUR_KEY = 'zemichat-super-tour-done';

const SuperTour: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { profile } = useAuthContext();

  const displayName = profile?.display_name || '';

  const slides: OnboardingSlide[] = [
    {
      icon: '👋',
      title: t('onboarding.superSlide1Title', { name: displayName }),
      description: t('onboarding.superSlide1Desc'),
      color: '#4F46E5',
      animation: 'bounce',
    },
    {
      icon: '🔒',
      title: t('onboarding.superSlide2Title'),
      description: t('onboarding.superSlide2Desc'),
      color: '#059669',
      animation: 'pulse',
    },
    {
      icon: '💬',
      title: t('onboarding.superSlide3Title'),
      description: t('onboarding.superSlide3Desc'),
      color: '#D97706',
      animation: 'float',
    },
    {
      icon: '🚀',
      title: t('onboarding.superSlide4Title'),
      description: t('onboarding.superSlide4Desc'),
      color: '#EC4899',
      animation: 'shake',
    },
  ];

  const handleComplete = () => {
    localStorage.setItem(TOUR_KEY, 'true');
    history.replace('/dashboard');
  };

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <OnboardingSlides
          slides={slides}
          onComplete={handleComplete}
          skipLabel={t('onboarding.skip')}
          nextLabel={t('onboarding.next')}
          doneLabel={t('onboarding.goToDashboard')}
          showConfetti
        />
      </IonContent>
    </IonPage>
  );
};

export default SuperTour;
