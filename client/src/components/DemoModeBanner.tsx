import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  X, 
  CreditCard, 
  Mail, 
  FileText,
  Users,
  Calendar,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";

interface DemoModeBannerProps {
  userEmail?: string;
}

export default function DemoModeBanner({ userEmail }: DemoModeBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const isDemo = userEmail === 'demo@tradietrack.com.au';
  
  if (!isDemo || isDismissed) return null;

  return (
    <Card className="border-2 border-dashed border-orange-300 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 mx-4 mt-4">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-orange-800 dark:text-orange-200">
                  Demo Mode Active
                </h3>
                <Badge variant="outline" className="border-orange-400 text-orange-700 dark:text-orange-300 text-xs">
                  Mike's Plumbing Services
                </Badge>
              </div>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-0.5">
                Explore the app with sample data. Payments are simulated - no real charges.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-orange-700 hover:text-orange-800 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900/50"
              data-testid="button-demo-expand"
            >
              {isExpanded ? (
                <>
                  Less <ChevronUp className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  Tips <ChevronDown className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDismissed(true)}
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/50 h-8 w-8"
              data-testid="button-demo-dismiss"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-800">
            <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-3">
              What you can try in Demo Mode:
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DemoFeatureCard
                icon={<Users className="w-4 h-4" />}
                title="Browse Clients"
                description="View 3 sample clients with contact details"
                link="/clients"
              />
              <DemoFeatureCard
                icon={<Calendar className="w-4 h-4" />}
                title="Manage Jobs"
                description="See jobs at different workflow stages"
                link="/jobs"
              />
              <DemoFeatureCard
                icon={<FileText className="w-4 h-4" />}
                title="Create Quotes"
                description="Build quotes with GST calculations"
                link="/quotes"
              />
              <DemoFeatureCard
                icon={<CreditCard className="w-4 h-4" />}
                title="Test Payments"
                description="Simulate invoice payments"
                link="/invoices"
              />
              <DemoFeatureCard
                icon={<Mail className="w-4 h-4" />}
                title="Email Preview"
                description="See professional email templates"
                link="/quotes"
              />
              <DemoFeatureCard
                icon={<Sparkles className="w-4 h-4" />}
                title="AI Assistant"
                description="Try the AI quote generator"
                link="/quotes"
              />
            </div>
            
            <div className="mt-4 p-3 bg-white/50 dark:bg-black/20 rounded-lg">
              <p className="text-xs text-orange-700 dark:text-orange-300">
                <strong>Note:</strong> Demo data resets periodically. To save your work, 
                create a free account with your email.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DemoFeatureCard({ 
  icon, 
  title, 
  description, 
  link 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  link: string;
}) {
  return (
    <Link href={link}>
      <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg hover-elevate cursor-pointer group">
        <div className="flex items-start gap-2">
          <div className="text-orange-600 dark:text-orange-400 mt-0.5">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200 group-hover:underline">
              {title}
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              {description}
            </p>
          </div>
          <ArrowRight className="w-3 h-3 text-orange-400 dark:text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
        </div>
      </div>
    </Link>
  );
}
