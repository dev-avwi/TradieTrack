import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar as CalendarIcon, DollarSign, Receipt, Plus, Trash2, Edit3, TrendingUp, Filter, Download } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Form schemas
const expenseCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

const expenseSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  jobId: z.string().optional(),
  amount: z.string().min(1, "Amount is required").regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount"),
  gstAmount: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  vendor: z.string().optional(),
  receiptUrl: z.string().optional(),
  receiptNumber: z.string().optional(),
  expenseDate: z.date(),
  isBillable: z.boolean().default(true),
});

type ExpenseCategoryForm = z.infer<typeof expenseCategorySchema>;
type ExpenseForm = z.infer<typeof expenseSchema>;

export function ExpenseTracking() {
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedJob, setSelectedJob] = useState<string | undefined>();
  const { toast } = useToast();

  // Fetch data
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/expense-categories"],
  }) as { data: any[] };

  const { data: expenses = [] } = useQuery({
    queryKey: ["/api/expenses", selectedCategory, selectedJob],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') params.append('categoryId', selectedCategory);
      if (selectedJob && selectedJob !== 'all') params.append('jobId', selectedJob);
      return apiRequest('GET', `/api/expenses?${params.toString()}`);
    },
  }) as { data: any[] };

  const { data: jobs = [] } = useQuery({
    queryKey: ["/api/jobs"],
  }) as { data: any[] };

  const { data: expenseReport } = useQuery({
    queryKey: ["/api/reports/expenses", selectedPeriod],
    queryFn: () => apiRequest('GET', `/api/reports/expenses?period=${selectedPeriod}&groupBy=category`),
  }) as { data: any };

  // Forms
  const categoryForm = useForm<ExpenseCategoryForm>({
    resolver: zodResolver(expenseCategorySchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
    },
  });

  const expenseForm = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      categoryId: "",
      jobId: undefined,
      amount: "",
      gstAmount: "",
      description: "",
      vendor: "",
      receiptUrl: "",
      receiptNumber: "",
      expenseDate: new Date(),
      isBillable: true,
    },
  });

  // Mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data: ExpenseCategoryForm) => apiRequest("POST", "/api/expense-categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"], exact: false });
      setShowCategoryDialog(false);
      categoryForm.reset();
      toast({ title: "Success", description: "Expense category created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create category", variant: "destructive" });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data: ExpenseForm) => apiRequest("POST", "/api/expenses", {
      ...data,
      expenseDate: data.expenseDate.toISOString(),
      amount: data.amount,
      gstAmount: data.gstAmount || "0.00",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/expenses"], exact: false });
      setShowExpenseDialog(false);
      expenseForm.reset();
      toast({ title: "Success", description: "Expense recorded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to record expense", variant: "destructive" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/expenses"], exact: false });
      toast({ title: "Success", description: "Expense deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete expense", variant: "destructive" });
    },
  });

  // Auto-calculate GST
  const handleAmountChange = (value: string) => {
    const amount = parseFloat(value) || 0;
    const gstAmount = (amount * 0.1).toFixed(2); // 10% GST for Australia
    expenseForm.setValue("gstAmount", gstAmount);
  };

  const totalExpenses = Array.isArray(expenses) ? expenses.reduce((sum: number, expense: any) => sum + parseFloat(expense.amount || "0"), 0) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Expense Tracking</h1>
          <p className="text-muted-foreground">Monitor and manage your business expenses</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-sm" data-testid="button-add-category">
                <Plus className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Add </span>Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Expense Category</DialogTitle>
                <DialogDescription>
                  Add a new category to organize your expenses
                </DialogDescription>
              </DialogHeader>
              <Form {...categoryForm}>
                <form onSubmit={categoryForm.handleSubmit((data) => createCategoryMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={categoryForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Materials, Fuel, Tools" {...field} data-testid="input-category-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={categoryForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe what this category covers..." {...field} data-testid="input-category-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowCategoryDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createCategoryMutation.isPending} data-testid="button-save-category">
                      {createCategoryMutation.isPending ? "Creating..." : "Create Category"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="text-sm" data-testid="button-add-expense">
                <Plus className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Record </span>Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Record New Expense</DialogTitle>
                <DialogDescription>
                  Add a business expense and track it against a job
                </DialogDescription>
              </DialogHeader>
              <Form {...expenseForm}>
                <form onSubmit={expenseForm.handleSubmit((data) => createExpenseMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={expenseForm.control}
                      name="categoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-expense-category">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Array.isArray(categories) && categories.length > 0 ? (
                                categories.map((category: any) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="py-2 px-2 text-sm text-muted-foreground">
                                  No categories available
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={expenseForm.control}
                      name="jobId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-expense-job">
                                <SelectValue placeholder="Select job" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No Job</SelectItem>
                              {Array.isArray(jobs) && jobs.map((job: any) => (
                                <SelectItem key={job.id} value={job.id}>
                                  {job.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={expenseForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input placeholder="What was this expense for?" {...field} data-testid="input-expense-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={expenseForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (AUD)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                handleAmountChange(e.target.value);
                              }}
                              data-testid="input-expense-amount"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={expenseForm.control}
                      name="gstAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GST Amount</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-expense-gst" readOnly />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={expenseForm.control}
                      name="vendor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Bunnings" {...field} data-testid="input-expense-vendor" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={expenseForm.control}
                      name="expenseDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Expense Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className="w-full pl-3 text-left font-normal"
                                  data-testid="button-expense-date"
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={expenseForm.control}
                      name="receiptNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Receipt Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Receipt or invoice number" {...field} data-testid="input-expense-receipt" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowExpenseDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createExpenseMutation.isPending} data-testid="button-save-expense">
                      {createExpenseMutation.isPending ? "Recording..." : "Record Expense"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-expenses">
              ${totalExpenses.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {expenses.length} expenses recorded
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-monthly-expenses">
              ${expenseReport?.summary?.totalAmount?.toLocaleString('en-AU', { minimumFractionDigits: 2 }) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              {expenseReport?.summary?.totalExpenses || 0} expenses
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-category-count">
              {Array.isArray(categories) ? categories.length : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              expense categories
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="expenses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="expenses" data-testid="tab-expenses">Expenses</TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">Categories</TabsTrigger>
        </TabsList>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger data-testid="filter-category">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {Array.isArray(categories) && categories.map((category: any) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Job</Label>
                  <Select value={selectedJob} onValueChange={setSelectedJob}>
                    <SelectTrigger data-testid="filter-job">
                      <SelectValue placeholder="All jobs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All jobs</SelectItem>
                      {Array.isArray(jobs) && jobs.map((job: any) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSelectedCategory(undefined);
                      setSelectedJob(undefined);
                    }}
                    data-testid="button-clear-filters"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Expenses List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
              <CardDescription>
                Track all your business expenses in one place
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!Array.isArray(expenses) || expenses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No expenses recorded yet</p>
                    <p className="text-sm">Start by recording your first expense</p>
                  </div>
                ) : (
                  expenses.map((expense: any) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      data-testid={`expense-${expense.id}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{expense.description}</p>
                          <Badge variant="secondary">{expense.categoryName}</Badge>
                          {expense.jobTitle && (
                            <Badge variant="outline">{expense.jobTitle}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{format(new Date(expense.expenseDate), "PPP")}</span>
                          {expense.vendor && <span>• {expense.vendor}</span>}
                          {expense.receiptNumber && <span>• Receipt: {expense.receiptNumber}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold">
                            ${parseFloat(expense.amount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                          </p>
                          {expense.gstAmount && expense.gstAmount !== "0.00" && (
                            <p className="text-sm text-muted-foreground">
                              +${parseFloat(expense.gstAmount).toFixed(2)} GST
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteExpenseMutation.mutate(expense.id)}
                          disabled={deleteExpenseMutation.isPending}
                          data-testid={`button-delete-expense-${expense.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Expense Reports</CardTitle>
                  <CardDescription>
                    Analyze your spending patterns and trends
                  </CardDescription>
                </div>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-40" data-testid="select-report-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="quarter">Last Quarter</SelectItem>
                    <SelectItem value="year">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {expenseReport && expenseReport.summary && (
                <div className="space-y-6">
                  {/* Period Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        ${(expenseReport.summary.totalAmount || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Spent</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{expenseReport.summary.totalExpenses || 0}</p>
                      <p className="text-sm text-muted-foreground">Total Expenses</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        ${(expenseReport.summary.averageExpense || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-muted-foreground">Average</p>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div>
                    <h3 className="font-semibold mb-4">Expenses by Category</h3>
                    <div className="space-y-3">
                      {expenseReport.grouped && Object.entries(expenseReport.grouped).map(([category, data]: [string, any]) => (
                        <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{category}</p>
                            <p className="text-sm text-muted-foreground">{data.count || 0} expenses</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              ${(data.total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {expenseReport.summary.totalAmount > 0 
                                ? (((data.total || 0) / expenseReport.summary.totalAmount) * 100).toFixed(1)
                                : '0.0'
                              }%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {expenseReport && !expenseReport.summary && (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No expense data available for this period</p>
                  <p className="text-sm">Try selecting a different time period or add some expenses</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expense Categories</CardTitle>
              <CardDescription>
                Manage your expense categories to organize spending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!Array.isArray(categories) || categories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No categories created yet</p>
                    <p className="text-sm">Create your first expense category</p>
                  </div>
                ) : (
                  categories.map((category: any) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      data-testid={`category-${category.id}`}
                    >
                      <div>
                        <p className="font-medium">{category.name}</p>
                        {category.description && (
                          <p className="text-sm text-muted-foreground">{category.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={category.isActive ? "default" : "secondary"}>
                          {category.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}