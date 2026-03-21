import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  ExternalLink,
  Gift,
  Phone,
  MessageCircle,
  Bot,
  Link2,
  Headphones,
  Globe,
  PhoneCall,
  UserCheck,
  Mail,
  MapPin
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";

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
  teamMemberCount?: number;
  totalBillableUsers?: number;
  isBeta?: boolean;
  betaUser?: boolean;
  betaLifetimeAccess?: boolean;
  betaCohortNumber?: number | null;
  canUpgrade: boolean;
  canDowngrade: boolean;
}

const tiers = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'For solo operators just getting started',
    features: [
      { text: 'Unlimited quotes', included: true },
      { text: '25 jobs per month', included: true },
      { text: '25 invoices per month', included: true },
      { text: '50 clients', included: true },
      { text: 'Unlimited jobs', included: false },
      { text: 'AI-powered features', included: false },
      { text: 'SMS notifications', included: false },
      { text: 'Team management', included: false },
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
      { text: 'SMS & email reminders', included: true },
      { text: 'Custom templates & branding', included: true },
      { text: 'Automated follow-ups', included: true },
      { text: 'Team management', included: false },
    ],
    cta: 'Free During Beta',
    popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: 49,
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
    cta: 'Free During Beta',
    isContactSales: false,
    popular: false,
  },
];

const handleContactSales = () => {
  window.location.href = "mailto:support@jobrunner.com.au?subject=JobRunner%20Team%20Plan%20Enquiry&body=Hi%20JobRunner%20Team%20(AV%20Web%20Innovation)%2C%0A%0AI'm%20interested%20in%20the%20JobRunner%20Team%20plan%20for%20my%20business.%0A%0ABusiness%20Name%3A%20%0ANumber%20of%20Team%20Members%3A%20%0APhone%3A%20%0A%0AThanks!";
};

