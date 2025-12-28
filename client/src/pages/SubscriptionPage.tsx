import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Check, 
  X, 
  Crown, 
  Users, 
  Shield,
  Clock,
  CreditCard,
  Sparkles,
  Loader2,
  ChevronRight,
  Calendar,
  ArrowRight,
  Minus,
  Plus,
  Zap,
  ExternalLink
} from "lucide-react";

interface SubscriptionStatus {
  tier: 'free' | 'trial' | 'pro' | 'team';
  status: string;
  trialEndsAt: string | null;
  nextBillingDate: string | null;
  cancelAtPeriodEnd: boolean;
  paymentMethod: {
    last4: string;
    brand: string;
  } | null;
  seats?: number;
  canUpgrade: boolean;
  canDowngrade: boolean;
}

const tiers = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'For solo tradies just getting started',
    features: [
      { text: 'Unlimited quotes', included: true },
      { text: '25 jobs per month', included: true },
      { text: '25 invoices per month', included: true },
      { text: '50 clients', included: true },
      { text: 'Unlimited jobs', included: false },
      { text: 'AI-powered features', included: false },
      { text: 'Team management', included: false },
      { text: 'Priority support', included: false },
    ],
    cta: 'Current Plan',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 39,
    description: 'For growing trade businesses',
    features: [
      { text: 'Unlimited jobs', included: true },
      { text: 'Unlimited quotes & invoices', included: true },
      { text: 'AI quote generator', included: true },
      { text: 'AI photo analysis', included: true },
      { text: 'Custom templates', included: true },
      { text: 'Email integration', included: true },
      { text: 'Team management', included: false },
      { text: 'Team seats', included: false },
    ],
    cta: 'Start 14-Day Free Trial',
    popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: 59,
    seatPrice: 29,
    description: 'For businesses with employees',
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'Team management', included: true },
      { text: 'Role-based permissions', included: true },
      { text: 'Staff scheduling', included: true },
      { text: 'Time tracking', included: true },
      { text: 'GPS job tracking', included: true },
      { text: 'Team chat', included: true },
      { text: 'Priority support', included: true },
    ],
    cta: 'Contact Sales',
    isContactSales: true,
    popular: false,
  },
];

const handleContactSales = () => {
  window.location.href = "mailto:admin@avwebinnovation.com?subject=TradieTrack%20Team%20Plan%20Enquiry&body=Hi%20TradieTrack%20Team%20(AV%20Web%20Innovation)%2C%0A%0AI'm%20interested%20in%20the%20TradieTrack%20Team%20plan%20for%20my%20business.%0A%0ABusiness%20Name%3A%20%0ANumber%20of%20Team%20Members%3A%20%0APhone%3A%20%0A%0AThanks!";
};

