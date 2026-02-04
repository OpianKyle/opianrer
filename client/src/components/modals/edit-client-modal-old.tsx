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
    providentFundProjectedValue: "",
    groupLifeCover: "",
    groupDisabilityCover: "",
    groupDreadDiseaseCover: "",
    disabilityIncomeCover: "",
    medicalAidScheme: "",
    medicalAidMembershipNo: "",
    medicalAidMembers: "",
    medicalAidCompulsory: false,
    medicalAidSatisfied: false,
    deathMonthlyIncome: "",
    disabilityCapitalExpenses: "",
    disabilityMonthlyIncome: "",
    dreadDiseaseCover: "",
    retirementAge: "",
    retirementMonthlyIncome: "",
    childrenEducationAmount: "",
    childrenEducationYear: "",
    expectedInvestmentReturns: "",
    expectedInflation: "",
    hasWill: false,
    willLocation: "",
    willExecutor: "",
    status: "active",
    value: "",
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Populate form when client changes
  useEffect(() => {
    console.log("useEffect triggered - client:", client);
    if (client) {
      console.log("Setting form data with client data:", client);
      setFormData({
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
        grossAnnualIncome: client.grossAnnualIncome?.toString() || "",
        dutySplitAdmin: client.dutySplitAdmin?.toString() || "",
        dutySplitTravel: client.dutySplitTravel?.toString() || "",
        dutySplitSupervision: client.dutySplitSupervision?.toString() || "",
        dutySplitManual: client.dutySplitManual?.toString() || "",
        hobbies: client.hobbies || "",
        maritalStatus: client.maritalStatus || "",
        marriageType: client.marriageType || "",
        spouseName: client.spouseName || "",
        spouseMaidenName: client.spouseMaidenName || "",
        spouseSmokerStatus: client.spouseSmokerStatus || false,
        spouseOccupation: client.spouseOccupation || "",
        spouseEmployer: client.spouseEmployer || "",
        spouseEducationLevel: client.spouseEducationLevel || "",
        spouseGrossAnnualIncome: client.spouseGrossAnnualIncome?.toString() || "",
        monthlyIncome: client.monthlyIncome?.toString() || "",
        spouseMonthlyIncome: client.spouseMonthlyIncome?.toString() || "",
        pensionFundCurrentValue: client.pensionFundCurrentValue?.toString() || "",
        pensionFundProjectedValue: client.pensionFundProjectedValue?.toString() || "",
        providentFundCurrentValue: client.providentFundCurrentValue?.toString() || "",
        providentFundProjectedValue: client.providentFundProjectedValue?.toString() || "",
        groupLifeCover: client.groupLifeCover?.toString() || "",
        groupDisabilityCover: client.groupDisabilityCover?.toString() || "",
        groupDreadDiseaseCover: client.groupDreadDiseaseCover?.toString() || "",
        disabilityIncomeCover: client.disabilityIncomeCover?.toString() || "",
        medicalAidScheme: client.medicalAidScheme || "",
        medicalAidMembershipNo: client.medicalAidMembershipNo || "",
        medicalAidMembers: client.medicalAidMembers?.toString() || "",
        medicalAidCompulsory: client.medicalAidCompulsory || false,
        medicalAidSatisfied: client.medicalAidSatisfied || false,
        deathMonthlyIncome: client.deathMonthlyIncome?.toString() || "",
        disabilityCapitalExpenses: client.disabilityCapitalExpenses?.toString() || "",
        disabilityMonthlyIncome: client.disabilityMonthlyIncome?.toString() || "",
        dreadDiseaseCover: client.dreadDiseaseCover?.toString() || "",
        retirementAge: client.retirementAge?.toString() || "",
        retirementMonthlyIncome: client.retirementMonthlyIncome?.toString() || "",
        childrenEducationAmount: client.childrenEducationAmount?.toString() || "",
        childrenEducationYear: client.childrenEducationYear?.toString() || "",
        expectedInvestmentReturns: client.expectedInvestmentReturns?.toString() || "",
        expectedInflation: client.expectedInflation?.toString() || "",
        hasWill: client.hasWill || false,
        willLocation: client.willLocation || "",
        willExecutor: client.willExecutor || "",
        status: client.status || "active",
        value: client.value?.toString() || "",
      });
      console.log("Form data has been set");
    }
  }, [client, isOpen]);

  const updateClientMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      clientsApi.update(id, data),
    onSuccess: (data) => {
      console.log("Update successful:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Client updated successfully!",
      });
      onClose();
    },
    onError: (error) => {
      console.error("Update failed:", error);
      toast({
        title: "Error",
        description: "Failed to update client. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("Form submission started");
    console.log("Current client:", client);
    console.log("Form data:", formData);
    
    if (!client || !formData.firstName || !formData.surname || !formData.email) {
      console.log("Validation failed - missing required fields");
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const updateData = {
      title: formData.title || null,
      firstName: formData.firstName,
      surname: formData.surname,
      secondName: formData.secondName || null,
      idNumber: formData.idNumber || null,
      smokerStatus: formData.smokerStatus,
      cellPhone: formData.cellPhone || null,
      homePhone: formData.homePhone || null,
      workPhone: formData.workPhone || null,
      email: formData.email,
      physicalAddress: formData.physicalAddress || null,
      postalAddress: formData.postalAddress || null,
      physicalPostalCode: formData.physicalPostalCode || null,
      postalCode: formData.postalCode || null,
      occupation: formData.occupation || null,
      employer: formData.employer || null,
      educationLevel: formData.educationLevel || null,
      grossAnnualIncome: formData.grossAnnualIncome ? parseInt(formData.grossAnnualIncome) : null,
      dutySplitAdmin: formData.dutySplitAdmin ? parseInt(formData.dutySplitAdmin) : null,
      dutySplitTravel: formData.dutySplitTravel ? parseInt(formData.dutySplitTravel) : null,
      dutySplitSupervision: formData.dutySplitSupervision ? parseInt(formData.dutySplitSupervision) : null,
      dutySplitManual: formData.dutySplitManual ? parseInt(formData.dutySplitManual) : null,
      hobbies: formData.hobbies || null,
      maritalStatus: formData.maritalStatus || null,
      marriageType: formData.marriageType || null,
      spouseName: formData.spouseName || null,
      spouseMaidenName: formData.spouseMaidenName || null,
      spouseSmokerStatus: formData.spouseSmokerStatus,
      spouseOccupation: formData.spouseOccupation || null,
      spouseEmployer: formData.spouseEmployer || null,
      spouseEducationLevel: formData.spouseEducationLevel || null,
      spouseGrossAnnualIncome: formData.spouseGrossAnnualIncome ? parseInt(formData.spouseGrossAnnualIncome) : null,
      monthlyIncome: formData.monthlyIncome ? parseInt(formData.monthlyIncome) : null,
      spouseMonthlyIncome: formData.spouseMonthlyIncome ? parseInt(formData.spouseMonthlyIncome) : null,
      pensionFundCurrentValue: formData.pensionFundCurrentValue ? parseInt(formData.pensionFundCurrentValue) : null,
      pensionFundProjectedValue: formData.pensionFundProjectedValue ? parseInt(formData.pensionFundProjectedValue) : null,
      providentFundCurrentValue: formData.providentFundCurrentValue ? parseInt(formData.providentFundCurrentValue) : null,
      providentFundProjectedValue: formData.providentFundProjectedValue ? parseInt(formData.providentFundProjectedValue) : null,
      groupLifeCover: formData.groupLifeCover ? parseInt(formData.groupLifeCover) : null,
      groupDisabilityCover: formData.groupDisabilityCover ? parseInt(formData.groupDisabilityCover) : null,
      groupDreadDiseaseCover: formData.groupDreadDiseaseCover ? parseInt(formData.groupDreadDiseaseCover) : null,
      disabilityIncomeCover: formData.disabilityIncomeCover ? parseInt(formData.disabilityIncomeCover) : null,
      medicalAidScheme: formData.medicalAidScheme || null,
      medicalAidMembershipNo: formData.medicalAidMembershipNo || null,
      medicalAidMembers: formData.medicalAidMembers ? parseInt(formData.medicalAidMembers) : null,
      medicalAidCompulsory: formData.medicalAidCompulsory,
      medicalAidSatisfied: formData.medicalAidSatisfied,
      deathMonthlyIncome: formData.deathMonthlyIncome ? parseInt(formData.deathMonthlyIncome) : null,
      disabilityCapitalExpenses: formData.disabilityCapitalExpenses ? parseInt(formData.disabilityCapitalExpenses) : null,
      disabilityMonthlyIncome: formData.disabilityMonthlyIncome ? parseInt(formData.disabilityMonthlyIncome) : null,
      dreadDiseaseCover: formData.dreadDiseaseCover ? parseInt(formData.dreadDiseaseCover) : null,
      retirementAge: formData.retirementAge ? parseInt(formData.retirementAge) : null,
      retirementMonthlyIncome: formData.retirementMonthlyIncome ? parseInt(formData.retirementMonthlyIncome) : null,
      childrenEducationAmount: formData.childrenEducationAmount ? parseInt(formData.childrenEducationAmount) : null,
      childrenEducationYear: formData.childrenEducationYear ? parseInt(formData.childrenEducationYear) : null,
      expectedInvestmentReturns: formData.expectedInvestmentReturns ? parseInt(formData.expectedInvestmentReturns) : null,
      expectedInflation: formData.expectedInflation ? parseInt(formData.expectedInflation) : null,
      hasWill: formData.hasWill,
      willLocation: formData.willLocation || null,
      willExecutor: formData.willExecutor || null,
      status: formData.status,
      value: formData.value ? parseInt(formData.value) : null,
    };

    console.log("Sending update data:", updateData);
    updateClientMutation.mutate({ id: client.id, data: updateData });
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    console.log(`Field "${field}" changed to:`, value);
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      console.log("New form data:", newData);
      return newData;
    });
  };

  if (!client) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Edit className="w-5 h-5 text-primary" />
            <span>Edit Client Information</span>
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="spouse">Spouse</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Select value={formData.title} onValueChange={(value) => handleInputChange("title", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select title" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mr">Mr</SelectItem>
                          <SelectItem value="Mrs">Mrs</SelectItem>
                          <SelectItem value="Ms">Ms</SelectItem>
                          <SelectItem value="Dr">Dr</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange("firstName", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="surname">Surname *</Label>
                      <Input
                        id="surname"
                        value={formData.surname}
                        onChange={(e) => handleInputChange("surname", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="secondName">Second Name</Label>
                      <Input
                        id="secondName"
                        value={formData.secondName}
                        onChange={(e) => handleInputChange("secondName", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="idNumber">ID Number</Label>
                      <Input
                        id="idNumber"
                        value={formData.idNumber}
                        onChange={(e) => handleInputChange("idNumber", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="maritalStatus">Marital Status</Label>
                      <Select value={formData.maritalStatus} onValueChange={(value) => handleInputChange("maritalStatus", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Single">Single</SelectItem>
                          <SelectItem value="Married">Married</SelectItem>
                          <SelectItem value="Divorced">Divorced</SelectItem>
                          <SelectItem value="Widowed">Widowed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="smokerStatus"
                        checked={formData.smokerStatus}
                        onChange={(e) => handleInputChange("smokerStatus", e.target.checked)}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="smokerStatus">Smoker</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="cellPhone">Cell Phone</Label>
                      <Input
                        id="cellPhone"
                        value={formData.cellPhone}
                        onChange={(e) => handleInputChange("cellPhone", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="homePhone">Home Phone</Label>
                      <Input
                        id="homePhone"
                        value={formData.homePhone}
                        onChange={(e) => handleInputChange("homePhone", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="workPhone">Work Phone</Label>
                      <Input
                        id="workPhone"
                        value={formData.workPhone}
                        onChange={(e) => handleInputChange("workPhone", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="physicalAddress">Physical Address</Label>
                      <Textarea
                        id="physicalAddress"
                        value={formData.physicalAddress}
                        onChange={(e) => handleInputChange("physicalAddress", e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="postalAddress">Postal Address</Label>
                      <Textarea
                        id="postalAddress"
                        value={formData.postalAddress}
                        onChange={(e) => handleInputChange("postalAddress", e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="physicalPostalCode">Physical Postal Code</Label>
                      <Input
                        id="physicalPostalCode"
                        value={formData.physicalPostalCode}
                        onChange={(e) => handleInputChange("physicalPostalCode", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        value={formData.postalCode}
                        onChange={(e) => handleInputChange("postalCode", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="employment" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Employment & Education</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="occupation">Occupation</Label>
                      <Input
                        id="occupation"
                        value={formData.occupation}
                        onChange={(e) => handleInputChange("occupation", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="employer">Employer</Label>
                      <Input
                        id="employer"
                        value={formData.employer}
                        onChange={(e) => handleInputChange("employer", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="educationLevel">Education Level</Label>
                      <Input
                        id="educationLevel"
                        value={formData.educationLevel}
                        onChange={(e) => handleInputChange("educationLevel", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="monthlyIncome">Monthly Income</Label>
                      <Input
                        id="monthlyIncome"
                        type="number"
                        value={formData.monthlyIncome}
                        onChange={(e) => handleInputChange("monthlyIncome", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="grossAnnualIncome">Gross Annual Income</Label>
                      <Input
                        id="grossAnnualIncome"
                        type="number"
                        value={formData.grossAnnualIncome}
                        onChange={(e) => handleInputChange("grossAnnualIncome", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="hobbies">Hobbies</Label>
                      <Input
                        id="hobbies"
                        value={formData.hobbies}
                        onChange={(e) => handleInputChange("hobbies", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="dutySplitAdmin">Duty Split - Admin (%)</Label>
                      <Input
                        id="dutySplitAdmin"
                        type="number"
                        value={formData.dutySplitAdmin}
                        onChange={(e) => handleInputChange("dutySplitAdmin", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dutySplitTravel">Duty Split - Travel (%)</Label>
                      <Input
                        id="dutySplitTravel"
                        type="number"
                        value={formData.dutySplitTravel}
                        onChange={(e) => handleInputChange("dutySplitTravel", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dutySplitSupervision">Duty Split - Supervision (%)</Label>
                      <Input
                        id="dutySplitSupervision"
                        type="number"
                        value={formData.dutySplitSupervision}
                        onChange={(e) => handleInputChange("dutySplitSupervision", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dutySplitManual">Duty Split - Manual (%)</Label>
                      <Input
                        id="dutySplitManual"
                        type="number"
                        value={formData.dutySplitManual}
                        onChange={(e) => handleInputChange("dutySplitManual", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="spouse" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Spouse Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="marriageType">Marriage Type</Label>
                      <Select value={formData.marriageType} onValueChange={(value) => handleInputChange("marriageType", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ANC">ANC</SelectItem>
                          <SelectItem value="Accrual">Accrual</SelectItem>
                          <SelectItem value="COP">COP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="spouseName">Spouse Name</Label>
                      <Input
                        id="spouseName"
                        value={formData.spouseName}
                        onChange={(e) => handleInputChange("spouseName", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="spouseMaidenName">Spouse Maiden Name</Label>
                      <Input
                        id="spouseMaidenName"
                        value={formData.spouseMaidenName}
                        onChange={(e) => handleInputChange("spouseMaidenName", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="spouseOccupation">Spouse Occupation</Label>
                      <Input
                        id="spouseOccupation"
                        value={formData.spouseOccupation}
                        onChange={(e) => handleInputChange("spouseOccupation", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="spouseEmployer">Spouse Employer</Label>
                      <Input
                        id="spouseEmployer"
                        value={formData.spouseEmployer}
                        onChange={(e) => handleInputChange("spouseEmployer", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="spouseEducationLevel">Spouse Education Level</Label>
                      <Input
                        id="spouseEducationLevel"
                        value={formData.spouseEducationLevel}
                        onChange={(e) => handleInputChange("spouseEducationLevel", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="spouseGrossAnnualIncome">Spouse Gross Annual Income</Label>
                      <Input
                        id="spouseGrossAnnualIncome"
                        type="number"
                        value={formData.spouseGrossAnnualIncome}
                        onChange={(e) => handleInputChange("spouseGrossAnnualIncome", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="spouseMonthlyIncome">Spouse Monthly Income</Label>
                      <Input
                        id="spouseMonthlyIncome"
                        type="number"
                        value={formData.spouseMonthlyIncome}
                        onChange={(e) => handleInputChange("spouseMonthlyIncome", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="spouseSmokerStatus"
                      checked={formData.spouseSmokerStatus}
                      onChange={(e) => handleInputChange("spouseSmokerStatus", e.target.checked)}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="spouseSmokerStatus">Spouse Smoker</Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financial" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Financial Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="pensionFundCurrentValue">Pension Fund Current Value</Label>
                      <Input
                        id="pensionFundCurrentValue"
                        type="number"
                        value={formData.pensionFundCurrentValue}
                        onChange={(e) => handleInputChange("pensionFundCurrentValue", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="pensionFundProjectedValue">Pension Fund Projected Value</Label>
                      <Input
                        id="pensionFundProjectedValue"
                        type="number"
                        value={formData.pensionFundProjectedValue}
                        onChange={(e) => handleInputChange("pensionFundProjectedValue", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="providentFundCurrentValue">Provident Fund Current Value</Label>
                      <Input
                        id="providentFundCurrentValue"
                        type="number"
                        value={formData.providentFundCurrentValue}
                        onChange={(e) => handleInputChange("providentFundCurrentValue", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="providentFundProjectedValue">Provident Fund Projected Value</Label>
                      <Input
                        id="providentFundProjectedValue"
                        type="number"
                        value={formData.providentFundProjectedValue}
                        onChange={(e) => handleInputChange("providentFundProjectedValue", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="retirementAge">Retirement Age</Label>
                      <Input
                        id="retirementAge"
                        type="number"
                        value={formData.retirementAge}
                        onChange={(e) => handleInputChange("retirementAge", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="retirementMonthlyIncome">Retirement Monthly Income</Label>
                      <Input
                        id="retirementMonthlyIncome"
                        type="number"
                        value={formData.retirementMonthlyIncome}
                        onChange={(e) => handleInputChange("retirementMonthlyIncome", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="other" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Other Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="prospect">Prospect</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="value">Client Value</Label>
                      <Input
                        id="value"
                        type="number"
                        value={formData.value}
                        onChange={(e) => handleInputChange("value", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="willLocation">Will Location</Label>
                      <Input
                        id="willLocation"
                        value={formData.willLocation}
                        onChange={(e) => handleInputChange("willLocation", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="willExecutor">Will Executor</Label>
                      <Input
                        id="willExecutor"
                        value={formData.willExecutor}
                        onChange={(e) => handleInputChange("willExecutor", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="hasWill"
                      checked={formData.hasWill}
                      onChange={(e) => handleInputChange("hasWill", e.target.checked)}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="hasWill">Has Will</Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateClientMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {updateClientMutation.isPending ? "Updating..." : "Update Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}