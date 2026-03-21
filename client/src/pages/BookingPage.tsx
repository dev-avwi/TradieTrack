import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarPlus,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  Loader2,
  Clock,
  ArrowRight,
} from "lucide-react";

interface BusinessInfo {
  businessName: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string;
  brandColor: string;
  primaryColor: string;
  services: string[];
  description: string;
  abn: string;
}

export default function BookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    service: "",
    preferredDate: "",
    address: "",
    description: "",
  });

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/book/${slug}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setBusiness(data);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;

    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/book/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Something went wrong. Please try again or call us directly.");
      }
    } catch {
      setErrorMsg("Could not connect. Please check your internet and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-3">
            <h2 className="text-xl font-semibold">Booking Page Not Found</h2>
            <p className="text-muted-foreground">
              This booking page doesn't exist or has been disabled.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const brandColor = business.brandColor || "#2563EB";

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ backgroundColor: `${brandColor}15` }}
            >
              <CheckCircle className="w-8 h-8" style={{ color: brandColor }} />
            </div>
            <h2 className="text-xl font-semibold">Request Submitted</h2>
            <p className="text-muted-foreground">
              Thanks {form.name}! {business.businessName} has received your
              booking request and will be in touch shortly.
            </p>
            {business.phone && (
              <p className="text-sm text-muted-foreground">
                Need something urgently? Call{" "}
                <a
                  href={`tel:${business.phone}`}
                  className="font-medium underline"
                  style={{ color: brandColor }}
                >
                  {business.phone}
                </a>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div
        className="w-full py-8 px-4"
        style={{ backgroundColor: `${brandColor}10` }}
      >
        <div className="max-w-lg mx-auto text-center space-y-3">
          {business.logoUrl && (
            <img
              src={business.logoUrl}
              alt={business.businessName}
              className="w-20 h-20 object-contain mx-auto rounded-md"
            />
          )}
          <h1 className="text-2xl font-bold">{business.businessName}</h1>
          {business.description && (
            <p className="text-muted-foreground">{business.description}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {business.phone && (
              <a
                href={`tel:${business.phone}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover-elevate px-2 py-1 rounded"
              >
                <Phone className="w-3.5 h-3.5" />
                {business.phone}
              </a>
            )}
            {business.email && (
              <a
                href={`mailto:${business.email}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover-elevate px-2 py-1 rounded"
              >
                <Mail className="w-3.5 h-3.5" />
                {business.email}
              </a>
            )}
            {business.address && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground px-2 py-1">
                <MapPin className="w-3.5 h-3.5" />
                {business.address}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarPlus className="w-5 h-5" style={{ color: brandColor }} />
              <CardTitle>Request a Booking</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Fill in your details and we'll get back to you to confirm.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="book-name">
                    Your Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="book-name"
                    placeholder="John Smith"
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="book-phone">
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="book-phone"
                    type="tel"
                    placeholder="0412 345 678"
                    required
                    value={form.phone}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, phone: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="book-email">Email (optional)</Label>
                <Input
                  id="book-email"
                  type="email"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>

              {business.services && business.services.length > 0 && (
                <div className="space-y-2">
                  <Label>Service Required</Label>
                  <Select
                    value={form.service}
                    onValueChange={(v) => setForm((p) => ({ ...p, service: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                    <SelectContent>
                      {business.services.map((s: string) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="book-address">Job Address</Label>
                <Input
                  id="book-address"
                  placeholder="123 Main St, Brisbane QLD"
                  value={form.address}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, address: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="book-date">Preferred Date (optional)</Label>
                <Input
                  id="book-date"
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, preferredDate: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="book-desc">
                  Describe what you need done
                </Label>
                <Textarea
                  id="book-desc"
                  placeholder="E.g. Leaking kitchen tap, need it fixed ASAP..."
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {errorMsg}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !form.name || !form.phone}
                style={{ backgroundColor: brandColor }}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Submit Booking Request
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By submitting, you agree to be contacted by{" "}
                {business.businessName} regarding your request.
              </p>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by{" "}
            <a
              href="/"
              className="font-medium"
              style={{ color: brandColor }}
            >
              JobRunner
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
