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
        relative p-4 rounded-lg cursor-pointer transition-all duration-200
        ${isActive 
          ? 'bg-blue-50 border-2 border-blue-500 shadow-md' 
          : 'bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm'
        }
      `}
    >
      {children}
      
      {/* Badge de mensagens não lidas */}
      {unreadCount > 0 && !isActive && (
        <motion.div
          className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold rounded-full px-2 py-1 min-w-[20px] text-center"
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
      {isActive && (
        <motion.div
          className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r"
          layoutId="activeConversation"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </motion.div>
  );
}

