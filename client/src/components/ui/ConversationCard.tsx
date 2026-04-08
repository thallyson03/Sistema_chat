import { motion } from 'framer-motion';
import React from 'react';

interface ConversationCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
  unreadCount?: number;
  index?: number;
}

export function ConversationCard({ 
  children, 
  onClick, 
  isActive = false,
  unreadCount = 0,
  index = 0
}: ConversationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ 
        duration: 0.3,
        delay: index * 0.05,
        type: "spring",
        stiffness: 100
      }}
      whileHover={{ 
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        relative px-4 py-4 cursor-pointer transition-all duration-200 rounded-none
        ${isActive
          ? 'bg-emerald-950/20 border-l-4 border-emerald-400'
          : 'border-l-4 border-transparent hover:bg-emerald-900/10'
        }
      `}
    >
      {children}
      
      {/* Badge de mensagens não lidas */}
      {unreadCount > 0 && !isActive && (
        <motion.div
          className="absolute top-2 right-2 bg-primary text-on-primary text-xs font-bold rounded-full px-2 py-1 min-w-[20px] text-center shadow-emerald-send"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ 
            type: "spring",
            stiffness: 500,
            damping: 15
          }}
          whileHover={{ scale: 1.1 }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </motion.div>
      )}
      
      {/* Indicador de ativo */}
    </motion.div>
  );
}

