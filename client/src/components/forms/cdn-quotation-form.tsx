import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCdnQuotationSchema, type InsertCdnQuotation } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FileDown, Mail } from "lucide-react";

interface CdnQuotationFormProps {
  clientId: number;
  onSuccess?: () => void;
}

export default function CdnQuotationForm({ clientId, onSuccess }: CdnQuotationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertCdnQuotation>({
    resolver: zodResolver(insertCdnQuotationSchema),
    defaultValues: {
      clientId,
      investmentAmount: 0,
      term: 1,
      interestRate: 0,
      maturityValue: 0,
      status: "draft",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertCdnQuotation) => {
      const res = await apiRequest("POST", "/api/cdn-quotations", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cdn-quotations", clientId] });
      toast({ title: "Success", description: "Quotation saved successfully" });
      // Show email option if saved successfully
      if (confirm("Would you like to email this quotation to the client?")) {
        emailMutation.mutate(data.id);
      }
      onSuccess?.();
    },
  });

  const emailMutation = useMutation({
    mutationFn: async (quotationId: number) => {
      const res = await apiRequest("POST", `/api/cdn-quotations/${quotationId}/email`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Quotation emailed to client" });
    },
  });

  const calculateMaturity = () => {
    const amount = Number(form.getValues("investmentAmount") || 0);
    const rate = Number(form.getValues("interestRate") || 0);
    const term = Number(form.getValues("term") || 1);
    const maturity = amount * (1 + (rate / 100) * term);
    form.setValue("maturityValue", maturity);
  };

  const generatePDF = (data: InsertCdnQuotation) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Capital Deposit Note Quotation", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 40);
    
    autoTable(doc, {
      startY: 50,
      head: [['Description', 'Value']],
      body: [
        ['Investment Amount', `$${data.investmentAmount.toLocaleString()}`],
        ['Interest Rate', `${data.interestRate}%`],
        ['Term', `${data.term} Year`],
        ['Maturity Value', `$${data.maturityValue?.toLocaleString()}`],
      ],
    });
    
    doc.save(`CDN_Quotation_${clientId}.pdf`);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <FormField
          control={form.control}
          name="investmentAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Investment Amount</FormLabel>
              <FormControl>
                <Input type="number" {...field} onChange={(e) => { field.onChange(e); calculateMaturity(); }} />
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
                <Input type="number" {...field} onChange={(e) => { field.onChange(e); calculateMaturity(); }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="term"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Term (Years)</FormLabel>
              <FormControl>
                <Input type="number" {...field} disabled />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="maturityValue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Maturity Value</FormLabel>
              <FormControl>
                <Input type="number" {...field} disabled />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={mutation.isPending}>
            Save Quotation
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => generatePDF(form.getValues())}
          >
            <FileDown className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </Form>
  );
}
