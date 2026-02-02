import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Sparkles, FolderOpen, Database, Rocket, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface DemoDataStepProps {
  onComplete: (data: { useDemoData: boolean }) => void;
  onPrevious: () => void;
  isSubmitting?: boolean;
}

export default function DemoDataStep({ onComplete, onPrevious, isSubmitting }: DemoDataStepProps) {
  const [selected, setSelected] = useState<'demo' | 'fresh' | null>(null);

  const handleContinue = () => {
    if (selected) {
      onComplete({ useDemoData: selected === 'demo' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Ready to Get Started!</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Would you like to explore with sample data or start with a clean slate?
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-w-2xl mx-auto">
        <Card 
          className={`cursor-pointer transition-all hover-elevate ${
            selected === 'demo' 
              ? 'ring-2 ring-primary border-primary bg-primary/5' 
              : 'hover:border-primary/50'
          }`}
          onClick={() => setSelected('demo')}
          data-testid="card-demo-data"
        >
          <CardHeader className="text-center pb-2">
            <div className={`mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${
              selected === 'demo' ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
            }`}>
              <Database className={`h-6 w-6 ${selected === 'demo' ? '' : 'text-primary'}`} />
            </div>
            <CardTitle className="text-lg">Explore with Sample Data</CardTitle>
            <CardDescription>Recommended for new users</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              We'll add sample clients, jobs, quotes, and invoices so you can see how everything works.
            </p>
            <ul className="text-sm text-left space-y-2 pl-4">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>5 sample clients</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>6 jobs at different stages</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>Quotes and invoices ready to view</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>Clear sample data anytime in Settings</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover-elevate ${
            selected === 'fresh' 
              ? 'ring-2 ring-primary border-primary bg-primary/5' 
              : 'hover:border-primary/50'
          }`}
          onClick={() => setSelected('fresh')}
          data-testid="card-start-fresh"
        >
          <CardHeader className="text-center pb-2">
            <div className={`mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${
              selected === 'fresh' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              <FolderOpen className={`h-6 w-6 ${selected === 'fresh' ? '' : 'text-muted-foreground'}`} />
            </div>
            <CardTitle className="text-lg">Start Fresh</CardTitle>
            <CardDescription>For experienced users</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Jump straight in with a clean account. Perfect if you're ready to add your own clients and jobs.
            </p>
            <ul className="text-sm text-left space-y-2 pl-4">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>Empty dashboard ready to go</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>Add your first client immediately</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>No sample data to clear later</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>You can add sample data anytime</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between max-w-2xl mx-auto pt-4">
        <Button
          variant="outline"
          onClick={onPrevious}
          data-testid="button-previous-step"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => onComplete({ useDemoData: false })}
            data-testid="button-skip-step"
          >
            Skip
          </Button>
          
          <Button
            onClick={handleContinue}
            disabled={!selected || isSubmitting}
            data-testid="button-complete-setup"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                Setting up...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Complete Setup
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
