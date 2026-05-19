import { requireNativeModule } from 'expo-modules-core';

import type { LiveActivityNativeModule } from './index';

export default requireNativeModule<LiveActivityNativeModule>('LiveActivity');
