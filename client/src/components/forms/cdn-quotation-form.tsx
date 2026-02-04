import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCdnQuotationSchema, type InsertCdnQuotation, type Client } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FileDown, Mail } from "lucide-react";
import { format, addYears, subDays } from "date-fns";

interface CdnQuotationFormProps {
  clientId: number;
  onSuccess?: () => void;
}

export default function CdnQuotationForm({ clientId, onSuccess }: CdnQuotationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: client } = useQuery<Client>({
    queryKey: [`/api/clients/${clientId}`],
  });

  const form = useForm<InsertCdnQuotation>({
    resolver: zodResolver(insertCdnQuotationSchema),
    defaultValues: {
      clientId,
      clientNumber: "",
      clientName: "",
      clientAddress: "",
      offeredTo: "",
      investmentAmount: 0,
      term: 1,
      interestRate: 0,
      maturityValue: 0,
      calculationDate: new Date(),
      commencementDate: new Date(),
      redemptionDate: subDays(addYears(new Date(), 1), 1),
      status: "draft",
      preparedByName: "",
      preparedByCell: "",
      preparedByOffice: "",
      preparedByEmail: "",
    },
  });

  // Update form when client data is loaded
  if (client && !form.getValues("clientName")) {
    form.reset({
      ...form.getValues(),
      clientName: `${client.firstName} ${client.surname}`,
      offeredTo: `${client.firstName} ${client.surname}`,
      clientAddress: client.physicalAddress || "",
      clientPhone: client.cellPhone || "",
    });
  }

  const mutation = useMutation({
    mutationFn: async (data: InsertCdnQuotation) => {
      const res = await apiRequest("POST", "/api/cdn-quotations", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cdn-quotations", clientId] });
      toast({ title: "Success", description: "Quotation saved successfully" });
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

  const calculateDates = (commencementDate: Date, term: number) => {
    const redemption = subDays(addYears(new Date(commencementDate), term), 1);
    form.setValue("redemptionDate", redemption);
  };

  const calculateMaturity = () => {
    const amount = Number(form.getValues("investmentAmount") || 0);
    const rate = Number(form.getValues("interestRate") || 0);
    const term = Number(form.getValues("term") || 1);
    const maturity = amount * (1 + (rate / 100) * term);
    form.setValue("maturityValue", maturity);
  };

  const generatePDF = (data: InsertCdnQuotation) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(14);
    doc.text("Quotation Tool for FlexMax Capital Appreciator Fixed Deposit Note 1 Year Term", 105, 15, { align: "center" });
    
    doc.setFontSize(10);
    let y = 30;
    
    // Client Info
    doc.text("CLIENT NUMBER:", 20, y);
    doc.text(data.clientNumber || "", 70, y);
    y += 10;
    
    doc.text("CLIENT NAME:", 20, y);
    doc.text(data.clientName || "", 70, y);
    y += 7;
    doc.text("ADDRESS:", 20, y);
    const addressLines = doc.splitTextToSize(data.clientAddress || "", 100);
    doc.text(addressLines, 70, y);
    y += addressLines.length * 7;
    
    doc.text("OFFERED TO:", 20, y);
    doc.text(data.offeredTo || "", 70, y);
    y += 10;
    
    doc.text("INVESTMENT AMOUNT:", 20, y);
    doc.text(`R ${data.investmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 70, y);
    y += 20;
    
    // Plan Details
    doc.text("DATE OF CALCULATION:", 20, y);
    doc.text(format(new Date(data.calculationDate || new Date()), "yyyy/MM/dd"), 70, y);
    y += 7;
    
    doc.text("COMMENCEMENT DATE OF PLAN:", 20, y);
    doc.text(format(new Date(data.commencementDate || new Date()), "yyyy/MM/dd"), 70, y);
    y += 7;
    
    doc.text("TERM IN YEARS:", 20, y);
    doc.text(data.term.toString(), 70, y);
    y += 7;
    
    doc.text("REDEMPTION DATE:", 20, y);
    doc.text(format(new Date(data.redemptionDate || new Date()), "yyyy/MM/dd"), 70, y);
    y += 20;
    
    // Preparation Info
    doc.text("PREPARED BY:", 20, y);
    doc.text(data.preparedByName || "", 70, y);
    y += 7;
    if (data.preparedByCell) {
      doc.text(`Cell: ${data.preparedByCell}`, 70, y);
      y += 7;
    }
    if (data.preparedByOffice) {
      doc.text(`Office: ${data.preparedByOffice}`, 70, y);
      y += 7;
    }
    if (data.preparedByEmail) {
      doc.text(`Email: ${data.preparedByEmail}`, 70, y);
    }
    
    doc.save(`CDN_Quotation_${clientId}.pdf`);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Number</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="offeredTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Offered To</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="investmentAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Investment Amount (R)</FormLabel>
              <FormControl>
                <Input type="number" {...field} onChange={(e) => { field.onChange(e); calculateMaturity(); }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="interestRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interest Rate (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} onChange={(e) => { field.onChange(e); calculateMaturity(); }} />
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
                  <Input 
                    type="number" 
                    {...field} 
                    onChange={(e) => { 
                      field.onChange(e); 
                      calculateDates(form.getValues("commencementDate") as Date, Number(e.target.value));
                      calculateMaturity();
                    }} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="calculationDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Calculation</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                    onChange={(e) => field.onChange(new Date(e.target.value))} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="commencementDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Commencement Date</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      field.onChange(date);
                      calculateDates(date, form.getValues("term"));
                    }} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="redemptionDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Redemption Date</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    disabled
                    value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                  />
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
                <FormLabel>Maturity Value (R)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} disabled />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4 border-t pt-4">
          <FormLabel className="text-sm font-semibold">Prepared By Information</FormLabel>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="preparedByName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="preparedByEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>

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
