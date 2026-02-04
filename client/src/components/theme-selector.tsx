import { useState } from 'react';
import { useTheme, Theme } from '@/contexts/theme-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Palette, Check, Moon, Sun, Waves, TreePine, Sunset, Building, Heart } from 'lucide-react';

const themeIcons = {
  light: Sun,
  dark: Moon,
  ocean: Waves,
  forest: TreePine,
  sunset: Sunset,
  corporate: Building,
  pink: Heart,
};

export default function ThemeSelector() {
  const { theme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-white/80 backdrop-blur-sm border-slate-300/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
        >
          <Palette className="w-4 h-4 mr-2" />
          Themes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            Choose Your Theme
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {Object.entries(themes).map(([key, config]) => {
            const Icon = themeIcons[key as Theme] || Palette;
            const isActive = theme === key;
            
            return (
              <Card
                key={key}
                className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                  isActive
                    ? 'ring-2 ring-primary shadow-lg scale-105'
                    : 'hover:ring-1 hover:ring-slate-300'
                }`}
                onClick={() => handleThemeChange(key as Theme)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon className="w-5 h-5" style={{ color: config.colors.primary }} />
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                    </div>
                    {isActive && (
                      <Badge variant="default" className="bg-primary">
                        <Check className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{config.description}</CardDescription>
                </CardHeader>
                
                <CardContent>
                  {/* Theme Preview */}
                  <div className="space-y-3">
                    {/* Color Palette */}
                    <div className="flex space-x-2">
                      <div
                        className="w-6 h-6 rounded-full border-2 border-white shadow-md"
                        style={{ backgroundColor: config.colors.primary }}
                        title="Primary"
                      />
                      <div
                        className="w-6 h-6 rounded-full border-2 border-white shadow-md"
                        style={{ backgroundColor: config.colors.secondary }}
                        title="Secondary"
                      />
                      <div
                        className="w-6 h-6 rounded-full border-2 border-white shadow-md"
                        style={{ backgroundColor: config.colors.accent }}
                        title="Accent"
                      />
                    </div>
                    
                    {/* Preview Card */}
                    <div 
                      className="rounded-lg p-4 border"
                      style={{ 
                        backgroundColor: config.colors.surface,
                        borderColor: config.colors.border
                      }}
                    >
                      <div 
                        className="text-sm font-medium mb-2"
                        style={{ color: config.colors.text }}
                      >
                        Sample Card
                      </div>
                      <div 
                        className="text-xs"
                        style={{ color: config.colors.textSecondary }}
                      >
                        This is how your content will look
                      </div>
                      <div 
                        className="mt-2 h-2 rounded-full"
                        style={{ background: config.colors.gradient }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        <div className="mt-6 p-4 bg-slate-50 rounded-lg border">
          <p className="text-sm text-slate-600">
            <strong>Tip:</strong> Your theme preference is automatically saved and will be applied 
            across all pages. You can change it anytime from the header.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}