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

const INTEREST_RATES: Record<number, string[]> = {
  1: ["9.75"],
  3: ["11.75", "11.85", "11.95"],
  5: ["13.10", "13.20", "13.30", "13.40", "13.50"]
};

export function QuotationForm({ client }: { client: Client }) {
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
      investmentAmount: 75000,
      term: 1,
      interestRate: "9.75",
      yearlyDivAllocation: 9.75,
      calculationDate: new Date(),
      commencementDate: new Date(),
      redemptionDate: addYears(new Date(), 1),
      preparedByName: user ? `${user.firstName} ${user.lastName}` : "",
      preparedByCell: "",
      preparedByOffice: "0861 263 346",
      preparedByEmail: user?.email || "",
    },
  });

  const investmentAmount = form.watch("investmentAmount");
  const interestRate = form.watch("interestRate");
  const term = form.watch("term");
  const commencementDate = form.watch("commencementDate");

  useEffect(() => {
    if (commencementDate && term) {
      const start = commencementDate instanceof Date ? commencementDate : parseISO(commencementDate);
      if (!isNaN(start.getTime())) {
        form.setValue("redemptionDate", addYears(start, term));
      }
    }
  }, [commencementDate, term, form]);

  useEffect(() => {
    const amount = Number(investmentAmount) || 0;
    const rate = term === 1 ? (parseFloat(interestRate) || 0) : 0;
    
    let maturity = 0;
    if (term === 1) {
      maturity = amount + (amount * (rate / 100));
    } else if (term === 3) {
      // 11.75%, 11.85%, 11.95%
      const r1 = 0.1175;
      const r2 = 0.1185;
      const r3 = 0.1195;
      maturity = amount * (1 + r1) * (1 + r2) * (1 + r3);
    } else if (term === 5) {
      // 13.10, 13.20, 13.30, 13.40, 13.50
      const r1 = 0.1310;
      const r2 = 0.1320;
      const r3 = 0.1330;
      const r4 = 0.1340;
      const r5 = 0.1350;
      maturity = amount * (1 + r1) * (1 + r2) * (1 + r3) * (1 + r4) * (1 + r5);
    }
    
    form.setValue("maturityValue", Math.round(maturity));
  }, [investmentAmount, interestRate, term, form]);

  // Update interest rate options when term changes
  useEffect(() => {
    const available = dynamicRates[term as keyof typeof dynamicRates];
    if (available && available.length > 0) {
      if (term === 1) {
        form.setValue("interestRate", available[0]);
      } else if (term === 3) {
        // First 11.75, Second 11.85, Third 11.95
        form.setValue("interestRate", "11.75%, 11.85%, 11.95%");
      } else if (term === 5) {
        // 13.10, 13.20, 13.30, 13.40, 13.50
        form.setValue("interestRate", "13.10%, 13.20%, 13.30%, 13.40%, 13.50%");
      }
    }
  }, [term, dynamicRates, form]);

  const mutation = useMutation({
    mutationFn: async (data: InsertCdnQuotation) => {
      const res = await apiRequest("POST", "/api/cdn-quotations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cdn-quotations", client.id] });
      toast({ title: "Quotation created successfully" });
    },
  });

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-none border-0">
      <CardHeader className="text-center border-b mb-6">
        <CardTitle className="text-xl font-bold uppercase tracking-tight">
          Quotation Tool for FlexMax Capital Appreciator Fixed Deposit Note {term} Year Term
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
                          form.setValue("interestRate", INTEREST_RATES[newTerm][0]);
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
                Generate Quotation
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
