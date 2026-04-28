import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  icon: React.ReactNode;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
}

export function IconButton({
  icon,
  variant = 'default',
  size = 'md',
  tooltip,
  className = '',
  ...props
}: IconButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    default: 'border border-[rgba(63,73,69,0.3)] bg-surface-container-highest text-on-surface-variant focus:ring-primary/40 hover:bg-surface-variant hover:text-on-surface',
    primary: 'active-gradient-emerald text-on-primary focus:ring-primary',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    ghost: 'bg-transparent text-on-surface-variant focus:ring-primary/40 hover:bg-surface-container-highest hover:text-on-surface',
  };

  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <motion.button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={tooltip}
      {...props}
    >
      {icon}
    </motion.button>
  );
}




