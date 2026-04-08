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
          relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
          ${isActive 
            ? 'bg-emerald-900/35 text-primary-fixed-dim font-semibold' 
            : 'text-on-surface-variant hover:bg-emerald-900/20 hover:text-on-surface'
          }
        `}
      >
        {icon && (
          <span className="text-lg flex-shrink-0 text-primary-fixed-dim group-hover:scale-110 transition-transform">{icon}</span>
        )}
        <span className="font-medium text-sm">{children}</span>
        {isActive && (
          <motion.div
            className="absolute left-0 top-1 bottom-1 w-1 bg-primary rounded-r-full"
            layoutId="activeIndicator"
            initial={false}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        {!isActive && (
          <motion.div
            className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-900/0 to-emerald-900/0 group-hover:from-emerald-900/20 group-hover:to-emerald-900/5 transition-all duration-200"
          />
        )}
      </Link>
    </motion.div>
  );
}

