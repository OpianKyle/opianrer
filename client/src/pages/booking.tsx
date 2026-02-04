import BookingSystem from "@/components/booking-system";
import { useTheme } from "@/contexts/theme-context";

export default function Booking() {
  const { theme, themes } = useTheme();
  
  return (
    <div 
      className="min-h-screen transition-all duration-300"
      style={{
        backgroundColor: themes[theme].colors.background,
      }}
    >
      <BookingSystem />
    </div>
  );
}