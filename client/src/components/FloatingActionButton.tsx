import { Plus, X, Briefcase, FileText, DollarSign } from "lucide-react";
import { useState } from "react";

interface FloatingActionButtonProps {
  onCreateJob?: () => void;
  onCreateQuote?: () => void;
  onCreateInvoice?: () => void;
}

export default function FloatingActionButton({ 
  onCreateJob,
  onCreateQuote,
  onCreateInvoice
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { label: "New Job", icon: Briefcase, onClick: onCreateJob, color: 'hsl(var(--trade))', bgColor: 'hsl(var(--trade) / 0.15)' },
    { label: "New Quote", icon: FileText, onClick: onCreateQuote, color: 'hsl(217, 91%, 60%)', bgColor: 'hsl(217, 91%, 60% / 0.15)' },
    { label: "New Invoice", icon: DollarSign, onClick: onCreateInvoice, color: 'hsl(142, 76%, 36%)', bgColor: 'hsl(142, 76%, 36% / 0.15)' },
  ].filter(a => a.onClick);

  const handleActionClick = (action: () => void | undefined) => {
    if (action) {
      action();
      setIsOpen(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 md:hidden" data-testid="fab-container">
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-16 right-0 flex flex-col-reverse gap-3 z-50">
            {actions.map((action, index) => (
              <div 
                key={action.label}
                className="flex items-center gap-3 animate-fade-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-xs font-medium bg-background/95 backdrop-blur px-2.5 py-1 rounded-full shadow-md border">
                  {action.label}
                </span>
                <button
                  onClick={() => handleActionClick(action.onClick!)}
                  className="h-10 w-10 rounded-full shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center border"
                  style={{ 
                    backgroundColor: action.bgColor, 
                    borderColor: action.color,
                    color: action.color
                  }}
                  data-testid={`fab-action-${action.label.toLowerCase().replace(' ', '-')}`}
                  aria-label={action.label}
                  type="button"
                >
                  <action.icon className="h-4 w-4" style={{ color: action.color }} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95 z-50 flex items-center justify-center ${
          isOpen 
            ? 'bg-muted-foreground rotate-45' 
            : 'bg-primary border border-primary-border'
        }`}
        data-testid="fab-main"
        aria-label={isOpen ? "Close menu" : "Quick add"}
        type="button"
      >
        {isOpen ? (
          <X className="h-5 w-5 text-white -rotate-45" />
        ) : (
          <Plus className="h-5 w-5 text-primary-foreground" />
        )}
      </button>
    </div>
  );
}
