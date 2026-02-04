import { formatDistanceToNow } from 'date-fns';
import { User } from '@shared/schema';

interface PresenceIndicatorProps {
  user: User;
  showLastSeen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PresenceIndicator({ user, showLastSeen = false, size = 'md' }: PresenceIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const containerSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const getLastSeenText = () => {
    if (!user.lastSeen) return 'Never';
    
    const lastSeen = new Date(user.lastSeen);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);
    
    if (diffInMinutes < 5) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    return formatDistanceToNow(lastSeen, { addSuffix: true });
  };

  return (
    <div className={`flex items-center space-x-2 ${containerSizeClasses[size]}`}>
      <div className="relative">
        <div className={`${sizeClasses[size]} rounded-full ${
          user.isOnline ? 'bg-green-500' : 'bg-gray-400'
        }`}>
          {user.isOnline && (
            <div className={`${sizeClasses[size]} rounded-full bg-green-500 animate-ping absolute top-0 left-0 opacity-75`} />
          )}
        </div>
      </div>
      
      {showLastSeen && (
        <span className="text-gray-500 text-xs">
          {user.isOnline ? 'Online' : `Last seen ${getLastSeenText()}`}
        </span>
      )}
    </div>
  );
}