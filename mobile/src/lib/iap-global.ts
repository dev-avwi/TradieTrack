import { Platform } from 'react-native';
import { initIAP, setupPurchaseListeners, productIdToTier } from './iap';
import api from './api';
import { useAuthStore } from './store';

let globalListenerActive = false;
let pendingVerifyPromise: Promise<void> | null = null;

export async function initGlobalIAP(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (globalListenerActive) return;

  try {
    const ok = await initIAP();
    if (!ok) return;

    setupPurchaseListeners(
      async (purchase) => {
        const tier = productIdToTier(purchase.productId);
        if (!tier || !purchase.transactionReceipt) {
          console.log('[GlobalIAP] Purchase missing tier/receipt, skipping');
          return;
        }

        console.log('[GlobalIAP] Processing purchase for', tier);

        const verifyPromise = (async () => {
          try {
            await api.post('/api/subscription/verify-apple-receipt', {
              receiptData: purchase.transactionReceipt,
              productId: purchase.productId,
            });
            console.log('[GlobalIAP] Receipt verified, refreshing user');
            await useAuthStore.getState().refreshUser();
          } catch (error) {
            console.error('[GlobalIAP] Failed to verify receipt:', error);
          }
        })();

        pendingVerifyPromise = verifyPromise;
        await verifyPromise;
        if (pendingVerifyPromise === verifyPromise) {
          pendingVerifyPromise = null;
        }
      },
      (error) => {
        if (error?.code !== 'E_USER_CANCELLED') {
          console.error('[GlobalIAP] Purchase error:', error?.code || error?.message);
        }
      }
    );

    globalListenerActive = true;
    console.log('[GlobalIAP] Global IAP listener active');
  } catch (error) {
    console.error('[GlobalIAP] Failed to initialize global IAP:', error);
  }
}

export function isGlobalIAPActive(): boolean {
  return globalListenerActive;
}

export async function waitForPendingVerify(): Promise<void> {
  if (pendingVerifyPromise) {
    await pendingVerifyPromise;
  }
}
