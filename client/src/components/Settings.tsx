import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useTheme } from "@/components/ThemeProvider";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppMode } from "@/hooks/use-app-mode";
import { 
  Building, 
  Palette, 
  CreditCard, 
  Mail,
  Save,
  Upload,
  Crown,
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Shield,
  FileText,
  Settings as SettingsIcon,
  Loader2,
  Zap,
  Calendar,
  ExternalLink,
  TrendingUp,
  Headphones,
  Phone,
  MessageCircle
} from "lucide-react";
import { LogoUpload } from "./LogoUpload";
import { useToast } from "@/hooks/use-toast";
import DataSafetyBanner from "./DataSafetyBanner";

interface SettingsProps {
  onSave?: (data: any) => void;
  onUploadLogo?: (file: File) => void;
  onUpgradePlan?: () => void;
}

export default function Settings({
  onSave,
  onUploadLogo,
  onUpgradePlan
}: SettingsProps) {
  const { data: businessSettings, isLoading: settingsLoading } = useBusinessSettings();
  const { brandTheme, setBrandTheme } = useTheme();
  const { toast } = useToast();
  const { isTradie, isOwner, isManager, isSolo } = useAppMode();
  
  const canAccessBusinessSettings = !isTradie;
  const canAccessBilling = isOwner || isSolo;
  
  // Remember which tab the user was on - staff defaults to support
  const defaultTab = isTradie ? 'support' : 'business';
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  // Sync with localStorage on client side only (respect role restrictions)
  useEffect(() => {
    const savedTab = typeof window !== 'undefined' 
      ? localStorage.getItem('tradietrack-settings-tab') 
      : null;
    if (savedTab) {
      // Staff can only access support tab
      if (isTradie && savedTab !== 'support') {
        setActiveTab('support');
      } else if (!canAccessBilling && savedTab === 'billing') {
        setActiveTab(defaultTab);
      } else {
        setActiveTab(savedTab);
      }
    }
  }, [isTradie, canAccessBilling, defaultTab]);
  
  // Business data from API
  const [businessData, setBusinessData] = useState({
    name: "",
    abn: "",
    phone: "",
    email: "",
    address: "",
    gstEnabled: false,
    timezone: "Australia/Brisbane",
    currency: "AUD"
  });

  // Default color matches ThemeProvider's default (#3B5998 navy)
  const DEFAULT_BRAND_COLOR = "#3B5998";
  
  const [brandingData, setBrandingData] = useState({
    color: DEFAULT_BRAND_COLOR,
    invoicePrefix: "TT-",
    quotePrefix: "QT-",
    jobPrefix: "",
    customThemeEnabled: false
  });
  
  // Track if user has made local edits to branding (prevents refetch overwrite)
  const [brandingDirty, setBrandingDirty] = useState(false);

  const [paymentData, setPaymentData] = useState({
    defaultHourlyRate: 100,
    calloutFee: 80,
    quoteValidityDays: 30,
    paymentInstructions: "",
    bankDetails: "",
    lateFeeRate: "1.5% per month",
    defaultPaymentTermsDays: 14,
    quoteTerms: "",
    invoiceTerms: "",
    warrantyPeriod: "12 months"
  });

  const [notificationPreferences, setNotificationPreferences] = useState({
    quoteResponses: true,
    paymentConfirmations: true,
    overdueInvoices: true,
    weeklySummary: false
  });

  // Load real data from businessSettings - DO NOT modify theme context on load
  // Theme is managed by ThemeProvider from localStorage, only update on explicit save
  useEffect(() => {
    if (businessSettings) {
      // Always update business data
      setBusinessData({
        name: businessSettings.businessName || "",
        abn: businessSettings.abn || "",
        phone: businessSettings.phone || "",
        email: businessSettings.email || "",
        address: businessSettings.address || "",
        gstEnabled: businessSettings.gstEnabled || false,
        timezone: "Australia/Brisbane",
        currency: "AUD"
      });
      
      // Always update payment data
      setPaymentData({
        defaultHourlyRate: parseFloat(businessSettings.defaultHourlyRate) || 100,
        calloutFee: parseFloat(businessSettings.calloutFee) || 80,
        quoteValidityDays: businessSettings.quoteValidityDays || 30,
        paymentInstructions: businessSettings.paymentInstructions || "",
        bankDetails: (businessSettings as any).bankDetails || "",
        lateFeeRate: businessSettings.lateFeeRate || "1.5% per month",
        defaultPaymentTermsDays: (businessSettings as any).defaultPaymentTermsDays || 14,
        quoteTerms: (businessSettings as any).quoteTerms || "",
        invoiceTerms: (businessSettings as any).invoiceTerms || "",
        warrantyPeriod: businessSettings.warrantyPeriod || "12 months"
      });
      
      // Get server values - check both primaryColor and brandColor fields
      const serverColor = businessSettings.primaryColor || businessSettings.brandColor || DEFAULT_BRAND_COLOR;
      const serverCustomEnabled = businessSettings.customThemeEnabled || false;
      
      // Validate color is a proper hex color (6 characters after #)
      const isValidColor = serverColor && /^#[0-9A-Fa-f]{6}$/.test(serverColor);
      const safeColor = isValidColor ? serverColor : DEFAULT_BRAND_COLOR;
      
      // Only update local form state if user hasn't made edits
      // This protects unsaved form values from being overwritten
      if (!brandingDirty) {
        setBrandingData({
          color: safeColor,
          invoicePrefix: businessSettings.invoicePrefix || "TT-",
          quotePrefix: businessSettings.quotePrefix || "QT-",
          jobPrefix: businessSettings.jobPrefix || "",
          customThemeEnabled: serverCustomEnabled
        });
      }
    }
  }, [businessSettings, brandingDirty]);

  // Fetch integration status
  const { data: integrationStatus } = useQuery({
    queryKey: ['/api/integrations/status'],
    queryFn: async () => {
      const response = await fetch('/api/integrations/status');
      if (!response.ok) return { stripe: false, sendgrid: false };
      return response.json();
    }
  });

  // Fetch integration settings (includes notification preferences)
  const { data: integrationSettingsData } = useQuery<any>({
    queryKey: ['/api/integrations/settings'],
  });

  // Load notification preferences from integration settings
  useEffect(() => {
    if (integrationSettingsData) {
      setNotificationPreferences({
        quoteResponses: integrationSettingsData.notifyQuoteResponses ?? true,
        paymentConfirmations: integrationSettingsData.notifyPaymentConfirmations ?? true,
        overdueInvoices: integrationSettingsData.notifyOverdueInvoices ?? true,
        weeklySummary: integrationSettingsData.notifyWeeklySummary ?? false
      });
    }
  }, [integrationSettingsData]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/business-settings", data);
    },
    onSuccess: () => {
      // Reset dirty flag after successful save
      setBrandingDirty(false);
      queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      toast({
        title: "Settings Saved",
        description: "Your business settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Save notification preferences mutation
  const saveNotificationPreferencesMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/integrations/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/settings'] });
      toast({
        title: "Preferences Saved",
        description: "Your notification preferences have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save notification preferences.",
        variant: "destructive",
      });
    }
  });

  // Handle notification preference change
  const handleNotificationChange = (key: keyof typeof notificationPreferences, value: boolean) => {
    const newPrefs = { ...notificationPreferences, [key]: value };
    setNotificationPreferences(newPrefs);
    
    // Map to database field names
    const dbData = {
      notifyQuoteResponses: newPrefs.quoteResponses,
      notifyPaymentConfirmations: newPrefs.paymentConfirmations,
      notifyOverdueInvoices: newPrefs.overdueInvoices,
      notifyWeeklySummary: newPrefs.weeklySummary
    };
    
    saveNotificationPreferencesMutation.mutate(dbData);
  };

  const handleSave = async () => {
    const updateData = {
      businessName: businessData.name,
      abn: businessData.abn,
      phone: businessData.phone,
      email: businessData.email,
      address: businessData.address,
      gstEnabled: businessData.gstEnabled,
      primaryColor: brandingData.color,
      invoicePrefix: brandingData.invoicePrefix,
      quotePrefix: brandingData.quotePrefix,
      customThemeEnabled: brandingData.customThemeEnabled,
      defaultHourlyRate: paymentData.defaultHourlyRate.toString(),
      calloutFee: paymentData.calloutFee.toString(),
      quoteValidityDays: paymentData.quoteValidityDays,
      paymentInstructions: paymentData.paymentInstructions,
      bankDetails: paymentData.bankDetails,
      lateFeeRate: paymentData.lateFeeRate,
      defaultPaymentTermsDays: paymentData.defaultPaymentTermsDays,
      quoteTerms: paymentData.quoteTerms,
      invoiceTerms: paymentData.invoiceTerms,
      warrantyPeriod: paymentData.warrantyPeriod
    };
    
    saveSettingsMutation.mutate(updateData);
    onSave?.(updateData);
  };

  // Australian Invoice Legal Compliance Checklist
  const complianceChecklist = [
    {
      id: 'tax_invoice_label',
      label: '"TAX INVOICE" label displayed when GST enabled',
      status: businessSettings?.gstEnabled || businessData.gstEnabled ? 'pass' : 'warning',
      description: 'Required for GST-registered businesses on taxable sales over $82.50'
    },
    {
      id: 'business_identity',
      label: 'Business name/identity clearly shown',
      status: businessSettings?.businessName || businessData.name ? 'pass' : 'fail',
      description: 'Must display registered business name or individual name'
    },
    {
      id: 'abn_display',
      label: 'Australian Business Number (ABN) displayed',
      status: businessSettings?.abn || businessData.abn ? 'pass' : 'fail',
      description: 'Valid ABN required for all tax invoices'
    },
    {
      id: 'issue_date',
      label: 'Invoice issue date included',
      status: 'pass',
      description: 'Invoice creation date automatically included'
    },
    {
      id: 'item_descriptions',
      label: 'Detailed item descriptions with quantities',
      status: 'pass',
      description: 'Line items show descriptions, quantities, and individual prices'
    },
    {
      id: 'gst_calculation',
      label: 'GST amount calculated correctly (10%)',
      status: businessSettings?.gstEnabled || businessData.gstEnabled ? 'pass' : 'na',
      description: 'GST = 1/11 of GST-inclusive price, rounded to nearest cent'
    },
    {
      id: 'buyer_details',
      label: 'Customer details for invoices $1,000+',
      status: 'pass',
      description: 'Client name and contact details included for high-value invoices'
    },
    {
      id: 'payment_terms',
      label: 'Payment terms specified',
      status: paymentData.paymentInstructions ? 'pass' : 'warning',
      description: 'Clear payment terms help with debt recovery'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge variant="default" className="bg-green-100 text-green-800">Compliant</Badge>;
      case 'fail':
        return <Badge variant="destructive">Missing</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      default:
        return <Badge variant="outline">N/A</Badge>;
    }
  };

  return (
    <PageShell data-testid="settings">
      <PageHeader
        title="Settings"
        subtitle="Manage your business profile and preferences"
        action={
          <Button 
            onClick={handleSave} 
            disabled={saveSettingsMutation.isPending}
            data-testid="button-save-settings"
            style={{
              backgroundColor: 'hsl(var(--trade))',
              borderColor: 'hsl(var(--trade-border))',
              color: 'white'
            }}
          >
            {saveSettingsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        }
      />

      {/* Quick Plan Status - links to Billing tab (hidden for staff) */}
      {canAccessBilling && (
        <Card 
          className="hover-elevate cursor-pointer" 
          onClick={() => {
            setActiveTab('billing');
            localStorage.setItem('tradietrack-settings-tab', 'billing');
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                <div>
                  <p className="font-semibold">Manage Subscription</p>
                  <p className="text-sm text-muted-foreground">View plan details, usage & billing</p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs 
        value={activeTab} 
        onValueChange={(value) => {
          setActiveTab(value);
          localStorage.setItem('tradietrack-settings-tab', value);
        }} 
        className="space-y-6"
      >
        {/* Mobile-friendly horizontal scrolling tabs - filtered by role */}
        <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
          <TabsList className="inline-flex w-auto min-w-max">
            {canAccessBusinessSettings && (
              <TabsTrigger value="business" data-testid="tab-business" className="flex-shrink-0">
                <Building className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Business</span>
                <span className="sm:hidden">Biz</span>
              </TabsTrigger>
            )}
            {canAccessBusinessSettings && (
              <TabsTrigger 
                value="branding" 
                data-testid="tab-branding"
                className="flex-shrink-0"
              >
                <Palette className="h-4 w-4 mr-1.5" />
                Brand
              </TabsTrigger>
            )}
            {canAccessBusinessSettings && (
              <TabsTrigger value="payment" data-testid="tab-payment" className="flex-shrink-0">
                <CreditCard className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Payment</span>
                <span className="sm:hidden">Pay</span>
              </TabsTrigger>
            )}
            {canAccessBusinessSettings && (
              <TabsTrigger value="integrations" data-testid="tab-integrations" className="flex-shrink-0">
                <Shield className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Integrations</span>
                <span className="sm:hidden">Apps</span>
              </TabsTrigger>
            )}
            {canAccessBusinessSettings && (
              <TabsTrigger value="notifications" data-testid="tab-notifications" className="flex-shrink-0">
                <Mail className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Notifications</span>
                <span className="sm:hidden">Alerts</span>
              </TabsTrigger>
            )}
            {canAccessBilling && (
              <TabsTrigger 
                value="billing" 
                data-testid="tab-billing"
                className="flex-shrink-0"
              >
                <Crown className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Billing</span>
                <span className="sm:hidden">Plan</span>
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="support" 
              data-testid="tab-support"
              className="flex-shrink-0"
            >
              <Headphones className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Support</span>
              <span className="sm:hidden">Help</span>
            </TabsTrigger>
            {import.meta.env.DEV && canAccessBusinessSettings && (
              <TabsTrigger 
                value="developer" 
                data-testid="tab-developer"
                className="flex-shrink-0"
              >
                <Zap className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Developer</span>
                <span className="sm:hidden">Dev</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-name">Business Name</Label>
                  <Input
                    id="business-name"
                    value={businessData.name}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="input-business-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abn">ABN (Optional)</Label>
                  <Input
                    id="abn"
                    value={businessData.abn}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, abn: e.target.value }))}
                    data-testid="input-abn"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={businessData.phone}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, phone: e.target.value }))}
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={businessData.email}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, email: e.target.value }))}
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={businessData.address}
                  onChange={(e) => setBusinessData(prev => ({ ...prev, address: e.target.value }))}
                  data-testid="input-address"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>GST Registration</Label>
                  <p className="text-sm text-muted-foreground">Add GST to quotes and invoices</p>
                </div>
                <Switch
                  checked={businessData.gstEnabled}
                  onCheckedChange={(checked) => setBusinessData(prev => ({ ...prev, gstEnabled: checked }))}
                  data-testid="switch-gst"
                />
              </div>
            </CardContent>
          </Card>

          {/* Australian Legal Compliance */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
                <CardTitle>Australian Tax Invoice Compliance</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Ensure your invoices meet ATO (Australian Taxation Office) requirements for GST compliance
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {complianceChecklist.map((item) => (
                <div key={item.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(item.status)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{item.label}</h4>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              <div 
                className="mt-4 p-4 rounded-lg border"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.05)',
                  borderColor: 'hsl(var(--trade) / 0.2)'
                }}
              >
                <div className="flex items-start gap-2">
                  <FileText className="w-5 h-5 mt-0.5" style={{ color: 'hsl(var(--trade))' }} />
                  <div>
                    <h4 className="font-medium" style={{ color: 'hsl(var(--trade))' }}>Compliance Summary</h4>
                    <p className="text-sm mt-1" style={{ color: 'hsl(var(--trade) / 0.8)' }}>
                      {complianceChecklist.filter(item => item.status === 'pass').length} of{' '}
                      {complianceChecklist.filter(item => item.status !== 'na').length} requirements met.
                      {complianceChecklist.some(item => item.status === 'fail') && (
                        <span className="block mt-1 text-red-700 font-medium">
                          Please complete missing business information to ensure full compliance.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <DataSafetyBanner />
        </TabsContent>

        <TabsContent value="branding" className="space-y-6 animate-fade-in-up">
          {/* Simple App Color Picker */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                App Color
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Choose your accent color for the app. This color will be used for buttons, highlights, and other interactive elements.
                </p>
                
                {/* Color Picker */}
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    {[
                      { color: '#3B5998', name: 'Navy' },
                      { color: '#3b82f6', name: 'Blue' },
                      { color: '#10b981', name: 'Green' },
                      { color: '#8b5cf6', name: 'Purple' },
                      { color: '#f59e0b', name: 'Orange' },
                      { color: '#ef4444', name: 'Red' },
                      { color: '#ec4899', name: 'Pink' },
                      { color: '#06b6d4', name: 'Cyan' },
                      { color: '#84cc16', name: 'Lime' },
                    ].map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => {
                          setBrandingDirty(true);
                          setBrandingData(prev => ({ ...prev, color: preset.color, customThemeEnabled: true }));
                          setBrandTheme({
                            primaryColor: preset.color,
                            customThemeEnabled: true
                          });
                          // Also update localStorage immediately for faster persistence
                          localStorage.setItem('tradietrack-brand-theme', JSON.stringify({
                            primaryColor: preset.color,
                            customThemeEnabled: true
                          }));
                        }}
                        className={`w-12 h-12 rounded-xl transition-shadow duration-200 ${
                          brandingData.color === preset.color && brandingData.customThemeEnabled
                            ? 'ring-2 ring-offset-2 ring-foreground shadow-lg' 
                            : 'ring-1 ring-border'
                        }`}
                        style={{ 
                          backgroundColor: preset.color,
                          WebkitTapHighlightColor: 'transparent',
                          touchAction: 'manipulation'
                        }}
                        title={preset.name}
                        data-testid={`color-${preset.name.toLowerCase()}`}
                      />
                    ))}
                  </div>
                  
                  {/* Custom color input */}
                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex items-center gap-2 flex-1 max-w-xs">
                      <input
                        type="color"
                        value={brandingData.color}
                        onChange={(e) => {
                          setBrandingDirty(true);
                          setBrandingData(prev => ({ ...prev, color: e.target.value, customThemeEnabled: true }));
                          setBrandTheme({
                            primaryColor: e.target.value,
                            customThemeEnabled: true
                          });
                          localStorage.setItem('tradietrack-brand-theme', JSON.stringify({
                            primaryColor: e.target.value,
                            customThemeEnabled: true
                          }));
                        }}
                        className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0"
                        data-testid="input-custom-color"
                      />
                      <div className="flex-1">
                        <Label className="text-sm font-medium">Custom Color</Label>
                        <Input
                          value={brandingData.color}
                          onChange={(e) => {
                            setBrandingDirty(true);
                            setBrandingData(prev => ({ ...prev, color: e.target.value, customThemeEnabled: true }));
                            if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
                              setBrandTheme({
                                primaryColor: e.target.value,
                                customThemeEnabled: true
                              });
                              localStorage.setItem('tradietrack-brand-theme', JSON.stringify({
                                primaryColor: e.target.value,
                                customThemeEnabled: true
                              }));
                            }
                          }}
                          placeholder="#3B5998"
                          className="h-8 text-sm font-mono"
                          data-testid="input-brand-color"
                        />
                      </div>
                    </div>
                    
                    {brandingData.customThemeEnabled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBrandingDirty(true);
                          setBrandingData(prev => ({ ...prev, color: '#3B5998', customThemeEnabled: false }));
                          setBrandTheme({
                            primaryColor: '#3B5998',
                            customThemeEnabled: false
                          });
                          // Also update localStorage immediately for consistency
                          localStorage.setItem('tradietrack-brand-theme', JSON.stringify({
                            primaryColor: '#3B5998',
                            customThemeEnabled: false
                          }));
                        }}
                        className="text-muted-foreground"
                        data-testid="button-reset-color"
                      >
                        Reset to Default
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Preview */}
                {brandingData.customThemeEnabled && (
                  <div className="pt-4 border-t animate-fade-in">
                    <p className="text-xs text-muted-foreground mb-3">Preview</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Button style={{ backgroundColor: brandingData.color }} className="text-white">
                        Primary Button
                      </Button>
                      <Badge style={{ backgroundColor: brandingData.color }} className="text-white">
                        Badge
                      </Badge>
                      <div 
                        className="h-2 w-24 rounded-full" 
                        style={{ backgroundColor: brandingData.color }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Logo Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Business Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <LogoUpload 
                currentLogoUrl={businessSettings?.logoUrl}
                onColorsDetected={(colors) => {
                  if (colors.length > 0) {
                    const primaryColor = colors[0];
                    setBrandingDirty(true);
                    setBrandingData(prev => ({ 
                      ...prev, 
                      color: primaryColor,
                      customThemeEnabled: true
                    }));
                    setBrandTheme({
                      primaryColor: primaryColor,
                      customThemeEnabled: true
                    });
                    toast({
                      title: "Color Detected",
                      description: "Your app color has been updated to match your logo.",
                    });
                  }
                }}
              />
            </CardContent>
          </Card>

          {/* Document Prefixes */}
          <Card>
            <CardHeader>
              <CardTitle>Document Prefixes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice-prefix">Invoice Prefix</Label>
                  <Input
                    id="invoice-prefix"
                    value={brandingData.invoicePrefix}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, invoicePrefix: e.target.value }));
                    }}
                    placeholder="INV-"
                    data-testid="input-invoice-prefix"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="quote-prefix">Quote Prefix</Label>
                  <Input
                    id="quote-prefix"
                    value={brandingData.quotePrefix}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, quotePrefix: e.target.value }));
                    }}
                    placeholder="QT-"
                    data-testid="input-quote-prefix"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="job-prefix">Job Prefix</Label>
                  <Input
                    id="job-prefix"
                    value={brandingData.jobPrefix || ''}
                    onChange={(e) => {
                      setBrandingDirty(true);
                      setBrandingData(prev => ({ ...prev, jobPrefix: e.target.value }));
                    }}
                    placeholder="JOB-"
                    data-testid="input-job-prefix"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hourly-rate">Default Hourly Rate ($)</Label>
                  <Input
                    id="hourly-rate"
                    type="number"
                    value={paymentData.defaultHourlyRate}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, defaultHourlyRate: Number(e.target.value) }))}
                    data-testid="input-hourly-rate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="callout-fee">Callout Fee ($)</Label>
                  <Input
                    id="callout-fee"
                    type="number"
                    value={paymentData.calloutFee}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, calloutFee: Number(e.target.value) }))}
                    data-testid="input-callout-fee"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote-validity">Quote Validity (Days)</Label>
                  <Input
                    id="quote-validity"
                    type="number"
                    value={paymentData.quoteValidityDays}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, quoteValidityDays: Number(e.target.value) }))}
                    data-testid="input-quote-validity"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-instructions">Payment Instructions</Label>
                <textarea
                  id="payment-instructions"
                  className="w-full min-h-[100px] p-3 text-sm rounded-md border border-input bg-background"
                  value={paymentData.paymentInstructions}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, paymentInstructions: e.target.value }))}
                  placeholder="Bank details, PayID, or other payment instructions..."
                  data-testid="textarea-payment-instructions"
                />
                <p className="text-xs text-muted-foreground">
                  These instructions will appear on invoices and quotes
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank-details">Bank Account Details</Label>
                <textarea
                  id="bank-details"
                  className="w-full min-h-[80px] p-3 text-sm rounded-md border border-input bg-background"
                  value={paymentData.bankDetails}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, bankDetails: e.target.value }))}
                  placeholder="BSB: 000-000&#10;Account: 12345678&#10;Account Name: Your Business Name"
                  data-testid="textarea-bank-details"
                />
                <p className="text-xs text-muted-foreground">
                  Bank transfer details shown on invoices
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment-terms-days">Payment Due (Days)</Label>
                  <Input
                    id="payment-terms-days"
                    type="number"
                    value={paymentData.defaultPaymentTermsDays}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, defaultPaymentTermsDays: Number(e.target.value) }))}
                    data-testid="input-payment-terms-days"
                  />
                  <p className="text-xs text-muted-foreground">Default due date for invoices</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="late-fee-rate">Late Fee Rate</Label>
                  <Input
                    id="late-fee-rate"
                    value={paymentData.lateFeeRate}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, lateFeeRate: e.target.value }))}
                    placeholder="1.5% per month"
                    data-testid="input-late-fee-rate"
                  />
                  <p className="text-xs text-muted-foreground">Interest on overdue invoices</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warranty-period">Warranty Period</Label>
                  <Input
                    id="warranty-period"
                    value={paymentData.warrantyPeriod}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, warrantyPeriod: e.target.value }))}
                    placeholder="12 months"
                    data-testid="input-warranty-period"
                  />
                  <p className="text-xs text-muted-foreground">Default warranty on work</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Document Terms & Conditions
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Legal terms that appear on your quotes and invoices. These protect your business.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="quote-terms">Quote Terms & Conditions</Label>
                <textarea
                  id="quote-terms"
                  className="w-full min-h-[150px] p-3 text-sm rounded-md border border-input bg-background font-mono"
                  value={paymentData.quoteTerms}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, quoteTerms: e.target.value }))}
                  placeholder="1. ACCEPTANCE: This quote is valid for 30 days from the date of issue.&#10;2. PAYMENT: A deposit may be required before work commences.&#10;3. VARIATIONS: Any variations must be agreed in writing.&#10;4. WARRANTY: Work is guaranteed for 12 months from completion."
                  data-testid="textarea-quote-terms"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use our standard Australian trade terms. Custom terms will replace the defaults.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-terms">Invoice Terms & Conditions</Label>
                <textarea
                  id="invoice-terms"
                  className="w-full min-h-[150px] p-3 text-sm rounded-md border border-input bg-background font-mono"
                  value={paymentData.invoiceTerms}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, invoiceTerms: e.target.value }))}
                  placeholder="1. PAYMENT TERMS: Payment is due within 14 days of invoice date.&#10;2. LATE PAYMENT: Overdue accounts incur interest at 1.5% per month.&#10;3. DISPUTES: Disputes must be raised within 7 days.&#10;4. OWNERSHIP: Goods remain supplier's property until paid in full."
                  data-testid="textarea-invoice-terms"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use our standard terms. Your late fee rate will be automatically included.
                </p>
              </div>

              <div 
                className="p-4 rounded-lg border"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.05)',
                  borderColor: 'hsl(var(--trade) / 0.2)'
                }}
              >
                <p className="text-sm" style={{ color: 'hsl(var(--trade) / 0.9)' }}>
                  <strong>Legal Note:</strong> These terms help protect your business and set clear expectations with clients.
                  For complex projects, consider having a lawyer review your terms. TradieTrack's default terms cover
                  common Australian trade business requirements including acceptance, payment, variations, and warranty.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Services</CardTitle>
              <p className="text-sm text-muted-foreground">
                These services are included with TradieTrack - no setup required from you
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Explanation */}
              <div 
                className="p-4 rounded-lg border"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.05)',
                  borderColor: 'hsl(var(--trade) / 0.2)'
                }}
              >
                <p className="text-sm" style={{ color: 'hsl(var(--trade) / 0.9)' }}>
                  TradieTrack handles all the technical integrations for you. These services work automatically 
                  when you send quotes, invoices, and receive payments.
                </p>
              </div>
              
              {/* Services Overview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'hsl(var(--trade))' }}
                    >
                      <CreditCard className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Payment Processing</p>
                      <p className="text-xs text-muted-foreground">Accept card payments on invoices</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">Included</Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <Mail className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Email Delivery</p>
                      <p className="text-xs text-muted-foreground">Professional email for quotes & invoices</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">Included</Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                      <Shield className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">SMS Alerts</p>
                      <p className="text-xs text-muted-foreground">Text notifications for your clients</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">Included</Badge>
                </div>
              </div>

              {/* Link to full Integrations page */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">Advanced Settings</p>
                    <p className="text-sm text-muted-foreground">
                      Test connections and configure automation options
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = '/integrations'}
                    data-testid="button-manage-integrations"
                  >
                    Open Integrations
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Quote Responses</Label>
                    <p className="text-sm text-muted-foreground">Get notified when clients accept or reject quotes</p>
                  </div>
                  <Switch 
                    checked={notificationPreferences.quoteResponses}
                    onCheckedChange={(checked) => handleNotificationChange('quoteResponses', checked)}
                    disabled={saveNotificationPreferencesMutation.isPending}
                    data-testid="switch-quote-notifications" 
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Payment Confirmations</Label>
                    <p className="text-sm text-muted-foreground">Get notified when payments are received</p>
                  </div>
                  <Switch 
                    checked={notificationPreferences.paymentConfirmations}
                    onCheckedChange={(checked) => handleNotificationChange('paymentConfirmations', checked)}
                    disabled={saveNotificationPreferencesMutation.isPending}
                    data-testid="switch-payment-notifications" 
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Overdue Invoices</Label>
                    <p className="text-sm text-muted-foreground">Get reminded about overdue invoices</p>
                  </div>
                  <Switch 
                    checked={notificationPreferences.overdueInvoices}
                    onCheckedChange={(checked) => handleNotificationChange('overdueInvoices', checked)}
                    disabled={saveNotificationPreferencesMutation.isPending}
                    data-testid="switch-overdue-notifications" 
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Weekly Summary</Label>
                    <p className="text-sm text-muted-foreground">Receive a weekly business summary email</p>
                  </div>
                  <Switch 
                    checked={notificationPreferences.weeklySummary}
                    onCheckedChange={(checked) => handleNotificationChange('weeklySummary', checked)}
                    disabled={saveNotificationPreferencesMutation.isPending}
                    data-testid="switch-weekly-summary" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <BillingTabContent />

        {/* Support Tab */}
        <SupportTab />

        {/* Developer Tab - only in development mode */}
        {import.meta.env.DEV && (
          <TabsContent value="developer" className="space-y-6">
            <DeveloperTab />
          </TabsContent>
        )}
      </Tabs>
    </PageShell>
  );
}

