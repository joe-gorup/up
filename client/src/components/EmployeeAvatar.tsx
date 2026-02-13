import React from 'react';

interface EmployeeAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm', 
  lg: 'h-16 w-16 text-lg'
};

const getInitials = (name: string): string => {
  const names = name.trim().split(' ');
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

const getBackgroundColor = (name: string): string => {
  // Generate consistent color based on name
  const colors = [
    'bg-blue-500',
    'bg-green-500', 
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-teal-500'
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

export default function EmployeeAvatar({ 
  name, 
  imageUrl, 
  size = 'md',
  className = ''
}: EmployeeAvatarProps) {
  const sizeClass = sizeClasses[size];
  
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover ${className}`}
        data-testid={`avatar-image-${name.toLowerCase().replace(/\s+/g, '-')}`}
      />
    );
  }

  const initials = getInitials(name);
  const bgColor = getBackgroundColor(name);

  return (
    <div
      className={`${sizeClass} rounded-full ${bgColor} flex items-center justify-center text-white font-medium ${className}`}
      data-testid={`avatar-initials-${name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {initials}
    </div>
  );
}