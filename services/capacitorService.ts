import { Capacitor } from '@capacitor/core';

export const capacitorService = {
  isNative: (): boolean => {
    return Capacitor.isNativePlatform();
  },

  getPlatform: (): 'ios' | 'android' | 'web' => {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
    return 'web';
  },

  isIOS: (): boolean => {
    return Capacitor.getPlatform() === 'ios';
  },

  isAndroid: (): boolean => {
    return Capacitor.getPlatform() === 'android';
  },

  isWeb: (): boolean => {
    return !Capacitor.isNativePlatform();
  }
};

export default capacitorService;
