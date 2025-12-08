import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CalendarDays, Clock, Mail, Phone, MapPin, CheckCircle, XCircle, AlertCircle, User, Calendar, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import type { BookingRequest } from "@shared/schema";
import { Link } from "wouter";

export default function BookingRequestsPage() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const { data: requests = [], isLoading } = useQuery<BookingRequest[]>({
    queryKey: ["/api/booking/requests"],
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<BookingRequest> }) => {
      return await apiRequest(`/api/booking/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/booking/requests"] });
      if (data.status === "confirmed") {
        toast({ title: "Booking confirmed", description: "A job has been created for this booking." });
      } else if (data.status === "declined") {
        toast({ title: "Booking declined" });
      }
      setSelectedRequest(null);
      setDeclineDialogOpen(false);
      setDeclineReason("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleConfirm = (request: BookingRequest) => {
    updateRequestMutation.mutate({ id: request.id, updates: { status: "confirmed" } });
  };

  const handleDecline = () => {
    if (!selectedRequest) return;
    updateRequestMutation.mutate({
      id: selectedRequest.id,
      updates: { status: "declined", declineReason },
    });
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const confirmedRequests = requests.filter((r) => r.status === "confirmed");
  const declinedRequests = requests.filter((r) => r.status === "declined" || r.status === "cancelled");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "confirmed":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Confirmed</Badge>;
      case "declined":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Declined</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const RequestCard = ({ request }: { request: BookingRequest }) => (
    <Card key={request.id} className="hover-elevate cursor-pointer" data-testid={`booking-request-${request.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{request.clientName}</span>
              {getStatusBadge(request.status || "pending")}
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              {request.serviceName && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{request.serviceName}</span>
                  {request.estimatedPrice && (
                    <span className="text-primary font-medium">
                      ${parseFloat(request.estimatedPrice).toFixed(2)}
                    </span>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>{request.clientEmail}</span>
              </div>

              {request.clientPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{request.clientPhone}</span>
                </div>
              )}

              {request.clientAddress && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate max-w-xs">{request.clientAddress}</span>
                </div>
              )}

              {request.preferredDate && (
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span>
                    {format(new Date(request.preferredDate), "EEE, dd MMM yyyy")}
                    {request.preferredTimeSlot && ` at ${request.preferredTimeSlot}`}
                  </span>
                </div>
              )}

              {request.notes && (
                <p className="text-sm mt-2 italic">"{request.notes}"</p>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Received {format(new Date(request.createdAt!), "dd/MM/yyyy 'at' HH:mm")}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {request.status === "pending" && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleConfirm(request)}
                  disabled={updateRequestMutation.isPending}
                  data-testid={`button-confirm-${request.id}`}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedRequest(request);
                    setDeclineDialogOpen(true);
                  }}
                  disabled={updateRequestMutation.isPending}
                  data-testid={`button-decline-${request.id}`}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Decline
                </Button>
              </>
            )}

            {request.status === "confirmed" && request.jobId && (
              <Link href={`/jobs/${request.jobId}`}>
                <Button size="sm" variant="outline" data-testid={`button-view-job-${request.id}`}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Job
                </Button>
              </Link>
            )}

            {request.status === "declined" && request.declineReason && (
              <p className="text-xs text-muted-foreground max-w-[150px]">
                Reason: {request.declineReason}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Booking Requests</h1>
          <p className="text-muted-foreground">Manage booking requests from your online portal</p>
        </div>
        <Link href="/settings/booking">
          <Button variant="outline" data-testid="button-booking-settings">
            Portal Settings
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="confirmed" data-testid="tab-confirmed">
            Confirmed
            {confirmedRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">{confirmedRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="declined" data-testid="tab-declined">
            Declined
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No pending booking requests</p>
                <p className="text-sm text-muted-foreground">New requests will appear here</p>
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))
          )}
        </TabsContent>

        <TabsContent value="confirmed" className="space-y-4 mt-4">
          {confirmedRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No confirmed bookings</p>
              </CardContent>
            </Card>
          ) : (
            confirmedRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))
          )}
        </TabsContent>

        <TabsContent value="declined" className="space-y-4 mt-4">
          {declinedRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No declined requests</p>
              </CardContent>
            </Card>
          ) : (
            declinedRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Booking Request</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for declining this request.
              {selectedRequest && (
                <span className="block mt-2">
                  <strong>{selectedRequest.clientName}</strong> - {selectedRequest.serviceName}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="decline-reason">Reason (optional)</Label>
              <Textarea
                id="decline-reason"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g., Fully booked on that day, service not available..."
                data-testid="input-decline-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={updateRequestMutation.isPending}
              data-testid="button-confirm-decline"
            >
              {updateRequestMutation.isPending ? "Declining..." : "Decline Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
