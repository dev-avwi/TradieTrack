import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sparkles, MapPin, Clock, Route, Calendar as CalendarIcon, ChevronRight, Lightbulb, Loader2, Navigation, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface OptimizedJob {
  job: {
    id: string;
    title: string;
    clientName: string;
    address?: string;
    priority?: string;
  };
  suggestedTime: string;
  travelDistance?: number;
  reason: string;
}

interface OptimizedSchedule {
  date: string;
  optimizedOrder: OptimizedJob[];
  totalDistance: number;
  totalTime: number;
  aiSuggestions: string[];
  aiRecommendations: string;
}

interface AIScheduleOptimizerProps {
  onApplySchedule?: (schedule: OptimizedSchedule) => void;
  className?: string;
}

export function AIScheduleOptimizer({ onApplySchedule, className }: AIScheduleOptimizerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isOptimizing, setIsOptimizing] = useState(false);

  const optimizeMutation = useMutation({
    mutationFn: async (date: Date) => {
      const response = await apiRequest('/api/schedule/ai-optimize', {
        method: 'POST',
        body: JSON.stringify({
          date: date.toISOString(),
          workdayStart: '07:00',
          workdayEnd: '17:00'
        }),
      });
      return response as OptimizedSchedule;
    },
    onSuccess: () => {
      setIsOptimizing(false);
    },
    onError: () => {
      setIsOptimizing(false);
    }
  });

  const handleOptimize = () => {
    setIsOptimizing(true);
    optimizeMutation.mutate(selectedDate);
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/10 text-red-600 border-red-200';
      case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-200';
      case 'medium': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'low': return 'bg-gray-500/10 text-gray-600 border-gray-200';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-200';
    }
  };

  const optimizedData = optimizeMutation.data;

  return (
    <Card className={cn("border-2 border-primary/20", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            AI Schedule Optimiser
          </CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-select-date">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(selectedDate, 'dd MMM yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!optimizedData && (
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <Route className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Optimise Your Day</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Let AI analyse your jobs and suggest the most efficient route
              </p>
            </div>
            <Button 
              onClick={handleOptimize}
              disabled={isOptimizing}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
              data-testid="button-optimize-schedule"
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analysing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Optimise Schedule
                </>
              )}
            </Button>
          </div>
        )}

        {optimizedData && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">{optimizedData.optimizedOrder.length}</div>
                <div className="text-xs text-muted-foreground">Jobs</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">{optimizedData.totalDistance}km</div>
                <div className="text-xs text-muted-foreground">Distance</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-foreground">{optimizedData.totalTime}h</div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
            </div>

            {/* AI Recommendations */}
            {optimizedData.aiRecommendations && (
              <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-200/50 dark:border-purple-800/50">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    {optimizedData.aiRecommendations}
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {optimizedData.aiSuggestions.length > 0 && (
              <div className="space-y-2">
                {optimizedData.aiSuggestions.map((suggestion, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm p-2 rounded bg-muted/30">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{suggestion}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Optimised Order */}
            {optimizedData.optimizedOrder.length > 0 ? (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                  <Navigation className="h-4 w-4" />
                  Suggested Route
                </h4>
                <div className="space-y-1">
                  {optimizedData.optimizedOrder.map((item, index) => (
                    <div 
                      key={item.job.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover-elevate cursor-pointer"
                      data-testid={`schedule-item-${item.job.id}`}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground truncate">{item.job.title}</span>
                          {item.job.priority && (
                            <Badge variant="outline" className={cn("text-xs", getPriorityColor(item.job.priority))}>
                              {item.job.priority}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.suggestedTime}
                          </span>
                          {item.travelDistance && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {item.travelDistance.toFixed(1)}km
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 italic">{item.reason}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No jobs scheduled for this date
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => optimizeMutation.reset()}
                className="flex-1"
                data-testid="button-reset-schedule"
              >
                Start Over
              </Button>
              {onApplySchedule && optimizedData.optimizedOrder.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => onApplySchedule(optimizedData)}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
                  data-testid="button-apply-schedule"
                >
                  Apply Schedule
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AIScheduleOptimizer;
