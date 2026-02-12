import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import React from "react";

interface SidebarLinkProps {
  to: string;
  children: React.ReactNode;
  icon?: string;
}

export function SidebarLink({ to, children, icon }: SidebarLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');

  return (
    <motion.div
      className="relative"
      whileHover={{ x: 2 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Link
        to={to}
        className={`
          relative flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group
          ${isActive 
            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30' 
            : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
          }
        `}
      >
        {icon && (
          <span className="text-lg flex-shrink-0 group-hover:scale-110 transition-transform">{icon}</span>
        )}
        <span className="font-medium text-sm">{children}</span>
        {isActive && (
          <motion.div
            className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full shadow-lg"
            layoutId="activeIndicator"
            initial={false}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        {!isActive && (
          <motion.div
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600/0 to-blue-600/0 group-hover:from-blue-600/10 group-hover:to-blue-600/5 transition-all duration-200"
          />
        )}
      </Link>
    </motion.div>
  );
}

