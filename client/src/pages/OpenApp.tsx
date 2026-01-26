import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone, Globe, Apple, Download } from "lucide-react";

const APP_STORE_URL = "https://apps.apple.com/app/tradietrack/id123456789";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.tradietrack.app";

export default function OpenApp() {
  const [, params] = useRoute("/open-app/:action/:token");
  const [, setLocation] = useLocation();
  const action = params?.action || '';
  const token = params?.token || '';
  
  const [status, setStatus] = useState<'trying' | 'fallback'>('trying');
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }
  }, []);
  
  useEffect(() => {
    if (!action || !token) return;
    
    const deepLink = `tradietrack://${action}?token=${token}`;
    const webFallback = `/${action}/${token}`;
    
    if (platform === 'desktop') {
      setLocation(webFallback);
      return;
    }
    
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = deepLink;
    document.body.appendChild(iframe);
    
    window.location.href = deepLink;
    
    const timeout = setTimeout(() => {
      setStatus('fallback');
      document.body.removeChild(iframe);
    }, 2500);
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(timeout);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    };
  }, [action, token, platform, setLocation]);
  
  const handleOpenStore = () => {
    if (platform === 'ios') {
      window.location.href = APP_STORE_URL;
    } else {
      window.location.href = PLAY_STORE_URL;
    }
  };
  
  const handleContinueWeb = () => {
    setLocation(`/${action}/${token}`);
  };
  
  if (status === 'trying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Opening TradieTrack...</h2>
            <p className="text-muted-foreground">
              If the app doesn't open, please wait a moment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center">
            <Smartphone className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-2xl">Get the TradieTrack App</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            For the best experience, download the TradieTrack app. It's free and works great on your phone.
          </p>
          
          <div className="space-y-3">
            <Button 
              className="w-full h-14 text-base gap-3" 
              onClick={handleOpenStore}
            >
              {platform === 'ios' ? (
                <>
                  <Apple className="w-6 h-6" />
                  Download from App Store
                </>
              ) : (
                <>
                  <Download className="w-6 h-6" />
                  Download from Play Store
                </>
              )}
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full h-12 gap-2"
              onClick={handleContinueWeb}
            >
              <Globe className="w-5 h-5" />
              Continue in Browser
            </Button>
          </div>
          
          <p className="text-center text-xs text-muted-foreground pt-2">
            Already have the app?{' '}
            <button 
              onClick={() => {
                setStatus('trying');
                window.location.href = `tradietrack://${action}?token=${token}`;
              }}
              className="text-primary underline"
            >
              Try opening again
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
