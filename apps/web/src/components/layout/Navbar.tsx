import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NavbarProps {
  showNewAnalysis?: boolean;
}

export function Navbar({ showNewAnalysis = false }: NavbarProps) {
  const navigate = useNavigate();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="sticky top-0 z-40 h-16 bg-surface/80 backdrop-blur-sm border-b border-border"
    >
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 32 32" className="w-8 h-8" aria-hidden="true">
            <circle cx="16" cy="16" r="16" fill="#1F3D72" />
            <text
              x="16"
              y="21"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="white"
              fontFamily="Plus Jakarta Sans, Inter, sans-serif"
            >
              KA
            </text>
          </svg>
          <span className="font-display font-bold text-navy-900">KOBİ Advisor</span>
          <span className="badge bg-emerald-50 text-emerald-700">AI CFO</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="badge bg-navy-50 text-navy-600 hidden sm:inline-flex">
            BTK Hackathon '26
          </span>
          {showNewAnalysis && (
            <button type="button" className="btn-primary" onClick={() => navigate("/")}>
              <Plus className="w-4 h-4" />
              Yeni Analiz
            </button>
          )}
        </div>
      </div>
    </motion.header>
  );
}