export default function SubscriptionPage() {
  const [teamSeats, setTeamSeats] = useState(2);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

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
    onSuccess: (data: { url?: string; betaAccess?: boolean; message?: string; tier?: string }) => {
      // Beta mode: access granted without Stripe
      if (data.betaAccess) {
        queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
        toast({
          title: "Beta Access Granted!",
          description: data.message || `${data.tier} access unlocked - free during beta!`,
        });
        return;
      }
      // Production mode: redirect to Stripe checkout
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
          <Badge className="bg-orange-100 text-orange-700 border-0 px-4 py-1.5">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Beta Access
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            All features free during beta
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            First 10 users get lifetime free access in exchange for a testimonial.
          </p>
          
          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-green-600" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="w-4 h-4 text-green-600" />
              <span>All features unlocked</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 text-green-600" />
              <span>Lifetime access for early adopters</span>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg capitalize">{status?.tier === 'trial' ? 'Pro' : status?.tier} Plan</h3>
                      {status?.isBeta && (
                        <Badge variant="outline" className="border-green-400 text-green-600 bg-green-50">
                          <Gift className="w-3 h-3 mr-1" />
                          Beta Access
                        </Badge>
                      )}
                      {status?.cancelAtPeriodEnd && (
                        <Badge variant="outline" className="border-red-400 text-red-600">
                          Canceling
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {status?.isBeta ? (
                        <>All features free during beta - no billing</>
                      ) : status?.nextBillingDate ? (
                        <>Next billing date: {formatDate(status.nextBillingDate)}</>
                      ) : (
                        <>Active subscription</>
                      )}
                    </p>
                    {/* Team member count for billing info */}
                    {(status?.tier === 'team' || (status?.teamMemberCount && status.teamMemberCount > 0)) && (
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {status.totalBillableUsers} billable user{status.totalBillableUsers !== 1 ? 's' : ''} 
                          <span className="text-xs ml-1">(1 owner + {status.teamMemberCount} team member{status.teamMemberCount !== 1 ? 's' : ''})</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {!status?.isBeta && (
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
                )}
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

                {/* Price after beta note */}
                {tier.id === 'pro' && !isCurrentTier(tier.id) && (
                  <p className="text-xs text-center text-muted-foreground">
                    ${tier.price} AUD/month after beta ends
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

        {/* Add-On: Dedicated Number & AI Receptionist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              Add-On: Dedicated Business Number
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Get your own Australian phone number for two-way client texting. Available on Pro and Team plans.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <MessageCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Two-Way SMS</p>
                  <p className="text-xs text-muted-foreground">Send and receive texts from clients directly in JobRunner</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Bot className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">AI Receptionist</p>
                  <p className="text-xs text-muted-foreground">AI detects job requests from incoming texts and creates leads automatically</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Link2 className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Auto-Link to Jobs</p>
                  <p className="text-xs text-muted-foreground">Messages automatically match to the right client and job</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Phone className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Your Own Number</p>
                  <p className="text-xs text-muted-foreground">Professional Australian mobile or local number just for your business</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">~$3 AUD/month + ~$0.06 per SMS</p>
                <p className="text-xs text-muted-foreground">Billed through Twilio. Cancel anytime.</p>
              </div>
              <Button 
                variant="outline"
                onClick={() => setLocation('/chat-hub')}
              >
                <Phone className="h-4 w-4 mr-1.5" />
                Set Up in Chat Hub
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Without a dedicated number, outbound customer SMS (invoices, quotes, job confirmations) is sent from the "JobRunner" sender ID. 
              A dedicated number lets customers reply directly to your business via two-way SMS.
            </p>
          </CardContent>
        </Card>

        {/* Add-On: AI Receptionist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-blue-600" />
              Add-On: AI Receptionist
              <Badge variant="outline" className="ml-auto text-xs">$60/month</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              AI-powered phone answering for your trade business. Never miss a call again — the AI answers in your business name, 
              captures leads, and transfers calls to your team when they're available.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Phone className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Dedicated Number</p>
                  <p className="text-xs text-muted-foreground">Your own Australian number — customers see your business, not JobRunner</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Bot className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">24/7 AI Answering</p>
                  <p className="text-xs text-muted-foreground">Answers calls in your business name with a natural Australian voice</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <UserCheck className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Auto Lead Capture</p>
                  <p className="text-xs text-muted-foreground">Captures caller details, job type, and urgency as new leads</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <PhoneCall className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Live Transfer</p>
                  <p className="text-xs text-muted-foreground">Transfers to available team members or takes a message if busy</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">$60 AUD/month</p>
                <p className="text-xs text-muted-foreground">Includes dedicated number, AI voice agent, call logs, and lead capture. Requires Pro or Team plan.</p>
              </div>
              <Button 
                variant="outline"
                onClick={() => setLocation('/settings')}
              >
                <Headphones className="h-4 w-4 mr-1.5" />
                Set Up AI Receptionist
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Add-On: Custom Website */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-purple-600" />
              Add-On: Custom Website
              <Badge variant="outline" className="ml-auto text-xs">Custom Quote</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We build a professional website for your trade business — mobile-friendly, SEO optimised for your local area, 
              and integrated with your JobRunner quote requests.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Globe className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Professional Design</p>
                  <p className="text-xs text-muted-foreground">Custom-built website tailored to your trade and brand</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <MapPin className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Local SEO</p>
                  <p className="text-xs text-muted-foreground">Optimised for your suburb, city, and trade keywords</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Link2 className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">JobRunner Integration</p>
                  <p className="text-xs text-muted-foreground">Quote request forms feed directly into your JobRunner pipeline</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Sparkles className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Hosting Included</p>
                  <p className="text-xs text-muted-foreground">We handle hosting, updates, and ongoing support</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Custom pricing based on your needs</p>
                <p className="text-xs text-muted-foreground">Our team will discuss your requirements and provide a tailored quote.</p>
              </div>
              <Button 
                variant="outline"
                onClick={() => {
                  window.location.href = "mailto:support@jobrunner.com.au?subject=Custom%20Website%20Enquiry&body=Hi%20JobRunner%20Team%20(AV%20Web%20Innovation)%2C%0A%0AI'm%20interested%20in%20a%20custom%20website%20for%20my%20trade%20business.%0A%0ABusiness%20Name%3A%20%0ATrade%20Type%3A%20%0ALocation%2FSuburb%3A%20%0APhone%3A%20%0A%0AAnything%20specific%20you'd%20like%3A%20%0A%0AThanks!";
                }}
              >
                <Mail className="h-4 w-4 mr-1.5" />
                Request Custom Website
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Beta Information Section */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <Sparkles className="w-5 h-5" />
              Early Adopter Program
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-600/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-green-600">1</span>
                </div>
                <div>
                  <h4 className="font-medium mb-1 text-green-900 dark:text-green-100">Sign up for free</h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    No credit card required. Get instant access to all features.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-600/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-green-600">2</span>
                </div>
                <div>
                  <h4 className="font-medium mb-1 text-green-900 dark:text-green-100">Use all Pro features</h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Unlimited jobs, quotes, invoices, AI features, and more.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-600/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-green-600">3</span>
                </div>
                <div>
                  <h4 className="font-medium mb-1 text-green-900 dark:text-green-100">Share your feedback</h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Provide a testimonial and secure lifetime free access.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-white/60 dark:bg-green-800/20 rounded-lg border border-green-200 dark:border-green-700">
              <div className="flex items-start gap-3">
                <Gift className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium mb-1 text-green-900 dark:text-green-100">Limited early adopter spots</h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    First 10 users who sign up and agree to provide a testimonial receive lifetime free access to all Pro features, 
                    even after we officially launch with paid plans.
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
              href="mailto:support@jobrunner.com.au" 
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
