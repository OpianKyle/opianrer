import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface IncomeProjectionsTableProps {
  initialCapital: number;
  onDataChange?: (data: ProjectionRow[]) => void;
}

export interface ProjectionRow {
  year: number | string;
  capitalValue: number;
  dividendRate: number;
  dividendAmount: number;
  annualised: number;
}

export function IncomeProjectionsTable({ initialCapital, onDataChange }: IncomeProjectionsTableProps) {
  const [years, setYears] = useState(5);
  const [useSingleRate, setUseSingleRate] = useState(false);
  const [singleRate, setSingleRate] = useState(13.10);
  const [stepIncrease, setStepIncrease] = useState(0.10);
  const [rates, setRates] = useState<number[]>([13.10, 13.20, 13.30, 13.40, 13.50]);

  const projections = useMemo(() => {
    const rows: ProjectionRow[] = [];
    let currentCapital = initialCapital;

    for (let i = 0; i < years; i++) {
      let rate: number;
      if (useSingleRate) {
        rate = singleRate + (i * stepIncrease);
      } else {
        rate = rates[i] || (rates[rates.length - 1] + (i - rates.length + 1) * stepIncrease);
      }

      const dividendAmount = currentCapital * (rate / 100);
      const annualised = currentCapital + dividendAmount;

      rows.push({
        year: i + 1,
        capitalValue: currentCapital,
        dividendRate: rate,
        dividendAmount,
        annualised
      });

      currentCapital = annualised;
    }
    
    return rows;
  }, [initialCapital, years, useSingleRate, singleRate, stepIncrease, rates]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val).replace('ZAR', 'R');
  };

  const formatPercent = (val: number) => {
    return `${val.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-none border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Projection Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="years" className="text-xs font-bold uppercase">Years</Label>
              <Input
                id="years"
                type="number"
                value={years}
                onChange={(e) => setYears(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-8 rounded-none bg-yellow-50/50"
              />
            </div>
            
            <div className="flex flex-col justify-center space-y-2">
              <Label className="text-xs font-bold uppercase">Mode</Label>
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={useSingleRate} 
                  onCheckedChange={setUseSingleRate} 
                />
                <span className="text-xs font-medium">{useSingleRate ? 'Step Increase' : 'Manual Rates'}</span>
              </div>
            </div>

            {useSingleRate ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="baseRate" className="text-xs font-bold uppercase">Base Rate %</Label>
                  <Input
                    id="baseRate"
                    type="number"
                    step="0.01"
                    value={singleRate}
                    onChange={(e) => setSingleRate(parseFloat(e.target.value) || 0)}
                    className="h-8 rounded-none bg-yellow-50/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="step" className="text-xs font-bold uppercase">Step %</Label>
                  <Input
                    id="step"
                    type="number"
                    step="0.01"
                    value={stepIncrease}
                    onChange={(e) => setStepIncrease(parseFloat(e.target.value) || 0)}
                    className="h-8 rounded-none bg-yellow-50/50"
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-bold uppercase">Manual Rates (comma separated %)</Label>
                <Input
                  value={rates.join(', ')}
                  onChange={(e) => {
                    const newRates = e.target.value.split(',').map(v => parseFloat(v.trim()) || 0);
                    setRates(newRates);
                  }}
                  className="h-8 rounded-none bg-yellow-50/50"
                  placeholder="13.10, 13.20..."
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto border border-black">
        <Table className="border-collapse">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-black">
              <TableHead className="w-16 border-r border-black font-bold text-black uppercase text-xs text-center">Year</TableHead>
              <TableHead className="border-r border-black font-bold text-black uppercase text-xs">Capital Value (Current)</TableHead>
              <TableHead className="border-r border-black font-bold text-black uppercase text-xs text-center">Dividend Forecast</TableHead>
              <TableHead className="border-r border-black font-bold text-black uppercase text-xs text-right">Projected Dividend</TableHead>
              <TableHead className="font-bold text-black uppercase text-xs text-right">Annualised</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projections.map((row) => (
              <TableRow key={row.year} className="hover:bg-transparent border-b border-black last:border-0">
                <TableCell className="border-r border-black text-xs font-medium text-center">{row.year}</TableCell>
                <TableCell className="border-r border-black text-xs">{formatCurrency(row.capitalValue)}</TableCell>
                <TableCell className="border-r border-black text-xs text-center">{formatPercent(row.dividendRate)}</TableCell>
                <TableCell className="border-r border-black text-xs text-right">{formatCurrency(row.dividendAmount)}</TableCell>
                <TableCell className="text-xs text-right font-bold">{formatCurrency(row.annualised)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="text-[10px] text-muted-foreground italic">
        * Calculation assumes annual reinvestment of dividends.
      </div>
    </div>
  );
}
