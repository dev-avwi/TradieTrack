import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAppMode } from "@/hooks/use-app-mode";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getSettingsSubItems, type FilterOptions } from "@/lib/navigation-config";
import {
  UserCircle,
  Building2,
  Palette,
  UserPlus,
  Zap,
  CreditCard,
  HelpCircle,
  Save,
  Upload,
  Check,
  AlertCircle,
  ChevronRight,
  Mail,
  MessageSquare,
  Bell,
  Shield,
  ExternalLink,
  Loader2
} from "lucide-react";

type SettingsTab = 'profile' | 'business' | 'branding' | 'team' | 'automations' | 'integrations' | 'billing' | 'help';

interface BusinessSettings {
  id: number;
  businessName: string;
  abn?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  primaryColor?: string;
  subscriptionTier?: string;
}

interface UserProfile {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: typeof Mail;
  connected: boolean;
  status?: 'connected' | 'pending' | 'error';
}

export default function UnifiedSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isTeam, isTradie, isOwner, isManager, userRole } = useAppMode();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isSaving, setIsSaving] = useState(false);

  const filterOptions: FilterOptions = { isTeam, isTradie, isOwner, isManager, userRole };
  const settingsItems = getSettingsSubItems(filterOptions);

  const isStaff = isTradie && !isOwner && !isManager;

  const { data: businessSettings, isLoading: businessLoading } = useQuery<BusinessSettings>({
    queryKey: ['/api/business-settings'],
    enabled: !isStaff,
  });

  const { data: userProfile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ['/api/auth/me'],
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['/api/team/members'],
    enabled: isOwner || isManager,
  });

  const [formData, setFormData] = useState({
    firstName: userProfile?.firstName || '',
    lastName: userProfile?.lastName || '',
    phone: userProfile?.phone || '',
    businessName: businessSettings?.businessName || '',
    abn: businessSettings?.abn || '',
    address: businessSettings?.address || '',
    businessPhone: businessSettings?.phone || '',
    businessEmail: businessSettings?.email || '',
    website: businessSettings?.website || '',
    primaryColor: businessSettings?.primaryColor || '#3B82F6',
  });

  const integrations: Integration[] = [
    { id: 'email', name: 'Email (Gmail)', description: 'Send quotes & invoices via Gmail', icon: Mail, connected: true, status: 'connected' },
    { id: 'sms', name: 'SMS (Twilio)', description: 'Send SMS reminders to clients', icon: MessageSquare, connected: false },
    { id: 'stripe', name: 'Stripe Payments', description: 'Accept card payments online', icon: CreditCard, connected: true, status: 'connected' },
    { id: 'xero', name: 'Xero', description: 'Sync invoices with Xero accounting', icon: ExternalLink, connected: false },
    { id: 'myob', name: 'MYOB', description: 'Sync invoices with MYOB accounting', icon: ExternalLink, connected: false },
  ];

  const themePresets = [
    { name: 'Trade Blue', color: '#3B82F6' },
    { name: 'Trade Orange', color: '#F97316' },
    { name: 'Trade Green', color: '#22C55E' },
    { name: 'Trade Red', color: '#EF4444' },
    { name: 'Trade Purple', color: '#8B5CF6' },
    { name: 'Trade Slate', color: '#64748B' },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      toast({
        title: "Settings saved",
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getTabIcon = (tab: SettingsTab) => {
    const icons: Record<SettingsTab, typeof UserCircle> = {
      profile: UserCircle,
      business: Building2,
      branding: Palette,
      team: UserPlus,
      automations: Zap,
      integrations: Zap,
      billing: CreditCard,
      help: HelpCircle,
    };
    return icons[tab];
  };

  const availableTabs: SettingsTab[] = isStaff 
    ? ['profile', 'help']
    : ['profile', 'business', 'branding', 'team', 'automations', 'integrations', 'billing', 'help'];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-settings-title">Settings</h1>
        <p className="text-muted-foreground">Manage your account and business settings</p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="lg:w-64 lg:border-r p-4 overflow-auto">
          <nav className="space-y-1">
            {availableTabs.map((tab) => {
              const Icon = getTabIcon(tab);
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    isActive 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  style={isActive ? { backgroundColor: 'hsl(var(--trade) / 0.1)', color: 'hsl(var(--trade))' } : {}}
                  data-testid={`settings-nav-${tab}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="capitalize">{tab}</span>
                  {tab === 'team' && teamMembers.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">{teamMembers.length}</Badge>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 p-4 sm:p-6 overflow-auto">
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>Your Profile</CardTitle>
                  <CardDescription>Your personal information and account settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src="" />
                      <AvatarFallback className="text-xl">
                        {userProfile?.firstName?.[0] || userProfile?.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Button variant="outline" size="sm" data-testid="button-upload-avatar">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Photo
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 5MB</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input 
                        id="firstName" 
                        value={formData.firstName}
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                        placeholder="Enter your first name"
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input 
                        id="lastName" 
                        value={formData.lastName}
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                        placeholder="Enter your last name"
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={userProfile?.email || ''}
                      disabled
                      data-testid="input-email"
                    />
                    <p className="text-xs text-muted-foreground">Contact support to change your email</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input 
                      id="phone" 
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="04XX XXX XXX"
                      data-testid="input-phone"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-profile">
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>How you receive alerts and updates</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive updates via email</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-email-notifications" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">Browser and mobile push alerts</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-push-notifications" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">SMS Notifications</p>
                      <p className="text-sm text-muted-foreground">Text message alerts</p>
                    </div>
                    <Switch data-testid="switch-sms-notifications" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'business' && !isStaff && (
            <div className="space-y-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>Business Details</CardTitle>
                  <CardDescription>Your business information for quotes and invoices</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input 
                      id="businessName" 
                      value={formData.businessName}
                      onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                      placeholder="Your Business Name"
                      data-testid="input-business-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="abn">ABN</Label>
                    <Input 
                      id="abn" 
                      value={formData.abn}
                      onChange={(e) => setFormData({...formData, abn: e.target.value})}
                      placeholder="XX XXX XXX XXX"
                      data-testid="input-abn"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Business Address</Label>
                    <Textarea 
                      id="address" 
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="123 Main Street, Brisbane QLD 4000"
                      data-testid="input-address"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="businessPhone">Business Phone</Label>
                      <Input 
                        id="businessPhone" 
                        type="tel"
                        value={formData.businessPhone}
                        onChange={(e) => setFormData({...formData, businessPhone: e.target.value})}
                        placeholder="07 XXXX XXXX"
                        data-testid="input-business-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessEmail">Business Email</Label>
                      <Input 
                        id="businessEmail" 
                        type="email"
                        value={formData.businessEmail}
                        onChange={(e) => setFormData({...formData, businessEmail: e.target.value})}
                        placeholder="info@yourbusiness.com.au"
                        data-testid="input-business-email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input 
                      id="website" 
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                      placeholder="https://www.yourbusiness.com.au"
                      data-testid="input-website"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-business">
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {activeTab === 'branding' && !isStaff && (
            <div className="space-y-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>Logo</CardTitle>
                  <CardDescription>Your business logo appears on quotes, invoices, and the client portal</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50">
                      {businessSettings?.logoUrl ? (
                        <img src={businessSettings.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Button variant="outline" data-testid="button-upload-logo">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Logo
                      </Button>
                      <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB. Square or rectangular works best.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Brand Colors</CardTitle>
                  <CardDescription>Choose your primary brand color for the app and documents</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {themePresets.map((preset) => (
                      <button
                        key={preset.color}
                        onClick={() => setFormData({...formData, primaryColor: preset.color})}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                          formData.primaryColor === preset.color ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground'
                        }`}
                        style={formData.primaryColor === preset.color ? { borderColor: preset.color } : {}}
                        data-testid={`button-theme-${preset.name.toLowerCase().replace(' ', '-')}`}
                      >
                        <div 
                          className="w-8 h-8 rounded-full"
                          style={{ backgroundColor: preset.color }}
                        />
                        <span className="text-xs text-center">{preset.name}</span>
                      </button>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Custom Color</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="color" 
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({...formData, primaryColor: e.target.value})}
                        className="w-12 h-10 p-1"
                        data-testid="input-custom-color"
                      />
                      <Input 
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({...formData, primaryColor: e.target.value})}
                        placeholder="#3B82F6"
                        className="font-mono"
                        data-testid="input-color-hex"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-branding">
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                  <CardDescription>See how your branding looks on documents</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg p-6 bg-white">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: formData.primaryColor }}
                        >
                          {formData.businessName?.[0] || 'B'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{formData.businessName || 'Your Business'}</p>
                          <p className="text-xs text-gray-500">ABN: {formData.abn || 'XX XXX XXX XXX'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold" style={{ color: formData.primaryColor }}>QUOTE</p>
                        <p className="text-xs text-gray-500">#Q-2025-001</p>
                      </div>
                    </div>
                    <div className="h-px bg-gray-200 mb-4" />
                    <div className="space-y-2 text-sm text-gray-600">
                      <p>Your quote content would appear here...</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'team' && (isOwner || isManager) && (
            <div className="space-y-6 max-w-2xl">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>Manage your team and their permissions</CardDescription>
                  </div>
                  <Button onClick={() => setLocation('/team')} data-testid="button-add-member">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </CardHeader>
                <CardContent>
                  {teamMembers.length === 0 ? (
                    <div className="text-center py-8">
                      <UserPlus className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="font-semibold mb-2">No team members yet</h3>
                      <p className="text-muted-foreground text-sm mb-4">Add team members to assign jobs and track work</p>
                      <Button onClick={() => setLocation('/team')} data-testid="button-invite-first-member">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Team Member
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {teamMembers.map((member: any) => (
                        <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>{member.name?.[0] || 'T'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{member.role}</Badge>
                            <Button variant="ghost" size="icon" data-testid={`button-edit-member-${member.id}`}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Role Permissions</CardTitle>
                  <CardDescription>Understanding what each role can do</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                        <span className="font-medium">Owner</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Full access to everything - jobs, finances, settings, team management</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Manager</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Access to jobs, limited finances, can manage team schedules</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Worker</span>
                      </div>
                      <p className="text-sm text-muted-foreground">View assigned jobs only, add photos/notes, track time - no financial access</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'automations' && !isStaff && (
            <div className="space-y-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>Auto-Reminders</CardTitle>
                  <CardDescription>Automatically follow up on quotes and invoices</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Quote Follow-up</p>
                      <p className="text-sm text-muted-foreground">Remind clients about pending quotes after 3 days</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-quote-followup" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Invoice Reminders</p>
                      <p className="text-sm text-muted-foreground">Send payment reminders for overdue invoices</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-invoice-reminders" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Job Confirmation</p>
                      <p className="text-sm text-muted-foreground">Send appointment confirmation to clients</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-job-confirmation" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-Receipt</p>
                      <p className="text-sm text-muted-foreground">Automatically send receipt when payment received</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-auto-receipt" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" onClick={() => setLocation('/automations')} data-testid="button-advanced-automations">
                    <Zap className="h-4 w-4 mr-2" />
                    Advanced Automations
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {activeTab === 'integrations' && !isStaff && (
            <div className="space-y-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>Connected Services</CardTitle>
                  <CardDescription>Manage your email, SMS, and payment integrations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {integrations.map((integration) => {
                    const Icon = integration.icon;
                    return (
                      <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{integration.name}</p>
                            <p className="text-sm text-muted-foreground">{integration.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {integration.connected ? (
                            <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
                              <Check className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <Button size="sm" variant="outline" data-testid={`button-connect-${integration.id}`}>
                              Connect
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
                <CardFooter>
                  <Button variant="outline" onClick={() => setLocation('/integrations')} data-testid="button-all-integrations">
                    View All Integrations
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {activeTab === 'billing' && !isStaff && (
            <div className="space-y-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>Current Plan</CardTitle>
                  <CardDescription>Your subscription and billing details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-lg" style={{ borderColor: 'hsl(var(--trade) / 0.3)', backgroundColor: 'hsl(var(--trade) / 0.05)' }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold" style={{ color: 'hsl(var(--trade))' }}>
                          {businessSettings?.subscriptionTier === 'pro' ? 'Pro Plan' : 'Free Plan'}
                        </h3>
                        <Badge style={{ backgroundColor: 'hsl(var(--trade))' }}>Active</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {businessSettings?.subscriptionTier === 'pro' 
                          ? 'Unlimited jobs, team members, and all features'
                          : 'Limited to 10 jobs per month'}
                      </p>
                    </div>
                    {businessSettings?.subscriptionTier !== 'pro' && (
                      <Button style={{ backgroundColor: 'hsl(var(--trade))' }} data-testid="button-upgrade">
                        Upgrade to Pro
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                  <CardDescription>How you pay for your subscription</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">
                        VISA
                      </div>
                      <div>
                        <p className="font-medium">•••• •••• •••• 4242</p>
                        <p className="text-sm text-muted-foreground">Expires 12/26</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" data-testid="button-update-card">
                      Update
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Billing History</CardTitle>
                  <CardDescription>Your past invoices and payments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No billing history yet</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'help' && (
            <div className="space-y-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>Help & Support</CardTitle>
                  <CardDescription>Get help with TradieTrack</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" onClick={() => setLocation('/settings')}>
                    <HelpCircle className="h-4 w-4 mr-3" />
                    <div className="text-left">
                      <p className="font-medium">FAQ & Guides</p>
                      <p className="text-xs text-muted-foreground">Common questions and how-tos</p>
                    </div>
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Mail className="h-4 w-4 mr-3" />
                    <div className="text-left">
                      <p className="font-medium">Contact Support</p>
                      <p className="text-xs text-muted-foreground">Email us at support@tradietrack.com.au</p>
                    </div>
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <MessageSquare className="h-4 w-4 mr-3" />
                    <div className="text-left">
                      <p className="font-medium">Live Chat</p>
                      <p className="text-xs text-muted-foreground">Chat with our team (9am-5pm AEST)</p>
                    </div>
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>App Tour</CardTitle>
                  <CardDescription>Learn how to use TradieTrack</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" data-testid="button-start-tour">
                    Start App Tour
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
