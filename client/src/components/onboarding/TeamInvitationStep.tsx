import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight, Users, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const teamInvitationSchema = z.object({
  inviteTeamMembers: z.boolean().default(false),
  invitations: z.array(z.object({
    email: z.string().email("Please enter a valid email address"),
    role: z.enum(['admin', 'employee'], {
      required_error: "Please select a role",
    }),
  })).default([]),
});

type TeamInvitationData = z.infer<typeof teamInvitationSchema>;

interface TeamInvitationStepProps {
  data: TeamInvitationData;
  onComplete: (data: TeamInvitationData) => void;
  onPrevious: () => void;
  isLast: boolean;
}

export default function TeamInvitationStep({
  data,
  onComplete,
  onPrevious,
  isLast
}: TeamInvitationStepProps) {
  const form = useForm<TeamInvitationData>({
    resolver: zodResolver(teamInvitationSchema),
    defaultValues: {
      inviteTeamMembers: data.inviteTeamMembers || false,
      invitations: data.invitations || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "invitations",
  });

  const inviteTeamMembers = form.watch("inviteTeamMembers");

  const handleSubmit = async (formData: TeamInvitationData) => {
    onComplete(formData);
  };

  const handleSkip = () => {
    // Skip with defaults (no invitations) and let wizard handle navigation
    onComplete({
      inviteTeamMembers: false,
      invitations: [],
    });
  };

  const handleAddInvitation = () => {
    append({ email: '', role: 'employee' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          Team Setup
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            
            {/* Invite Team Members Toggle */}
            <FormField
              control={form.control}
              name="inviteTeamMembers"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Invite Team Members</FormLabel>
                    <FormDescription>
                      Do you want to invite team members to join your business?
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-invite-team-members"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Team Invitations */}
            {inviteTeamMembers && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Team Invitations</h4>
                    <p className="text-sm text-muted-foreground">
                      Add team members and assign their roles
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddInvitation}
                    data-testid="button-add-invitation"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </div>

                {fields.length === 0 && (
                  <div className="text-center p-6 border-2 border-dashed rounded-lg">
                    <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No team members added yet
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddInvitation}
                      className="mt-3"
                      data-testid="button-add-first-invitation"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Member
                    </Button>
                  </div>
                )}

                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start p-4 rounded-lg border bg-muted/50">
                    <div className="flex-1 space-y-4">
                      <FormField
                        control={form.control}
                        name={`invitations.${index}.email`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="team@example.com"
                                {...field}
                                data-testid={`input-invitation-email-${index}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`invitations.${index}.role`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid={`select-invitation-role-${index}`}>
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="admin">
                                  <div className="flex flex-col items-start">
                                    <span className="font-medium">Admin</span>
                                    <span className="text-xs text-muted-foreground">
                                      Full access to all features
                                    </span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="employee">
                                  <div className="flex flex-col items-start">
                                    <span className="font-medium">Employee</span>
                                    <span className="text-xs text-muted-foreground">
                                      Limited access to assigned jobs
                                    </span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      className="mt-8"
                      data-testid={`button-remove-invitation-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {fields.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {fields.length} {fields.length === 1 ? 'member' : 'members'} to invite
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Info Box */}
            {!inviteTeamMembers && (
              <div className="p-4 rounded-lg border bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  You can invite team members later from your business settings
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onPrevious}
                data-testid="button-previous"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              <div className="flex gap-2">
                {!isLast && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSkip}
                    data-testid="button-skip"
                  >
                    Skip for now
                  </Button>
                )}

                <Button
                  type="submit"
                  data-testid="button-complete"
                >
                  {isLast ? 'Complete Setup' : 'Continue'}
                  {!isLast && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
