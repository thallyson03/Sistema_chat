import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import React, { useState, useRef, useEffect } from "react";

interface SubmenuItem {
  to: string;
  label: string;
  icon: string;
}

interface SidebarDropdownLinkProps {
  icon: string;
  label: string;
  submenuTitle: string;
  items: SubmenuItem[];
}

export function SidebarDropdownLink({ 
  icon, 
  label, 
  submenuTitle, 
  items 
}: SidebarDropdownLinkProps) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const isAnyItemActive = items.some(item => location.pathname === item.to || location.pathname.startsWith(item.to + '/'));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Calcular posição quando abrir
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPosition({
          top: rect.top,
          left: rect.right + 12, // 12px de margem
        });
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <>
      <div className="relative z-50" ref={dropdownRef}>
        <motion.div
          ref={buttonRef}
          className={`
            relative flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer group
            ${isAnyItemActive || isOpen
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30' 
              : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }
          `}
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ x: 2 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
        <div className="flex items-center gap-3">
          <span className="text-lg flex-shrink-0">{icon}</span>
          <span className="font-medium text-sm">{label}</span>
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-xs ml-2"
        >
          ▼
        </motion.span>
        {(isAnyItemActive || isOpen) && (
          <motion.div
            className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r"
            layoutId="activeIndicator"
            initial={false}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 rounded-2xl shadow-2xl z-[9999] overflow-hidden border border-slate-700/60 backdrop-blur-xl"
            style={{ 
              minWidth: '300px', 
              maxWidth: '340px',
              top: `${position.top}px`,
              left: `${position.left}px`
            }}
          >
            {/* Header com gradiente */}
            <div className="px-5 py-3 border-b border-slate-700/60 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
              <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">
                {submenuTitle}
              </h3>
            </div>

            {/* Items */}
            <div className="py-2">
              {items.map((item, index) => {
                const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04, ease: "easeOut" }}
                      whileHover={{ x: 4 }}
                      className={`
                        relative px-5 py-3 mx-2 my-1 rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-200 group
                        ${isActive
                          ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                          : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                        }
                      `}
                    >
                      {/* Ícone com background */}
                      <div className={`
                        w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 transition-all duration-200
                        ${isActive
                          ? 'bg-white/20'
                          : 'bg-slate-700/50 group-hover:bg-slate-600/50'
                        }
                      `}>
                        {item.icon}
                      </div>
                      
                      {/* Label */}
                      <span className="font-semibold text-sm whitespace-nowrap flex-1">
                        {item.label}
                      </span>

                      {/* Indicador de ativo */}
                      {isActive && (
                        <motion.div
                          className="absolute right-3 w-2 h-2 rounded-full bg-white"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                        />
                      )}

                      {/* Seta para itens ativos */}
                      {isActive && (
                        <motion.svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </motion.svg>
                      )}
                    </motion.div>
                  </Link>
                );
              })}
            </div>

            {/* Footer decorativo */}
            <div className="px-5 py-2 border-t border-slate-700/60">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></div>
                <span>{items.length} {items.length === 1 ? 'opção' : 'opções'}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