// Billing Tab Content Component
function BillingTabContent() {
  const { toast } = useToast();
  
  // Fetch billing status
  const { data: billingStatus, isLoading: billingLoading } = useQuery<{
    tier: 'free' | 'pro';
    status: 'active' | 'past_due' | 'canceled' | 'none' | 'trialing';
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }>({
    queryKey: ['/api/billing/status'],
  });

  // Fetch usage info
  const { data: usageInfo } = useQuery<{
    jobs: { used: number; limit: number; remaining: number };
    invoices: { used: number; limit: number; remaining: number };
    quotes: { used: number; limit: number; remaining: number };
    clients: { used: number; limit: number; remaining: number };
    templates: { used: number; limit: number; remaining: number };
    isUnlimited: boolean;
  }>({
    queryKey: ['/api/subscription/usage'],
  });

  // Create checkout session mutation
  const createCheckoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/checkout");
      return res.json();
    },
    onSuccess: (data: { url?: string; sessionId?: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Could not start checkout. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/cancel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/status'] });
      toast({
        title: "Subscription Canceled",
        description: "Your subscription will end at the current billing period.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cancel Failed",
        description: error.message || "Could not cancel subscription.",
        variant: "destructive",
      });
    }
  });

  // Resume subscription mutation
  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/resume");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/status'] });
      toast({
        title: "Subscription Resumed",
        description: "Your subscription has been reactivated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Resume Failed",
        description: error.message || "Could not resume subscription.",
        variant: "destructive",
      });
    }
  });

  // Open billing portal mutation
  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal");
      return res.json();
    },
    onSuccess: (data: { url?: string }) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error: any) => {
      toast({
        title: "Portal Error",
        description: error.message || "Could not open billing portal.",
        variant: "destructive",
      });
    }
  });

  const isPro = billingStatus?.tier === 'pro';
  const isTrialing = billingStatus?.status === 'trialing';
  const isCanceled = billingStatus?.cancelAtPeriodEnd === true;
  const periodEnd = billingStatus?.currentPeriodEnd ? new Date(billingStatus.currentPeriodEnd) : null;

  return (
    <TabsContent value="billing" className="space-y-6">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            Your Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {billingLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Plan Status */}
              <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'hsl(var(--trade)/0.1)' }}>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--trade))' }}>
                    <Crown className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      {isPro ? 'Pro Plan' : 'Free Plan'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {isPro 
                        ? isTrialing 
                          ? 'Free trial active' 
                          : isCanceled 
                            ? 'Cancels at period end' 
                            : '$39/month' 
                        : 'Limited features'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {isPro ? (
                    <Badge 
                      variant="default" 
                      style={{ backgroundColor: isTrialing ? 'hsl(var(--warning))' : isCanceled ? 'hsl(var(--muted-foreground))' : 'hsl(var(--success))' }}
                    >
                      {isTrialing ? 'Trial' : isCanceled ? 'Canceling' : 'Active'}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Free</Badge>
                  )}
                  {periodEnd && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {isCanceled ? 'Ends' : 'Renews'}: {periodEnd.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>

              {/* Pro Features List */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Pro Features Include</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { icon: Zap, text: 'Unlimited jobs, quotes & invoices' },
                    { icon: TrendingUp, text: 'AI-powered suggestions' },
                    { icon: Palette, text: 'Custom branding & theming' },
                    { icon: Calendar, text: 'Team management & permissions' },
                    { icon: Mail, text: 'Automated email reminders' },
                    { icon: Shield, text: 'Priority support' },
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <feature.icon className={`h-4 w-4 ${isPro ? 'text-green-600' : 'text-muted-foreground'}`} />
                      <span className={isPro ? '' : 'text-muted-foreground'}>{feature.text}</span>
                      {!isPro && <Badge variant="outline" className="text-xs ml-auto">Pro</Badge>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <Separator />
              <div className="flex flex-wrap gap-3">
                {!isPro ? (
                  <Button
                    onClick={() => createCheckoutMutation.mutate()}
                    disabled={createCheckoutMutation.isPending}
                    style={{ backgroundColor: 'hsl(var(--trade))', borderColor: 'hsl(var(--trade-border))' }}
                    data-testid="button-upgrade"
                  >
                    {createCheckoutMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Crown className="h-4 w-4 mr-2" />
                        Upgrade to Pro - $39/month
                      </>
                    )}
                  </Button>
                ) : isCanceled ? (
                  <Button
                    onClick={() => resumeMutation.mutate()}
                    disabled={resumeMutation.isPending}
                    style={{ backgroundColor: 'hsl(var(--trade))', borderColor: 'hsl(var(--trade-border))' }}
                    data-testid="button-resume"
                  >
                    {resumeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Resume Subscription
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    data-testid="button-cancel"
                  >
                    {cancelMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Cancel Subscription
                  </Button>
                )}
                
                {billingStatus?.stripeCustomerId && (
                  <Button
                    variant="outline"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    data-testid="button-manage-billing"
                  >
                    {portalMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Manage Billing
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            This Month's Usage
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {usageInfo?.isUnlimited 
              ? 'Unlimited usage with Pro plan' 
              : 'Usage resets at the start of each month'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usageInfo && (
              <>
                <UsageBar label="Jobs" used={usageInfo.jobs.used} limit={usageInfo.jobs.limit} />
                <UsageBar label="Quotes" used={usageInfo.quotes.used} limit={usageInfo.quotes.limit} />
                <UsageBar label="Invoices" used={usageInfo.invoices.used} limit={usageInfo.invoices.limit} />
                <UsageBar label="Clients" used={usageInfo.clients.used} limit={usageInfo.clients.limit} />
                <UsageBar label="Templates" used={usageInfo.templates.used} limit={usageInfo.templates.limit} />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

// Support Tab Component
function SupportTab() {
  return (
    <TabsContent value="support" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Need Help?
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Get in touch with our team for any questions or issues with TradieTrack
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Phone Support */}
            <div className="p-4 rounded-lg border-2 hover-elevate">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold">Call or Text</h3>
                  <p className="text-sm text-muted-foreground">
                    Quick questions? Give us a call or send a text.
                  </p>
                  <a 
                    href="tel:0458300051" 
                    className="text-lg font-medium text-primary hover:underline block mt-2"
                    data-testid="link-support-phone"
                  >
                    0458 300 051
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Available Mon-Fri 8am-6pm AEST
                  </p>
                </div>
              </div>
            </div>

            {/* Email Support */}
            <div className="p-4 rounded-lg border-2 hover-elevate">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold">Email Us</h3>
                  <p className="text-sm text-muted-foreground">
                    For detailed questions or feature requests.
                  </p>
                  <a 
                    href="mailto:admin@avwebinnovation.com" 
                    className="text-lg font-medium text-primary hover:underline block mt-2"
                    data-testid="link-support-email"
                  >
                    admin@avwebinnovation.com
                  </a>
                  <p className="text-xs text-muted-foreground">
                    We usually reply within 24 hours
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* FAQ / Common Issues */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Common Questions
            </h3>
            <div className="space-y-3" data-testid="support-faq-list">
              <div className="p-4 rounded-lg bg-muted/50" data-testid="faq-email-issues">
                <p className="font-medium text-sm">Email not sending?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Check Settings → Integrations to make sure your email is connected. If you're still having issues, contact us and we'll help you sort it out.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50" data-testid="faq-stripe-issues">
                <p className="font-medium text-sm">Stripe payments not working?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Make sure you've completed Stripe Connect setup in Settings → Integrations. If the status shows as pending, you may need to finish verification with Stripe.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50" data-testid="faq-feature-request">
                <p className="font-medium text-sm">Feature request or bug report?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We love feedback! Email us your ideas or any bugs you find. We're always working to make TradieTrack better for Aussie tradies.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* About TradieTrack */}
          <div className="text-center space-y-2 py-4">
            <p className="text-sm text-muted-foreground">
              TradieTrack is built by AV Web Innovation
            </p>
            <p className="text-xs text-muted-foreground">
              Made in Australia for Australian tradies
            </p>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

// Developer Tab Component
function DeveloperTab() {
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const response = await fetch('/api/dev/seed-mock-data', {
        method: 'POST',
        credentials: 'include'
      });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Mock Data Created",
          description: `Created ${result.results?.clients || 0} clients, ${result.results?.jobs || 0} jobs, ${result.results?.quotes || 0} quotes, ${result.results?.invoices || 0} invoices`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      } else {
        toast({
          title: "Already Seeded",
          description: result.message || "Mock data already exists",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to seed mock data",
        variant: "destructive"
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to delete ALL your data? This cannot be undone!')) {
      return;
    }
    
    setIsClearing(true);
    try {
      const response = await fetch('/api/dev/clear-data', {
        method: 'POST',
        credentials: 'include'
      });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Data Cleared",
          description: "All clients, jobs, quotes, and invoices have been deleted",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to clear data",
        variant: "destructive"
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Test Data
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate realistic Australian test data to explore all features
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <h4 className="font-medium">Generate Mock Data</h4>
            <p className="text-sm text-muted-foreground">
              Creates realistic test data including 15 clients, 20 jobs, 8 quotes, and 12 invoices 
              with Australian addresses and phone numbers. Great for testing the full workflow!
            </p>
            <Button
              onClick={handleSeedData}
              disabled={isSeeding}
              style={{ backgroundColor: 'hsl(var(--trade))', borderColor: 'hsl(var(--trade-border))' }}
              data-testid="button-seed-data"
            >
              {isSeeding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Generate Test Data
                </>
              )}
            </Button>
          </div>

          <Separator />

          <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg space-y-3">
            <h4 className="font-medium text-red-700 dark:text-red-400">Danger Zone</h4>
            <p className="text-sm text-muted-foreground">
              Delete ALL clients, jobs, quotes, and invoices. This action cannot be undone!
            </p>
            <Button
              variant="destructive"
              onClick={handleClearData}
              disabled={isClearing}
              data-testid="button-clear-data"
            >
              {isClearing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Delete All Data
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// Usage Bar Component
function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && used >= limit;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className={isAtLimit ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
          {used} / {isUnlimited ? '∞' : limit}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${
            isAtLimit 
              ? 'bg-red-500' 
              : isNearLimit 
                ? 'bg-yellow-500' 
                : 'bg-green-500'
          }`}
          style={{ width: isUnlimited ? '0%' : `${percentage}%` }}
        />
      </div>
    </div>
  );
}