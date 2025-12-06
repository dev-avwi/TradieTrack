import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, Check, X, Calendar, DollarSign, CheckCircle, FileText, Users, Briefcase, BellOff, CheckCheck, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const activeNotifications = notifications.filter(n => !n.dismissed);

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/notifications/${id}/read`, 'PATCH'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/notifications/${id}/dismiss`, 'PATCH'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest('/api/notifications/read-all', 'PATCH'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    
    if (notification.relatedType && notification.relatedId) {
      setOpen(false);
      switch (notification.relatedType) {
        case 'job':
          setLocation(`/jobs?selected=${notification.relatedId}`);
          break;
        case 'quote':
          setLocation(`/quotes?selected=${notification.relatedId}`);
          break;
        case 'invoice':
          setLocation(`/invoices?selected=${notification.relatedId}`);
          break;
        case 'client':
          setLocation(`/clients?selected=${notification.relatedId}`);
          break;
        case 'subscription':
          setLocation('/settings?tab=payments');
          break;
        default:
          break;
      }
    }
  };

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dismissMutation.mutate(id);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'job_reminder':
      case 'job_scheduled':
        return Calendar;
      case 'overdue_invoice':
      case 'invoice_sent':
      case 'invoice_paid':
        return DollarSign;
      case 'payment_received':
      case 'payment_failed':
        return CheckCircle;
      case 'quote_accepted':
      case 'quote_rejected':
      case 'quote_sent':
      case 'quote_created':
        return FileText;
      case 'client_created':
        return Users;
      case 'subscription_created':
      case 'subscription_canceled':
        return Briefcase;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'payment_received':
      case 'quote_accepted':
      case 'invoice_paid':
        return { bg: 'bg-green-100 dark:bg-green-900/40', icon: 'text-green-600 dark:text-green-400' };
      case 'overdue_invoice':
      case 'payment_failed':
      case 'quote_rejected':
        return { bg: 'bg-red-100 dark:bg-red-900/40', icon: 'text-red-600 dark:text-red-400' };
      case 'job_reminder':
      case 'job_scheduled':
        return { bg: 'bg-blue-100 dark:bg-blue-900/40', icon: 'text-blue-600 dark:text-blue-400' };
      case 'quote_sent':
      case 'quote_created':
      case 'invoice_sent':
        return { bg: 'bg-purple-100 dark:bg-purple-900/40', icon: 'text-purple-600 dark:text-purple-400' };
      default:
        return { bg: 'bg-muted', icon: 'text-muted-foreground' };
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium px-1 animate-pulse-soft">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg">Notifications</SheetTitle>
                {unreadCount > 0 && (
                  <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                className="gap-1.5"
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
          </div>
        </SheetHeader>
        
        {/* Notification List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <BellOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">All caught up!</h3>
              <p className="text-sm text-muted-foreground text-center">
                You have no new notifications. We'll let you know when something happens.
              </p>
            </div>
          ) : (
            <div className="py-2">
              {activeNotifications.map((notification, index) => {
                const Icon = getNotificationIcon(notification.type);
                const colors = getNotificationColor(notification.type);
                
                return (
                  <div 
                    key={notification.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className={`px-4 py-4 cursor-pointer transition-all duration-200 hover:bg-muted/50 active:bg-muted border-b border-border/50 ${
                        !notification.read ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex gap-4">
                        {/* Icon */}
                        <div className={`h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                          <Icon className={`h-5 w-5 ${colors.icon}`} />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm leading-tight ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                                  {notification.title}
                                </p>
                                {!notification.read && (
                                  <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground/70 mt-2">
                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {notification.relatedType && (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          
                          {/* Action buttons */}
                          <div className="flex items-center gap-2 mt-3">
                            {!notification.read && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsReadMutation.mutate(notification.id);
                                }}
                                data-testid={`button-mark-read-${notification.id}`}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Mark read
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-muted-foreground hover:text-destructive"
                              onClick={(e) => handleDismiss(e, notification.id)}
                              data-testid={`button-dismiss-${notification.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        {/* Footer */}
        <div className="px-4 py-3 border-t bg-muted/20 flex-shrink-0">
          <Button
            variant="ghost"
            className="w-full justify-center gap-2"
            onClick={() => {
              setOpen(false);
              setLocation('/settings?tab=notifications');
            }}
            data-testid="button-notification-settings"
          >
            Notification Settings
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
