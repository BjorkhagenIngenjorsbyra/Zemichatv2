import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

export const hapticLight = () => {
  if (isNative) {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  }
};

export const hapticMedium = () => {
  if (isNative) {
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  }
};

export const hapticHeavy = () => {
  if (isNative) {
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
  }
};

export const hapticSuccess = () => {
  if (isNative) {
    Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  }
};

export const hapticWarning = () => {
  if (isNative) {
    Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
  }
};

export const hapticError = () => {
  if (isNative) {
    Haptics.notification({ type: NotificationType.Error }).catch(() => {});
  }
};
