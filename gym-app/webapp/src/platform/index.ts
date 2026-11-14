import { Capacitor } from '@capacitor/core';
import { capacitorPlatform } from './capacitor';
import type { Platform } from './types';
import { webPlatform } from './web';

export type { Platform, PhotoSource, SaveResult } from './types';
export { resizeImage } from './image';

export const platform: Platform = Capacitor.isNativePlatform() ? capacitorPlatform : webPlatform;
