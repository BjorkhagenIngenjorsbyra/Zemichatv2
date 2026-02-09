import React from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IonPage, IonContent } from '@ionic/react';
import { OnboardingSlides, type OnboardingSlide } from '../components/OnboardingSlides';

const OwnerOnboarding: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();

  const slides: OnboardingSlide[] = [
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
  ];

  const handleComplete = () => {
    history.push('/signup');
  };

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
