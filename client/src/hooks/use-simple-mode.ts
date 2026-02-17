import { useBusinessSettings, useUpdateBusinessSettings } from "@/hooks/use-business-settings";
import { useCallback } from "react";

export function useSimpleMode() {
  const { data: businessSettings, isLoading } = useBusinessSettings();
  const updateSettings = useUpdateBusinessSettings();

  const isSimpleMode = businessSettings?.simpleMode ?? true;

  const setSimpleMode = useCallback((value: boolean) => {
    updateSettings.mutate({ simpleMode: value });
  }, [updateSettings]);

  return {
    isSimpleMode,
    setSimpleMode,
    isLoading,
  };
}
