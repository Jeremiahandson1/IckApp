// Generic collapsible card used by every secondary section on the product
// page (nutrition, additives, swaps, recipes, full ingredients).

import { ChevronDown, ChevronUp } from 'lucide-react';

export default function CollapsibleSection({ title, subtitle, icon: Icon, iconColor, expanded, onToggle, children }) {
  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <div className="text-left">
            <span className="font-semibold text-[#f4f4f0]">{title}</span>
            {subtitle && <span className="text-xs text-[#888] ml-2">{subtitle}</span>}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-[#888]" /> : <ChevronDown className="w-5 h-5 text-[#888]" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-[#2a2a2a] pt-4">{children}</div>
      )}
    </div>
  );
}
