import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, AlertCircle, CreditCard, FileText, Clock } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

interface InvoiceData {
  id: string;
  number: string;
  title: string;
  status: string;
  total: string;
  subtotal: string;
  gstAmount: string;
  dueDate?: string;
  allowOnlinePayment: boolean;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }>;
  client: {
    name: string;
  };
  business: {
    name: string;
    logo?: string;
    abn?: string;
  };
  paid?: boolean;
  message?: string;
}

interface PaymentRequestData {
  id: string;
  amount: string;
  gstAmount: string;
  description: string;
  reference: string | null;
  status: string;
  expiresAt: string | null;
  businessName: string;
  businessLogo?: string;
  brandColor: string;
}

function PaymentForm({ 
  clientSecret, 
  onSuccess, 
  onError 
}: { 
  clientSecret: string; 
  onSuccess: () => void; 
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || "Payment failed");
      onError(error.message || "Payment failed");
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      {errorMessage && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {errorMessage}
        </div>
      )}
      
      <Button 
        type="submit" 
        className="w-full" 
        size="lg"
        disabled={!stripe || isProcessing}
        data-testid="button-pay-now"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Pay Now
          </>
        )}
      </Button>
    </form>
  );
}

function InvoicePaymentView({ 
  token, 
  invoiceData, 
  isLoading, 
  error 
}: { 
  token: string;
  invoiceData: InvoiceData | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);

  const createPaymentIntentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/public/invoice/${token}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      if (data.publishableKey) {
        setStripePromise(loadStripe(data.publishableKey));
      }
    },
  });

  useEffect(() => {
    if (invoiceData && invoiceData.status !== 'paid' && invoiceData.allowOnlinePayment && !clientSecret && !invoiceData.paid) {
      createPaymentIntentMutation.mutate();
    }
  }, [invoiceData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoiceData) {
    return null;
  }

  if (invoiceData.paid || invoiceData.status === 'paid' || paymentSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for your payment. A receipt has been sent to your email.
            </p>
            <div className="text-sm text-muted-foreground">
              <p>Invoice #{invoiceData.number}</p>
              <p className="font-semibold text-lg text-foreground mt-2">
                ${parseFloat(invoiceData.total).toFixed(2)} AUD
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoiceData.allowOnlinePayment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Online Payment Not Available</h2>
            <p className="text-muted-foreground">
              Online payment has not been enabled for this invoice. Please contact {invoiceData.business.name} for payment options.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const lineItems = invoiceData.lineItems || [];
  const subtotal = parseFloat(invoiceData.subtotal || '0');
  const gstAmount = parseFloat(invoiceData.gstAmount || '0');
  const total = parseFloat(invoiceData.total);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">{invoiceData.business.name}</h1>
          {invoiceData.business.abn && (
            <p className="text-sm text-muted-foreground">ABN: {invoiceData.business.abn}</p>
          )}
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Invoice #{invoiceData.number}</CardTitle>
                </div>
                <Badge variant={invoiceData.status === 'sent' ? 'default' : 'secondary'}>
                  {invoiceData.status.toUpperCase()}
                </Badge>
              </div>
              <CardDescription>{invoiceData.title}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Bill To</p>
                  <p className="font-medium">{invoiceData.client?.name || 'Customer'}</p>
                </div>
                <div className="text-right">
                  {invoiceData.dueDate && (
                    <>
                      <p className="text-muted-foreground">Due Date</p>
                      <p className="font-medium">{formatDate(invoiceData.dueDate)}</p>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              {lineItems.length > 0 && (
                <div className="space-y-2">
                  {lineItems.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-muted-foreground">
                          {item.quantity} × ${parseFloat(item.unitPrice).toFixed(2)}
                        </p>
                      </div>
                      <p className="font-medium">${parseFloat(item.total).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>GST (10%)</span>
                  <span>${gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${total.toFixed(2)} AUD</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {clientSecret && stripePromise && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Pay Now
                </CardTitle>
                <CardDescription>
                  Secure payment powered by Stripe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm 
                    clientSecret={clientSecret}
                    onSuccess={() => setPaymentSuccess(true)}
                    onError={(error) => console.error('Payment error:', error)}
                  />
                </Elements>
              </CardContent>
            </Card>
          )}

          {createPaymentIntentMutation.isPending && (
            <Card>
              <CardContent className="py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Setting up secure payment...</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentRequestView({
  token,
  requestData,
  isLoading,
  error,
}: {
  token: string;
  requestData: PaymentRequestData | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);

  const createPaymentIntentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/public/payment-request/${token}/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      if (data.publishableKey) {
        setStripePromise(loadStripe(data.publishableKey));
      }
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (paymentIntentId: string) => {
      const response = await fetch(`/api/public/payment-request/${token}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentIntentId, paymentMethod: 'card' }),
      });
      if (!response.ok) {
        throw new Error('Failed to confirm payment');
      }
      return response.json();
    },
    onSuccess: () => {
      setPaymentSuccess(true);
    },
  });

  useEffect(() => {
    if (requestData && requestData.status === 'pending') {
      createPaymentIntentMutation.mutate();
    }
  }, [requestData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error || !requestData) {
    return null;
  }

  if (requestData.status === 'paid' || paymentSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for your payment to {requestData.businessName}.
            </p>
            <div className="text-sm text-muted-foreground">
              <p>{requestData.description}</p>
              <p className="font-semibold text-lg text-foreground mt-2">
                ${parseFloat(requestData.amount).toFixed(2)} AUD
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (requestData.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Payment Cancelled</h2>
            <p className="text-muted-foreground">
              This payment request has been cancelled by {requestData.businessName}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (requestData.status === 'expired') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Payment Link Expired</h2>
            <p className="text-muted-foreground">
              This payment request has expired. Please contact {requestData.businessName} for a new payment link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const amount = parseFloat(requestData.amount);
  const gstAmount = parseFloat(requestData.gstAmount);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">{requestData.businessName}</h1>
          <p className="text-muted-foreground">Payment Request</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <p className="text-sm text-muted-foreground mb-2">Amount Due</p>
                <p className="text-4xl font-bold">${amount.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-1">AUD (includes ${gstAmount.toFixed(2)} GST)</p>
              </div>

              <Separator className="my-6" />

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">For</p>
                  <p className="font-medium">{requestData.description}</p>
                </div>
                
                {requestData.reference && (
                  <div>
                    <p className="text-sm text-muted-foreground">Reference</p>
                    <p className="font-medium">{requestData.reference}</p>
                  </div>
                )}

                {requestData.expiresAt && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      Expires {new Date(requestData.expiresAt).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {clientSecret && stripePromise && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Pay Now
                </CardTitle>
                <CardDescription>
                  Secure payment powered by Stripe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm 
                    clientSecret={clientSecret}
                    onSuccess={() => {
                      const paymentIntentId = clientSecret.split('_secret_')[0];
                      confirmPaymentMutation.mutate(paymentIntentId);
                    }}
                    onError={(error) => console.error('Payment error:', error)}
                  />
                </Elements>
              </CardContent>
            </Card>
          )}

          {createPaymentIntentMutation.isPending && (
            <Card>
              <CardContent className="py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Setting up secure payment...</p>
              </CardContent>
            </Card>
          )}

          {createPaymentIntentMutation.isError && (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
                <p className="font-semibold mb-2">Unable to Process Payment</p>
                <p className="text-muted-foreground text-sm">
                  {(createPaymentIntentMutation.error as Error)?.message || 'This payment link may have expired or been cancelled.'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Payments are processed securely by Stripe. Your card details are never stored.
        </p>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  const [, params] = useRoute("/pay/:token");
  const token = params?.token;

  const { data: invoiceData, isLoading: invoiceLoading, error: invoiceError } = useQuery<InvoiceData>({
    queryKey: ['/api/public/invoice', token],
    queryFn: async () => {
      const response = await fetch(`/api/public/invoice/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Invoice not found');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  const { data: paymentRequestData, isLoading: requestLoading, error: requestError } = useQuery<PaymentRequestData>({
    queryKey: ['/api/public/payment-request', token],
    queryFn: async () => {
      const response = await fetch(`/api/public/payment-request/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Payment request not found');
      }
      return response.json();
    },
    enabled: !!token && !!invoiceError,
    retry: false,
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Payment Link</h2>
            <p className="text-muted-foreground">
              This payment link appears to be invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invoiceLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (invoiceData) {
    return (
      <InvoicePaymentView
        token={token}
        invoiceData={invoiceData}
        isLoading={invoiceLoading}
        error={invoiceError}
      />
    );
  }

  if (requestLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (paymentRequestData) {
    return (
      <PaymentRequestView
        token={token}
        requestData={paymentRequestData}
        isLoading={requestLoading}
        error={requestError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Payment Not Found</h2>
          <p className="text-muted-foreground">
            This payment link may be invalid, expired, or has already been paid.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
