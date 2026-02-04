import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Plus, LogOut, User, Bell, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationContext } from "@/contexts/notification-context";
import { NotificationDropdown } from "@/components/notification-dropdown";
import AddClientModal from "@/components/modals/add-client-modal";
import ComprehensiveClientModal from "@/components/modals/comprehensive-client-modal";
import AddAppointmentModal from "@/components/modals/add-appointment-modal";
import ThemeSelector from "@/components/theme-selector";
import { useTheme } from "@/contexts/theme-context";

const pageTitles = {
  "/": { title: "Dashboard", subtitle: "Welcome back! Here's your overview" },
  "/clients": { title: "Clients", subtitle: "Manage your client relationships" },
  "/documents": { title: "Documents", subtitle: "Upload and organize client documents" },
  "/calendar": { title: "Calendar", subtitle: "View and manage your schedule" },
  "/appointments": { title: "Appointments", subtitle: "Schedule and track meetings" },
  "/profile": { title: "Profile", subtitle: "Manage your account settings and preferences" },
};

export default function Header() {
  const [location] = useLocation();
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isComprehensiveClientModalOpen, setIsComprehensiveClientModalOpen] = useState(false);
  const [isAddAppointmentModalOpen, setIsAddAppointmentModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { user, logoutMutation } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotificationContext();
  const { theme, themes } = useTheme();

  const currentPage = pageTitles[location as keyof typeof pageTitles] || pageTitles["/"];
  
  const headerStyle = {
    backgroundColor: themes[theme].colors.surface,
    borderColor: themes[theme].colors.border,
    color: themes[theme].colors.text,
  };

  const handleAddButtonClick = () => {
    if (location === "/appointments" || location === "/calendar") {
      setIsAddAppointmentModalOpen(true);
    } else {
      setIsComprehensiveClientModalOpen(true);
    }
  };

  return (
    <>
      <header 
        className="relative shadow-xl border-b px-6 py-6 overflow-hidden transition-all duration-300"
        style={headerStyle}
      >
        {/* Background decoration */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: `linear-gradient(to right, ${themes[theme].colors.primary}08, transparent, ${themes[theme].colors.secondary}10)`
          }}
        ></div>
        <div 
          className="absolute -top-6 -right-6 w-32 h-32 rounded-full blur-3xl animate-pulse"
          style={{
            background: `linear-gradient(to bottom right, ${themes[theme].colors.primary}30, ${themes[theme].colors.secondary}20)`
          }}
        ></div>
        
        <div className="relative z-10 flex items-center justify-between">
          {/* Left Section - Page Title */}
          <div className="flex-1">
            <div className="hidden lg:block">
              <h1 className="text-2xl font-bold" style={{ color: themes[theme].colors.text }}>
                {currentPage.title}
              </h1>
              <p className="text-sm opacity-75" style={{ color: themes[theme].colors.textSecondary }}>
                {currentPage.subtitle}
              </p>
            </div>
            {/* Mobile title on small screens */}
            <div className="lg:hidden">
              <h1 className="text-lg font-bold" style={{ color: themes[theme].colors.text }}>
                {currentPage.title}
              </h1>
            </div>
          </div>
          
          {/* Right Section - Action Items */}
          <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
            {/* Enhanced Search Bar */}
            <div className="relative group hidden sm:block">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-600/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-md hover:shadow-lg transition-all duration-300">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 transition-colors duration-300 group-hover:text-primary" />
                <Input
                  type="text"
                  placeholder="Search clients, documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-4 py-3 w-60 lg:w-80 bg-transparent border-none focus:ring-0 text-slate-700 placeholder-slate-400 font-medium"
                />
              </div>
            </div>
            
            {/* Enhanced Add Button */}
            <Button 
              onClick={handleAddButtonClick}
              className="relative text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 rounded-2xl px-3 sm:px-6 py-2 sm:py-3 font-medium group overflow-hidden"
              style={{
                background: themes[theme].colors.gradient,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Plus className="w-4 sm:w-5 h-4 sm:h-5 sm:mr-2 relative z-10 transition-transform duration-300 group-hover:rotate-90" />
              <span className="relative z-10 hidden sm:inline">
                {location === "/appointments" || location === "/calendar" ? "Add Meeting" : "Add Client"}
              </span>
            </Button>
            
            {/* Theme Selector */}
            <ThemeSelector />
            
            {/* Enhanced Notification Dropdown */}
            <div className="relative">
              <NotificationDropdown
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                onMarkAllAsRead={markAllAsRead}
                onClearAll={clearAll}
              />
            </div>
            
            {/* Enhanced User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative flex items-center space-x-3 p-3 rounded-2xl hover:bg-slate-100/50 transition-all duration-300 group">
                  <div className="relative">
                    <Avatar className="h-10 w-10 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all duration-300">
                      {user?.profileImageUrl ? (
                        <AvatarImage 
                          src={user.profileImageUrl} 
                          alt="Profile picture"
                          className="object-cover"
                        />
                      ) : null}
                      <AvatarFallback className="bg-gradient-to-r from-primary to-blue-600 text-white font-bold">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors duration-300">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">{user?.email}</div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-white/95 backdrop-blur-sm border border-slate-200/50 shadow-xl rounded-2xl p-2">
                <DropdownMenuLabel className="text-slate-700 font-bold px-3 py-2">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-200/50" />
                <DropdownMenuItem 
                  onClick={() => window.location.href = "/profile"}
                  className="rounded-xl hover:bg-slate-50 transition-all duration-200 cursor-pointer px-3 py-2">
                  <User className="mr-3 h-4 w-4 text-slate-600" />
                  <span className="font-medium text-slate-700">Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-200/50" />
                <DropdownMenuItem 
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  className="rounded-xl hover:bg-red-50 transition-all duration-200 cursor-pointer px-3 py-2 text-red-600"
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span className="font-medium">{logoutMutation.isPending ? "Logging out..." : "Log out"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <AddClientModal 
        isOpen={isAddClientModalOpen} 
        onClose={() => setIsAddClientModalOpen(false)} 
      />
      
      <ComprehensiveClientModal 
        isOpen={isComprehensiveClientModalOpen} 
        onClose={() => setIsComprehensiveClientModalOpen(false)} 
      />
      
      <AddAppointmentModal 
        isOpen={isAddAppointmentModalOpen} 
        onClose={() => setIsAddAppointmentModalOpen(false)} 
      />
    </>
  );
}
