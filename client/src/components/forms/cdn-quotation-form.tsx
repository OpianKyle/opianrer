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
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    const addSectionHeader = (text: string, y: number) => {
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(text.toUpperCase(), margin + 2, y + 6);
      return y + 12;
    };

    const addKeyValue = (label: string, value: string, y: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(label, margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, margin + 60, y);
      return y + 6;
    };

    // Page 1: Header and Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Quotation for FlexMax Capital Appreciator Fixed Deposit Note 1 Year Term", pageWidth / 2, 15, { align: "center" });
    
    let y = 30;
    y = addKeyValue("Date of Offer:", format(new Date(data.calculationDate || new Date()), "yyyy/MM/dd"), y);
    y += 4;
    y = addKeyValue("Offered to:", data.offeredTo || "", y);
    y = addKeyValue("Address:", data.clientAddress || "", y);
    y += 10;
    y = addKeyValue("Telephone:", data.clientPhone || "", y);
    y = addKeyValue("Email:", data.preparedByEmail || "", y);
    
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text(`Dear ${data.clientName}`, margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text("We take pleasure in submitting the following proposal to you:", margin, y);
    
    y += 10;
    y = addSectionHeader("Investment summary", y);
    y = addKeyValue("Investment amount", `R ${data.investmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, y);
    y = addKeyValue("Amount allocated with enhancement", `R ${data.investmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, y);
    y = addKeyValue("Term in years", data.term.toString(), y);
    y = addKeyValue("Commencement date", format(new Date(data.commencementDate || new Date()), "dd-MMM-yy"), y);
    y = addKeyValue("Percentage returned first year", `${data.interestRate}%`, y);
    const incomeFirstYear = (data.investmentAmount * (data.interestRate / 100));
    y = addKeyValue("Income allocated to capital in first year", `R ${incomeFirstYear.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, y);
    y = addKeyValue("Liquidity", "None", y);
    
    y += 6;
    y = addKeyValue("Contract Start date", format(new Date(data.commencementDate || new Date()), "01-Nov-25"), y);
    y = addKeyValue("Exit date", format(new Date(data.redemptionDate || new Date()), "31-Oct-26"), y);
    y = addKeyValue("Return Cycle", "Annually", y);
    y = addKeyValue("Capital allocation", "100%", y);

    y += 15;
    doc.setFontSize(8);
    doc.text("Registered Address: 220 Ashwood Avenue, Waterkloof Glen, 0181, Pretoria", margin, y);
    doc.text("Fund Advice: Sovereign Trust International Limited", pageWidth - margin, y, { align: "right" });
    y += 4;
    doc.text("Email: info@opiansapital.com Website: www.opiansapital.com", margin, y);
    doc.text("Sovereign Place, 117 Main Street, GX11 1AA, Gibraltar, GI", pageWidth - margin, y, { align: "right" });

    y += 10;
    y = addSectionHeader("Income projections", y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Year', 'Capital Value', 'Return Forecast']],
      body: [
        ['Current', `R ${data.investmentAmount.toLocaleString()}`, 'Projected: 9.75%'],
        ['1', `R ${data.maturityValue?.toLocaleString()}`, `R ${incomeFirstYear.toLocaleString()}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100] }
    });

    // Page 2: Conditions and Legal
    doc.addPage();
    y = 20;
    y = addSectionHeader("Modelled Fund Choices", y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['ISIN', 'Fund Name', 'Type', 'Split']],
      body: [
        ['SIN Code: DG00U67BC567', 'WSF Global Equity Fund', 'Risk Adverse', '100%']
      ],
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100] }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    y = addSectionHeader("Conditions", y);
    const conditions = [
      "1. To effectively evaluate this product against comparable alternatives, it is essential to analyze and contrast its risk reward profile with those of similar products offering analogous risk reward structures.",
      "2. This offer involves the purchase of Fixed Deposit Notes (FDN's) in private equity. Given the inherent risks associated we strongly recommend independent advice before making any commitment.",
      "3. This offer contains no guarantees beyond those expressly stated herein. Upon signing, the terms outlined in this offer shall constitute a legally binding agreement between the client and the company.",
      "4. The applicant acknowledges understanding of the complexities involving this investment as well as the lock-in periods contained in the investment.",
      "5. The applicant understands that a loan agreement will come into existence after signature of this quotation and that returns paid are mirrored on the performance of the selected fund above.",
      "6. The applicant understands the zero liquidity nature of this investment and has ensured that he has enough liquid investments or savings to ensure liquidity during this investment.",
      "7. The applicant understands that the directors or trustees of company funds, in their collective capacity, may limit, withhold, defer or reduce payments or payouts as necessary at moment's notice to safeguard the company's liquidity requirements and ensure financial stability.",
      "8. The individual, individuals or organisation's entering into this agreement acknowledges and understands that this is a fixed-term contract, as specified in the duration outlined above, the term \"Exit Date\" refers to the agreed-upon end date of the agreement.",
      "9. The applicant understands that if shares are issued under this agreement, the shares are issued for security only and are returnable when the applicant is paid back his invested capital.",
      "10. The applicant retains the option to convert their capital to fixed shares at exit date; whereafter the par value of the converted shares will be based on a comprehensive company's valuation at the time of exit."
    ];
    doc.setFontSize(8);
    conditions.forEach(c => {
      const lines = doc.splitTextToSize(c, contentWidth);
      if (y + (lines.length * 4) > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, margin, y);
      y += (lines.length * 4) + 2;
    });

    y += 10;
    y = addSectionHeader("Validity", y);
    const validityText = "This offer remains valid for a period of 14 days from the date of issuance, it is imperative that the receipt of funds occur within this specific time frame. All required documentation must be completed, and funds transfers finalized on or before expiration of the offers validity period. Should any information remain outstanding or incomplete, funds will be processed, a new offer must be issued and duly executed before the terms can be formally accepted by the company.";
    const validityLines = doc.splitTextToSize(validityText, contentWidth);
    doc.text(validityLines, margin, y);
    y += (validityLines.length * 4) + 10;

    y = addSectionHeader("Placement and Admin fees", y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Description', 'Frequency', 'Percentage']],
      body: [
        ['Placement fee', 'Once Off', '1.00%'],
        ['Admin Fees', 'Once Off', '0.50%']
      ],
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100] }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    y = addSectionHeader("Commission", y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Description', 'Frequency', 'Percentage']],
      body: [
        ['Commission', 'First Year', '0.50%']
      ],
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100] }
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    y = addSectionHeader("Agreement Details", y);
    y = addKeyValue("Agreement number:", data.clientNumber || "", y);
    y = addKeyValue("Investor Name:", data.clientName || "", y);
    y += 10;
    doc.rect(margin, y, contentWidth, 20);
    doc.text("Signature of investor: _________________________________", margin + 5, y + 12);
    y += 30;

    y = addSectionHeader("SUPPORT DOCUMENTATION", y);
    const docs = ["[ ] Application form", "[ ] Copy of Identity Document / Passport", "[ ] Proof of Address", "[ ] Bank Statement"];
    docs.forEach(d => {
      doc.text(d, margin, y);
      y += 6;
    });
    
    doc.save(`CDN_Quotation_${data.clientName}.pdf`);
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
