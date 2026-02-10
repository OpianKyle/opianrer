import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCdnQuotationSchema, type InsertCdnQuotation, type Client, type User, type InterestRate } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, addYears, parseISO } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IncomeProjectionsTable } from "./income-projections-table";
import opianLogo from "@assets/image_1770363247026.png";

const INTEREST_RATES: Record<number, string[]> = {
  1: ["9.75"],
  3: ["10.25", "10.35", "10.45"],
  5: ["11.50", "11.60", "11.70", "11.80", "11.90"]
};

export function IncomeProviderForm({ client }: { client: Client }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: globalRates } = useQuery<InterestRate[]>({ queryKey: ["/api/interest-rates"] });

  const dynamicRates = globalRates?.reduce((acc, curr) => {
    if (!acc[curr.term]) acc[curr.term] = [];
    acc[curr.term].push(curr.rate);
    return acc;
  }, {} as Record<number, string[]>) || INTEREST_RATES;

  const form = useForm<InsertCdnQuotation>({
    resolver: zodResolver(insertCdnQuotationSchema),
    defaultValues: {
      clientId: client.id,
      clientNumber: client.idNumber || `OFDN-104-778-00${client.id}`,
      clientName: `${client.firstName} ${client.surname}`,
      clientAddress: `${client.physicalAddress || ""}\n${client.physicalPostalCode || ""}`,
      clientPhone: client.cellPhone || "",
      investmentAmount: 100000,
      term: 3,
      interestRate: "10.25",
      yearlyDivAllocation: 10.25,
      calculationDate: new Date(),
      commencementDate: new Date(),
      redemptionDate: addYears(new Date(), 3),
      preparedByName: user ? `${user.firstName} ${user.lastName}` : "",
      preparedByCell: "",
      preparedByOffice: "0861 263 346",
      preparedByEmail: user?.email || "",
      investmentBooster: 5,
      type: "income_provider",
      incomeAllocation: "MONTHLY",
    },
  });

  const investmentAmount = form.watch("investmentAmount");
  const investmentBooster = form.watch("investmentBooster") || 0;
  const interestRate = form.watch("interestRate");
  const term = form.watch("term");
  const commencementDate = form.watch("commencementDate");
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    if (commencementDate && term) {
      const start = commencementDate instanceof Date ? commencementDate : parseISO(commencementDate);
      if (!isNaN(start.getTime())) {
        form.setValue("redemptionDate", addYears(start, term));
      }
    }
  }, [commencementDate, term, form]);

  useEffect(() => {
    const amount = (Number(investmentAmount) || 0) * (1 + (Number(investmentBooster) / 100));
    // For income provider, capital remains constant or returns to base after term
    form.setValue("maturityValue", Math.round(Number(investmentAmount) || 0));
  }, [investmentAmount, investmentBooster, form]);

  useEffect(() => {
    const available = dynamicRates[term as keyof typeof dynamicRates];
    if (available && available.length > 0) {
      if (term === 1) {
        form.setValue("interestRate", available[0]);
      } else if (term === 3) {
        form.setValue("interestRate", "10.25%, 10.35%, 10.45%");
      } else if (term === 5) {
        form.setValue("interestRate", "11.50%, 11.60%, 11.70%, 11.80%, 11.90%");
      }
    }
  }, [term, dynamicRates, form]);

  const mutation = useMutation({
    mutationFn: async (data: InsertCdnQuotation) => {
      const res = await apiRequest("POST", "/api/cdn-quotations", data);
      const quotation = await res.json();
      window.open(`/api/cdn-quotations/${quotation.id}/download`, "_blank");
      return quotation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cdn-quotations", client.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", client.id] });
      toast({ title: "Income Provider Quotation created" });
    },
  });

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-none border-0">
      <div className="flex justify-start p-4">
        <img src={opianLogo} alt="Opian Capital Logo" className="h-24 w-auto object-contain" />
      </div>
      <CardHeader className="text-center border-b mb-6 pt-0">
        <CardTitle className="text-xl font-bold uppercase tracking-tight">
          Quotation Tool for FlexMax Income Provider Fixed Deposit Note {term} Year Term
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="clientNumber"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 space-y-0">
                      <FormLabel className="w-32 shrink-0 uppercase text-xs font-bold">Client Number:</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-yellow-200 border-0 h-8 rounded-none font-mono" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-4 space-y-0">
                      <FormLabel className="w-32 shrink-0 uppercase text-xs font-bold pt-2">Client Name:</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-yellow-200 border-0 h-8 rounded-none" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientAddress"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-4 space-y-0">
                      <FormLabel className="w-32 shrink-0 uppercase text-xs font-bold pt-2">Address:</FormLabel>
                      <FormControl>
                        <Textarea {...field} className="bg-yellow-200 border-0 rounded-none resize-none min-h-[120px]" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormItem className="flex items-center gap-4 space-y-0">
                  <FormLabel className="w-32 shrink-0 uppercase text-xs font-bold">Offered To:</FormLabel>
                  <FormControl>
                    <Input value={form.watch("clientName")} disabled className="bg-yellow-200 border-0 h-8 rounded-none" />
                  </FormControl>
                </FormItem>

                <FormField
                  control={form.control}
                  name="investmentAmount"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 space-y-0">
                      <FormLabel className="w-32 shrink-0 uppercase text-xs font-bold">Investment Amount:</FormLabel>
                      <FormControl>
                        <div className="relative w-full">
                          <span className="absolute left-2 top-1.5 text-sm">R</span>
                          <Input type="number" {...field} className="bg-yellow-200 border-0 h-8 rounded-none pl-6" />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="investmentBooster"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 space-y-0">
                      <FormLabel className="w-32 shrink-0 uppercase text-xs font-bold">Investment Booster (%):</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} className="bg-yellow-200 border-0 h-8 rounded-none" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormItem className="flex items-center gap-4 space-y-0">
                  <FormLabel className="w-32 shrink-0 uppercase text-xs font-bold">Booster Amount:</FormLabel>
                  <FormControl>
                    <div className="relative w-full">
                      <span className="absolute left-2 top-1.5 text-sm">R</span>
                      <Input 
                        value={((Number(investmentAmount) || 0) * (Number(investmentBooster) / 100)).toLocaleString()} 
                        disabled 
                        className="bg-yellow-200 border-0 h-8 rounded-none pl-6" 
                      />
                    </div>
                  </FormControl>
                </FormItem>
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="calculationDate"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 space-y-0">
                      <FormLabel className="w-48 shrink-0 uppercase text-xs font-bold">Date of Calculation:</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value instanceof Date ? format(field.value, "yyyy-MM-dd") : field.value} onChange={(e) => field.onChange(new Date(e.target.value))} className="bg-yellow-200 border-0 h-8 rounded-none" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="commencementDate"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 space-y-0">
                      <FormLabel className="w-48 shrink-0 uppercase text-xs font-bold">Commencement Date of Plan:</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value instanceof Date ? format(field.value, "yyyy-MM-dd") : field.value} onChange={(e) => field.onChange(new Date(e.target.value))} className="bg-yellow-200 border-0 h-8 rounded-none font-bold" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="term"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 space-y-0">
                      <FormLabel className="w-48 shrink-0 uppercase text-xs font-bold">Term in Years:</FormLabel>
                      <Select 
                        onValueChange={(val) => {
                          const newTerm = parseInt(val);
                          field.onChange(newTerm);
                        }} 
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-yellow-200 border-0 h-8 rounded-none font-bold">
                            <SelectValue placeholder="Select term" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1 Year</SelectItem>
                          <SelectItem value="3">3 Years</SelectItem>
                          <SelectItem value="5">5 Years</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interestRate"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 space-y-0">
                      <FormLabel className="w-48 shrink-0 uppercase text-xs font-bold">Interest Rate:</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          readOnly 
                          className="bg-yellow-100 border-0 h-8 rounded-none font-bold focus-visible:ring-0 cursor-not-allowed" 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="redemptionDate"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 space-y-0">
                      <FormLabel className="w-48 shrink-0 uppercase text-xs font-bold">Redemption Date:</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value instanceof Date ? format(field.value, "yyyy-MM-dd") : field.value} onChange={(e) => field.onChange(new Date(e.target.value))} className="bg-yellow-200 border-0 h-8 rounded-none font-bold" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="incomeAllocation"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-4 space-y-0">
                      <FormLabel className="w-48 shrink-0 uppercase text-xs font-bold">Income Allocation:</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-yellow-200 border-0 h-8 rounded-none font-bold">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MONTHLY">MONTHLY</SelectItem>
                          <SelectItem value="QUARTERLY">QUARTERLY</SelectItem>
                          <SelectItem value="ANNUALLY">ANNUALLY</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <div className="pt-8 space-y-2">
                  <div className="flex items-start gap-4">
                    <span className="w-32 uppercase text-xs font-bold pt-1">Prepared By:</span>
                    <div className="flex-1 text-sm space-y-1">
                      <Input {...form.register("preparedByName")} className="h-7 border-0 p-0 focus-visible:ring-0" placeholder="Name" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground uppercase">Cell:</span>
                        <Input {...form.register("preparedByCell")} className="h-7 border-0 p-0 focus-visible:ring-0" placeholder="Cell Number" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground uppercase">Office:</span>
                        <Input {...form.register("preparedByOffice")} className="h-7 border-0 p-0 focus-visible:ring-0" placeholder="Office Number" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground uppercase">Email:</span>
                        <Input {...form.register("preparedByEmail")} className="h-7 border-0 p-0 focus-visible:ring-0" placeholder="Email Address" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t">
              <Button type="submit" size="lg" disabled={mutation.isPending} className="px-12 uppercase font-bold tracking-wider">
                Generate Income Provider Quotation
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
