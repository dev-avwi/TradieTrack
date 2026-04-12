import { createContext, useContext, useCallback, ReactNode } from 'react';
import { Alert as RNAlert, AlertButton, AlertOptions } from 'react-native';

interface CustomAlertContextType {
  showAlert: (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => void;
}

const CustomAlertContext = createContext<CustomAlertContextType | null>(null);

export function useCustomAlert() {
  const ctx = useContext(CustomAlertContext);
  if (!ctx) throw new Error('useCustomAlert must be used within CustomAlertProvider');
  return ctx;
}

export function CustomAlertProvider({ children }: { children: ReactNode }) {
  const showAlert = useCallback((title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => {
    RNAlert.alert(title, message, buttons, options);
  }, []);

  return (
    <CustomAlertContext.Provider value={{ showAlert }}>
      {children}
    </CustomAlertContext.Provider>
  );
}
