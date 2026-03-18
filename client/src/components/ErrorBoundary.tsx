import React, { Component, ErrorInfo } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error.message, error.stack);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    trackEvent("app_crash", {
      error: error.message?.substring(0, 200),
      componentStack: errorInfo.componentStack?.substring(0, 500),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="flex flex-col items-center text-center pt-8 pb-8 gap-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-xl font-semibold text-foreground">
                Something went wrong
              </h1>
              <p className="text-muted-foreground text-sm">
                We hit a snag. Try refreshing the page.
              </p>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                <Button onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = "/";
                  }}
                >
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
