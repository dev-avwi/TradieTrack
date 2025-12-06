import { Plus } from "lucide-react";

interface FloatingActionButtonProps {
  onClick?: () => void;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  ariaLabel?: string;
}

export default function FloatingActionButton({ 
  onClick, 
  children, 
  icon = <Plus className="h-6 w-6 text-white" />, 
  ariaLabel = "Add new"
}: FloatingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95 z-50 md:hidden flex items-center justify-center bg-primary text-primary-foreground border border-primary-border"
      data-testid="fab-main"
      aria-label={ariaLabel}
      type="button"
    >
      {children || icon}
    </button>
  );
}