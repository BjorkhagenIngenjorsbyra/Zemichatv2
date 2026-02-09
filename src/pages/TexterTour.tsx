import React from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IonPage, IonContent } from '@ionic/react';
import { useAuthContext } from '../contexts/AuthContext';
import { OnboardingSlides, type OnboardingSlide } from '../components/OnboardingSlides';

const TOUR_KEY = 'zemichat-texter-tour-done';

const TexterTour: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { profile } = useAuthContext();

  const displayName = profile?.display_name || '';

  const slides: OnboardingSlide[] = [
    {
      icon: '👋',
      title: t('onboarding.texterSlide1Title', { name: displayName }),
      description: t('onboarding.texterSlide1Desc'),
      color: '#F59E0B',
      animation: 'bounce',
    },
    {
      icon: '🛡️',
      title: t('onboarding.texterSlide2Title'),
      description: t('onboarding.texterSlide2Desc'),
      color: '#10B981',
      animation: 'pulse',
    },
    {
      icon: '🎉',
      title: t('onboarding.texterSlide3Title'),
      description: t('onboarding.texterSlide3Desc'),
      color: '#8B5CF6',
      animation: 'shake',
    },
  ];

  const handleComplete = () => {
    localStorage.setItem(TOUR_KEY, 'true');
    history.replace('/chats');
  };

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <OnboardingSlides
          slides={slides}
          onComplete={handleComplete}
          skipLabel={t('onboarding.skip')}
          nextLabel={t('onboarding.next')}
          doneLabel={t('onboarding.startChatting')}
          showConfetti
        />
      </IonContent>
    </IonPage>
  );
};

export default TexterTour;
