import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { NotificationProvider } from "@/contexts/notification-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { ProtectedRoute } from "@/lib/protected-route";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";

import Calendar from "@/pages/calendar";
import Appointments from "@/pages/appointments";
import AuthPage from "@/pages/auth-page";
import TeamMembers from "@/pages/team-members";
import Booking from "@/pages/booking";
import BookingCalendar from "@/pages/booking-calendar";
import Settings from "@/pages/settings";
import Users from "@/pages/users";
import Kanban from "@/pages/kanban";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";
import PresenceProvider from "@/components/presence-provider";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/*">
        <div className="flex h-screen overflow-hidden bg-crm-bg">
          <Sidebar />
          <main className="flex-1 overflow-y-auto lg:ml-0">
            <Header />
            <Switch>
              <ProtectedRoute path="/" component={Dashboard} />
              <ProtectedRoute path="/clients" component={Clients} />

              <ProtectedRoute path="/calendar" component={Calendar} />
              <ProtectedRoute path="/appointments" component={Appointments} />
              <ProtectedRoute path="/team-members" component={TeamMembers} />
              <ProtectedRoute path="/users" component={TeamMembers} />

              <ProtectedRoute path="/booking-calendar" component={BookingCalendar} />
              <ProtectedRoute path="/kanban" component={Kanban} />
              <ProtectedRoute path="/profile" component={Profile} />
              <ProtectedRoute path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <PresenceProvider>
              <TooltipProvider>
                <Router />
                <Toaster />
              </TooltipProvider>
            </PresenceProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
