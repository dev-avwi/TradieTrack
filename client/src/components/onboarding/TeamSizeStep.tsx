import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, User, Users, Building2, CheckCircle } from "lucide-react";

interface TeamSizeStepProps {
  data: { teamSize: 'solo' | 'small' | 'medium' | 'large' };
  onComplete: (data: { teamSize: 'solo' | 'small' | 'medium' | 'large' }) => void;
}

const teamSizeOptions = [
  {
    value: 'solo' as const,
    title: "Just me",
    description: "Solo tradie running my own show",
    icon: User,
  },
  {
    value: 'small' as const,
    title: "2-5 people",
    description: "Small crew, keeping it tight",
    icon: Users,
  },
  {
    value: 'medium' as const,
    title: "6-15 people",
    description: "Growing team with multiple jobs",
    icon: Users,
  },
  {
    value: 'large' as const,
    title: "16+ people",
    description: "Full operation with teams",
    icon: Building2,
  },
];

export default function TeamSizeStep({ data, onComplete }: TeamSizeStepProps) {
  const [selected, setSelected] = useState<'solo' | 'small' | 'medium' | 'large'>(data.teamSize || 'solo');

  const handleContinue = () => {
    onComplete({ teamSize: selected });
  };

  return (
    <Card className="shadow-xl border-0">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl" data-testid="text-team-size-title">How many people work in your business?</CardTitle>
        <CardDescription className="text-base" data-testid="text-team-size-description">
          This helps us set up TradieTrack just right for you
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {teamSizeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selected === option.value;
            
            return (
              <Button
                key={option.value}
                variant="outline"
                onClick={() => setSelected(option.value)}
                className={`relative p-5 h-auto flex flex-col items-start text-left rounded-xl transition-all ${
                  isSelected 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary ring-offset-2' 
                    : 'hover-elevate'
                }`}
                data-testid={`team-size-${option.value}`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle className="w-5 h-5 text-primary" data-testid={`icon-check-${option.value}`} />
                  </div>
                )}
                
                <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-3">
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </div>
                
                <span className={`font-semibold text-lg mb-1 ${isSelected ? 'text-primary' : ''}`} data-testid={`text-option-title-${option.value}`}>
                  {option.title}
                </span>
                <span className="text-sm text-muted-foreground" data-testid={`text-option-desc-${option.value}`}>
                  {option.description}
                </span>
              </Button>
            );
          })}
        </div>

        <Button 
          onClick={handleContinue}
          className="w-full"
          size="lg"
          data-testid="button-continue-team-size"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
