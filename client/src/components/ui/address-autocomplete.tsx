import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (address: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
  disabled?: boolean;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

function formatAustralianAddress(result: NominatimResult): string {
  const addr = result.address;
  const parts: string[] = [];

  if (addr.house_number && addr.road) {
    parts.push(`${addr.house_number} ${addr.road}`);
  } else if (addr.road) {
    parts.push(addr.road);
  }

  const locality = addr.suburb || addr.city || addr.town || addr.village;
  if (locality) parts.push(locality);

  const stateAbbr = addr.state ? getStateAbbreviation(addr.state) : "";
  if (stateAbbr && addr.postcode) {
    parts.push(`${stateAbbr} ${addr.postcode}`);
  } else if (stateAbbr) {
    parts.push(stateAbbr);
  }

  return parts.length > 0 ? parts.join(", ") : result.display_name;
}

function getStateAbbreviation(state: string): string {
  const map: Record<string, string> = {
    "New South Wales": "NSW",
    "Victoria": "VIC",
    "Queensland": "QLD",
    "South Australia": "SA",
    "Western Australia": "WA",
    "Tasmania": "TAS",
    "Northern Territory": "NT",
    "Australian Capital Territory": "ACT",
  };
  return map[state] || state;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder,
  className,
  disabled,
  ...props
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;
    const delay = timeSinceLastFetch < 1000 ? 1000 - timeSinceLastFetch : 0;

    await new Promise((resolve) => setTimeout(resolve, delay));

    setIsLoading(true);
    try {
      const encoded = encodeURIComponent(query);
      const response = await fetch(`/api/address-search?q=${encoded}`);
      lastFetchRef.current = Date.now();
      if (response.ok) {
        const data: NominatimResult[] = await response.json();
        setSuggestions(data);
        setIsOpen(data.length > 0);
        setHighlightedIndex(-1);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (newValue.length >= 3) {
      setIsLoading(true);
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(newValue);
      }, 300);
    } else {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
    }
  };

  const handleSelect = (result: NominatimResult) => {
    const formatted = formatAustralianAddress(result);
    onChange(formatted);
    onAddressSelect?.(formatted, parseFloat(result.lat), parseFloat(result.lon));
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("pr-8", className)}
          disabled={disabled}
          data-testid={props["data-testid"]}
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover text-popover-foreground shadow-md">
          {suggestions.map((result, index) => (
            <div
              key={`${result.lat}-${result.lon}-${index}`}
              className={cn(
                "flex items-start gap-2 px-3 py-2 cursor-pointer text-sm",
                index === highlightedIndex && "bg-accent"
              )}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(result);
              }}
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">
                {formatAustralianAddress(result)}
              </span>
            </div>
          ))}
        </div>
      )}

      {isOpen && isLoading && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Searching...</span>
          </div>
        </div>
      )}
    </div>
  );
}