export default function SubscriptionPage() {
  const [teamSeats, setTeamSeats] = useState(2);
  const { toast } = useToast();

  const { data: status, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/subscription/status'],
  });

  const createCheckoutMutation = useMutation({
    mutationFn: async ({ tier, seats }: { tier: string; seats?: number }) => {
      const response = await apiRequest('POST', '/api/subscription/create-checkout', { 
        tier, 
        seats: tier === 'team' ? seats : undefined 
      });
      return response.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const manageSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/subscription/manage');
      return response.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal.",
        variant: "destructive",
      });
    },
  });

  const handleStartTrial = (tier: string) => {
    createCheckoutMutation.mutate({ tier, seats: tier === 'team' ? teamSeats : undefined });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const isCurrentTier = (tierId: string) => {
    if (!status) return tierId === 'free';
    return status.tier === tierId || (tierId === 'free' && status.tier === 'free');
  };

  const hasActiveSubscription = status && (status.tier === 'pro' || status.tier === 'team' || status.tier === 'trial');

  if (statusLoading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading subscription details...</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-6">
          <Badge className="bg-primary/10 text-primary border-0 px-4 py-1.5">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            14-Day Free Trial
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Try Pro or Team free for 14 days
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            No charges until your trial ends. Cancel anytime with one click.
          </p>
          
          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-green-600" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="w-4 h-4 text-green-600" />
              <span>No payment until trial ends</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 text-green-600" />
              <span>Full access for 14 days</span>
            </div>
          </div>
        </div>

        {/* Current Subscription Status */}
        {hasActiveSubscription && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    {status?.tier === 'team' ? (
                      <Users className="w-6 h-6 text-primary" />
                    ) : (
                      <Crown className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg capitalize">{status?.tier} Plan</h3>
                      {status?.tier === 'trial' && (
                        <Badge variant="outline" className="border-orange-400 text-orange-600">
                          Trial
                        </Badge>
                      )}
                      {status?.cancelAtPeriodEnd && (
                        <Badge variant="outline" className="border-red-400 text-red-600">
                          Canceling
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {status?.tier === 'trial' && status.trialEndsAt ? (
                        <>Trial ends on {formatDate(status.trialEndsAt)}</>
                      ) : status?.nextBillingDate ? (
                        <>Next billing date: {formatDate(status.nextBillingDate)}</>
                      ) : (
                        <>Active subscription</>
                      )}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => manageSubscriptionMutation.mutate()}
                  disabled={manageSubscriptionMutation.isPending}
                  data-testid="button-manage-subscription"
                >
                  {manageSubscriptionMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Manage Subscription
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <Card 
              key={tier.id}
              className={`relative ${tier.popular ? 'border-primary shadow-lg ring-2 ring-primary/20' : ''}`}
              data-testid={`card-pricing-${tier.id}`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-4 pt-6">
                <div className="flex items-center gap-2 mb-2">
                  {tier.id === 'free' && <Zap className="w-5 h-5 text-muted-foreground" />}
                  {tier.id === 'pro' && <Crown className="w-5 h-5 text-primary" />}
                  {tier.id === 'team' && <Users className="w-5 h-5 text-primary" />}
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">{tier.description}</p>
                <div className="pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${tier.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  {tier.id === 'team' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      + ${tier.seatPrice}/seat for team members
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Team Seats Selector */}
                {tier.id === 'team' && !isCurrentTier('team') && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Team seats</span>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setTeamSeats(Math.max(0, teamSeats - 1))}
                          disabled={teamSeats <= 0}
                          data-testid="button-decrease-seats"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center font-semibold" data-testid="text-seat-count">
                          {teamSeats}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setTeamSeats(Math.min(50, teamSeats + 1))}
                          disabled={teamSeats >= 50}
                          data-testid="button-increase-seats"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total monthly</span>
                      <span className="font-semibold">
                        ${tier.price + (teamSeats * (tier.seatPrice || 0))} AUD
                      </span>
                    </div>
                  </div>
                )}

                {/* CTA Button */}
                {tier.id === 'free' ? (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    disabled={isCurrentTier('free')}
                    data-testid="button-free-plan"
                  >
                    {isCurrentTier('free') ? 'Current Plan' : 'Downgrade to Free'}
                  </Button>
                ) : tier.id === 'team' ? (
                  <Button 
                    className="w-full"
                    variant="outline"
                    onClick={handleContactSales}
                    data-testid="button-contact-sales"
                  >
                    {tier.cta}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button 
                    className={`w-full ${tier.popular ? 'bg-primary hover:bg-primary/90' : ''}`}
                    variant={tier.popular ? 'default' : 'outline'}
                    onClick={() => handleStartTrial(tier.id)}
                    disabled={
                      createCheckoutMutation.isPending || 
                      isCurrentTier(tier.id) ||
                      (status?.tier === 'pro' && tier.id === 'pro')
                    }
                    data-testid={`button-start-trial-${tier.id}`}
                  >
                    {createCheckoutMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {isCurrentTier(tier.id) ? 'Current Plan' : tier.cta}
                    {!isCurrentTier(tier.id) && <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                )}

                {/* Charged after trial note */}
                {tier.id === 'pro' && !isCurrentTier(tier.id) && (
                  <p className="text-xs text-center text-muted-foreground">
                    ${tier.price} AUD/month after trial
                  </p>
                )}
                
                {/* Contact sales note */}
                {tier.id === 'team' && (
                  <p className="text-xs text-center text-muted-foreground">
                    Custom pricing based on team size
                  </p>
                )}

                {/* Features List */}
                <ul className="space-y-3">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-5 h-5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={feature.included ? '' : 'text-muted-foreground/60'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trial Information Section */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              How the 14-day trial works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-primary">1</span>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Start your trial</h4>
                  <p className="text-sm text-muted-foreground">
                    Enter your card details to begin. You won't be charged today.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-primary">2</span>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Full access for 14 days</h4>
                  <p className="text-sm text-muted-foreground">
                    Explore all features with no restrictions during your trial period.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-primary">3</span>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Cancel anytime</h4>
                  <p className="text-sm text-muted-foreground">
                    Cancel before the trial ends and you won't be charged a cent.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-background rounded-lg border">
              <div className="flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium mb-1">Card required upfront</h4>
                  <p className="text-sm text-muted-foreground">
                    We collect your payment details to start the trial, but you won't be charged until the 14-day period ends. 
                    You'll receive an email reminder before your first charge.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <div className="text-center py-6">
          <p className="text-muted-foreground">
            Have questions?{' '}
            <a 
              href="mailto:support@tradietrack.com.au" 
              className="text-primary hover:underline"
              data-testid="link-contact-support"
            >
              Contact our support team
            </a>
          </p>
        </div>
      </div>
    </PageShell>
  );
}
