import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { insertClientSchema, type InsertClient, type Client } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit } from "lucide-react";

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
}

export default function EditClientModal({
  isOpen,
  onClose,
  client,
}: EditClientModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("personal");

  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      // Personal Information
      title: "",
      firstName: "",
      surname: "",
      secondName: "",
      idNumber: "",
      smokerStatus: false,
      
      // Contact Details
      cellPhone: "",
      homePhone: "",
      workPhone: "",
      email: "",
      physicalAddress: "",
      postalAddress: "",
      physicalPostalCode: "",
      postalCode: "",
      
      // Employment & Education
      occupation: "",
      employer: "",
      educationLevel: "",
      grossAnnualIncome: 0,
      dutySplitAdmin: 0,
      dutySplitTravel: 0,
      dutySplitSupervision: 0,
      dutySplitManual: 0,
      hobbies: "",
      
      // Marital Details
      maritalStatus: "",
      marriageType: "",
      spouseName: "",
      spouseMaidenName: "",
      spouseSmokerStatus: false,
      spouseOccupation: "",
      spouseEmployer: "",
      spouseEducationLevel: "",
      spouseGrossAnnualIncome: 0,
      
      // Financial Information
      monthlyIncome: 0,
      spouseMonthlyIncome: 0,
      
      // Group Risk Benefits
      pensionFundCurrentValue: 0,
      pensionFundProjectedValue: 0,
      providentFundCurrentValue: 0,
      providentFundProjectedValue: 0,
      groupLifeCover: 0,
      groupDisabilityCover: 0,
      groupDreadDiseaseCover: 0,
      disabilityIncomeCover: 0,
      
      // Medical Aid
      medicalAidScheme: "",
      medicalAidMembershipNo: "",
      medicalAidMembers: 1,
      medicalAidCompulsory: false,
      medicalAidSatisfied: false,
      
      // Financial Objectives
      deathMonthlyIncome: 0,
      disabilityCapitalExpenses: 0,
      disabilityMonthlyIncome: 0,
      dreadDiseaseCover: 0,
      retirementAge: 65,
      retirementMonthlyIncome: 0,
      childrenEducationAmount: 0,
      childrenEducationYear: 0,
      
      // Investment Expectations
      expectedInvestmentReturns: 10,
      expectedInflation: 6,
      
      // Will Information
      hasWill: false,
      willLocation: "",
      willExecutor: "",
      
      // CRM Fields
      status: "active",
      value: 0,
    },
  });

  // Update form when client data changes
  React.useEffect(() => {
    if (client && isOpen) {
      form.reset({
        title: client.title || "",
        firstName: client.firstName || "",
        surname: client.surname || "",
        secondName: client.secondName || "",
        idNumber: client.idNumber || "",
        smokerStatus: client.smokerStatus || false,
        cellPhone: client.cellPhone || "",
        homePhone: client.homePhone || "",
        workPhone: client.workPhone || "",
        email: client.email || "",
        physicalAddress: client.physicalAddress || "",
        postalAddress: client.postalAddress || "",
        physicalPostalCode: client.physicalPostalCode || "",
        postalCode: client.postalCode || "",
        occupation: client.occupation || "",
        employer: client.employer || "",
        educationLevel: client.educationLevel || "",
        grossAnnualIncome: client.grossAnnualIncome || 0,
        dutySplitAdmin: client.dutySplitAdmin || 0,
        dutySplitTravel: client.dutySplitTravel || 0,
        dutySplitSupervision: client.dutySplitSupervision || 0,
        dutySplitManual: client.dutySplitManual || 0,
        hobbies: client.hobbies || "",
        maritalStatus: client.maritalStatus || "",
        marriageType: client.marriageType || "",
        spouseName: client.spouseName || "",
        spouseMaidenName: client.spouseMaidenName || "",
        spouseSmokerStatus: client.spouseSmokerStatus || false,
        spouseOccupation: client.spouseOccupation || "",
        spouseEmployer: client.spouseEmployer || "",
        spouseEducationLevel: client.spouseEducationLevel || "",
        spouseGrossAnnualIncome: client.spouseGrossAnnualIncome || 0,
        monthlyIncome: client.monthlyIncome || 0,
        spouseMonthlyIncome: client.spouseMonthlyIncome || 0,
        pensionFundCurrentValue: client.pensionFundCurrentValue || 0,
        pensionFundProjectedValue: client.pensionFundProjectedValue || 0,
        providentFundCurrentValue: client.providentFundCurrentValue || 0,
        providentFundProjectedValue: client.providentFundProjectedValue || 0,
        groupLifeCover: client.groupLifeCover || 0,
        groupDisabilityCover: client.groupDisabilityCover || 0,
        groupDreadDiseaseCover: client.groupDreadDiseaseCover || 0,
        disabilityIncomeCover: client.disabilityIncomeCover || 0,
        medicalAidScheme: client.medicalAidScheme || "",
        medicalAidMembershipNo: client.medicalAidMembershipNo || "",
        medicalAidMembers: client.medicalAidMembers || 1,
        medicalAidCompulsory: client.medicalAidCompulsory || false,
        medicalAidSatisfied: client.medicalAidSatisfied || false,
        deathMonthlyIncome: client.deathMonthlyIncome || 0,
        disabilityCapitalExpenses: client.disabilityCapitalExpenses || 0,
        disabilityMonthlyIncome: client.disabilityMonthlyIncome || 0,
        dreadDiseaseCover: client.dreadDiseaseCover || 0,
        retirementAge: client.retirementAge || 65,
        retirementMonthlyIncome: client.retirementMonthlyIncome || 0,
        childrenEducationAmount: client.childrenEducationAmount || 0,
        childrenEducationYear: client.childrenEducationYear || 0,
        expectedInvestmentReturns: client.expectedInvestmentReturns || 10,
        expectedInflation: client.expectedInflation || 6,
        hasWill: client.hasWill || false,
        willLocation: client.willLocation || "",
        willExecutor: client.willExecutor || "",
        status: client.status || "active",
        value: client.value || 0,
      });
    }
  }, [client, isOpen, form]);

  const updateClientMutation = useMutation({
    mutationFn: (data: InsertClient) => clientsApi.update(client!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Client updated successfully!",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertClient) => {
    updateClientMutation.mutate(data);
  };

  if (!client) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Edit className="w-5 h-5 text-primary" />
            <span>Edit Client Information</span>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="employment">Employment</TabsTrigger>
                <TabsTrigger value="marital">Marital</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="objectives">Objectives</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select title" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Mr">Mr</SelectItem>
                              <SelectItem value="Mrs">Mrs</SelectItem>
                              <SelectItem value="Ms">Ms</SelectItem>
                              <SelectItem value="Dr">Dr</SelectItem>
                              <SelectItem value="Prof">Prof</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="surname"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Surname *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="secondName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Second Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="idNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="smokerStatus"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Smoker</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contact" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="cellPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cell Phone</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="homePhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Home Phone</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="workPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Phone</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="physicalAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Physical Address</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="postalAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Address</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="physicalPostalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Physical Postal Code</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="employment" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Employment & Education</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="occupation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Occupation</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="employer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employer</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="educationLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Education Level</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select education level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="matric">Matric</SelectItem>
                              <SelectItem value="diploma">Diploma</SelectItem>
                              <SelectItem value="degree">Degree</SelectItem>
                              <SelectItem value="honours">Honours</SelectItem>
                              <SelectItem value="masters">Masters</SelectItem>
                              <SelectItem value="phd">PhD</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="grossAnnualIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gross Annual Income</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="marital" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Marital Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="maritalStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marital Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select marital status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Single">Single</SelectItem>
                              <SelectItem value="Married">Married</SelectItem>
                              <SelectItem value="Divorced">Divorced</SelectItem>
                              <SelectItem value="Widowed">Widowed</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="marriageType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marriage Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select marriage type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="In Community of Property">In Community of Property</SelectItem>
                              <SelectItem value="Out of Community of Property">Out of Community of Property</SelectItem>
                              <SelectItem value="Accrual System">Accrual System</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="spouseName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Spouse Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="spouseMaidenName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Spouse Maiden Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="financial" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Financial Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="monthlyIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Income</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Value</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="prospect">Prospect</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="objectives" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Financial Objectives</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="retirementAge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Retirement Age</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="retirementMonthlyIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Retirement Monthly Income</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="hasWill"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Has Will</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateClientMutation.isPending}
                className="bg-[#0073EA] hover:bg-[#0073EA]/90"
              >
                {updateClientMutation.isPending ? "Updating..." : "Update Client"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}