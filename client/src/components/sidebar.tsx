import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Users, 
  FileText, 
  Calendar, 
  Clock, 
  BarChart3,
  LogOut,
  Plus,
  Settings,
  Kanban,
  Sparkles,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/contexts/theme-context";
import { useState } from "react";

const navigationItems = [
  { path: "/", label: "Dashboard", icon: BarChart3 },
  { path: "/clients", label: "Clients", icon: Users },
  { path: "/booking-calendar", label: "Calendar", icon: Calendar },
  { path: "/appointments", label: "Appointments", icon: Clock },
  { path: "/kanban", label: "Kanban Board", icon: Kanban },
  { path: "/team-members", label: "Team", icon: Users },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { logoutMutation, user } = useAuth();
  const { theme, themes } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const sidebarStyle = {
    backgroundColor: themes[theme].colors.surface,
    borderColor: themes[theme].colors.border,
    color: themes[theme].colors.text,
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav 
        className={cn(
          "w-64 shadow-xl border-r flex flex-col relative overflow-hidden transition-all duration-300",
          "fixed lg:relative h-full z-40 lg:z-auto",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={sidebarStyle}
      >
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent"></div>
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
      
      {/* Header */}
      <div className="relative p-6 border-b border-slate-200/50">
        <div className="flex justify-center">
          <img 
            src="/logo.png" 
            alt="Opian Core" 
            className="h-12 w-auto object-contain transform hover:scale-105 transition-all duration-300"
          />
        </div>
      </div>
      
      {/* Navigation */}
      <div className="flex-1 p-4 space-y-2 relative z-10">
        {navigationItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          const navItemStyle = isActive 
            ? {
                background: themes[theme].colors.gradient,
                color: '#ffffff',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              }
            : {
                color: themes[theme].colors.textSecondary,
              };
          
          return (
            <Link key={item.path} href={item.path}>
              <div
                onClick={() => setIsMobileMenuOpen(false)} 
                className={cn(
                  "group relative flex items-center space-x-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 ease-out",
                  "hover:shadow-sm transform hover:translate-x-1",
                  isActive && "translate-x-1"
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                  ...navItemStyle,
                  ...(isActive ? {} : {
                    ':hover': {
                      backgroundColor: themes[theme].colors.primary + '20',
                    }
                  })
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = themes[theme].colors.primary + '20';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-white rounded-full shadow-md"></div>
                )}
                
                {/* Icon with animation */}
                <div className={cn(
                  "relative transition-all duration-200 flex-shrink-0",
                  isActive ? "text-white" : "text-slate-600 group-hover:text-primary"
                )}>
                  <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-105" />
                  {/* Subtle glow effect */}
                  {isActive && (
                    <div className="absolute inset-0 bg-white/20 rounded-full blur-sm animate-pulse"></div>
                  )}
                </div>
                
                {/* Label */}
                <span className={cn(
                  "font-medium transition-all duration-200 flex-1",
                  isActive ? "text-white" : "text-slate-700 group-hover:text-slate-900"
                )}>
                  {item.label}
                </span>
                
                {/* Hover effect background */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-blue-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 -z-10"></div>
              </div>
            </Link>
          );
        })}
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-slate-200/50 relative z-10">
        <Button
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          variant="ghost"
          className="w-full justify-start text-slate-600 hover:text-red-600 hover:bg-red-50/80 rounded-xl py-3 transition-all duration-300 group"
        >
          <LogOut className="w-4 h-4 mr-3 transition-transform duration-300 group-hover:scale-110" />
          <span className="font-medium">
            {logoutMutation.isPending ? "Logging out..." : "Log out"}
          </span>
        </Button>
      </div>
    </nav>
    </>
  );
}
