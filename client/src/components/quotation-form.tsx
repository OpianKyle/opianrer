import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCdnQuotationSchema, type InsertCdnQuotation, type Client } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, addYears } from "date-fns";

export function QuotationForm({ client }: { client: Client }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [maturityValue, setMaturityValue] = useState<number>(0);

  const form = useForm<InsertCdnQuotation>({
    resolver: zodResolver(insertCdnQuotationSchema),
    defaultValues: {
      clientId: client.id,
      investmentAmount: 75000,
      term: 1,
      interestRate: 9.75,
      yearlyDivAllocation: 9.75,
      commencementDate: format(new Date(), "yyyy-MM-dd"),
      redemptionDate: format(addYears(new Date(), 1), "yyyy-MM-dd"),
    },
  });

  const investmentAmount = form.watch("investmentAmount");
  const interestRate = form.watch("interestRate");

  useEffect(() => {
    const amount = Number(investmentAmount) || 0;
    const rate = Number(interestRate) || 0;
    const maturity = amount + (amount * (rate / 100));
    setMaturityValue(maturity);
    form.setValue("maturityValue", maturity);
  }, [investmentAmount, interestRate, form]);

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
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Quotation Tool for FlexMax Capital Appreciator</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Client Name</FormLabel>
                <Input value={`${client.firstName} ${client.surname}`} disabled />
              </FormItem>
              <FormField
                control={form.control}
                name="investmentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Investment Amount (R)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="interestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Yearly Div Allocation (%)</FormLabel>
                <Input value="9.75" disabled />
              </FormItem>
              <FormField
                control={form.control}
                name="commencementDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commencement Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="redemptionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Redemption Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Estimated Maturity Value:</span>
                <span>R {maturityValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              Generate Quotation
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
