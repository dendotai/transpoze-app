import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Check, X } from 'lucide-react';

interface FilePatternInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const VARIABLES = ['{name}', '{number}'];

export interface FilePatternInputHandle {
  input: HTMLInputElement | null;
  cursorPosition: number;
}

export const FilePatternInput = forwardRef<FilePatternInputHandle, FilePatternInputProps>(({
  value,
  onChange,
  placeholder = "{name}_converted",
  className = ""
}, ref) => {
  const [cursorPosition, setCursorPosition] = useState(0);
  const [suggestion, setSuggestion] = useState('');
  const [scrollLeft, setScrollLeft] = useState(0);
  const [_isOverflowing, setIsOverflowing] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastValueRef = useRef(value);
  const lastCursorRef = useRef(cursorPosition);

  // Forward the ref to the parent component with cursor position
  useImperativeHandle(ref, () => ({
    input: inputRef.current,
    cursorPosition
  }), [cursorPosition]);

  // Validate pattern
  const validatePattern = (pattern: string | undefined): boolean => {
    if (!pattern || typeof pattern !== 'string') return true;
    let braceCount = 0;
    for (const char of pattern) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (braceCount < 0) return false;
    }
    if (braceCount !== 0) return false;
    
    const placeholderRegex = /\{([^}]+)\}/g;
    const matches = pattern.match(placeholderRegex);
    if (matches) {
      for (const match of matches) {
        if (match !== '{name}' && match !== '{number}') return false;
      }
    }
    
    const invalidChars = /[<>:"|?*\\/]/;
    const withoutPlaceholders = pattern.replace(placeholderRegex, '');
    if (invalidChars.test(withoutPlaceholders)) return false;
    
    return true;
  };

  // Calculate suggestion
  const calculateSuggestion = useCallback((val: string, cursor: number) => {
    const beforeCursor = val.substring(0, cursor);
    const afterCursor = val.substring(cursor);
    const lastOpenBrace = beforeCursor.lastIndexOf('{');
    const lastCloseBrace = beforeCursor.lastIndexOf('}');
    
    // Check if we're inside an open brace
    if (lastOpenBrace > lastCloseBrace && lastOpenBrace >= 0) {
      const partialVariable = beforeCursor.substring(lastOpenBrace);
      
      // Find matching variable
      const match = VARIABLES.find(v => 
        v.toLowerCase().startsWith(partialVariable.toLowerCase()) && 
        v !== partialVariable
      );
      
      if (match) {
        // Extract the remaining part to suggest
        const suggestionText = match.substring(partialVariable.length);
        
        // Check if inserting the suggestion would create a valid variable
        // without requiring deletion of existing text
        const wouldComplete = partialVariable + suggestionText;
        
        // If the suggestion ends with } and afterCursor starts with }, that's ok
        if (afterCursor.startsWith('}') && suggestionText.endsWith('}')) {
          // Special case: {nam|} suggesting "e}" - we'll only insert "e"
          return suggestionText.slice(0, -1);
        } else if (afterCursor === '' || afterCursor.startsWith('}') || afterCursor.startsWith(' ') || afterCursor.startsWith('_')) {
          // Safe to suggest - nothing after cursor or valid separator
          return suggestionText;
        } else {
          // Check if what we'd create is still a valid partial match
          const combined = wouldComplete + afterCursor.split(/[}\s_]/, 1)[0];
          const isValidPartial = VARIABLES.some(v => v.startsWith(combined));
          if (!isValidPartial) {
            return '';
          } else {
            return suggestionText;
          }
        }
      }
    }
    return '';
  }, []);

  // Update suggestion when value or cursor changes
  useEffect(() => {
    // Only recalculate if value or cursor actually changed
    if (value !== lastValueRef.current || cursorPosition !== lastCursorRef.current) {
      const newSuggestion = calculateSuggestion(value, cursorPosition);
      setSuggestion(newSuggestion);
      lastValueRef.current = value;
      lastCursorRef.current = cursorPosition;
    }
  }, [value, cursorPosition, calculateSuggestion]);

  // Check for overflow and sync scroll
  useEffect(() => {
    const checkOverflow = () => {
      if (inputRef.current) {
        const input = inputRef.current;
        const isOverflow = input.scrollWidth > input.clientWidth;
        setIsOverflowing(isOverflow);
        // Sync scroll position
        setScrollLeft(input.scrollLeft);
        // Check if we can scroll in either direction
        setCanScrollLeft(input.scrollLeft > 0);
        setCanScrollRight(input.scrollLeft < input.scrollWidth - input.clientWidth);
      }
    };
    
    checkOverflow();
    // Also check after a small delay to account for font loading
    const timer = setTimeout(checkOverflow, 100);
    
    return () => clearTimeout(timer);
  }, [value, cursorPosition]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart || 0;
    onChange(newValue);
    setCursorPosition(newCursorPos);
  };

  const handleScroll = (e: React.UIEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    setScrollLeft(input.scrollLeft);
    setCanScrollLeft(input.scrollLeft > 0);
    setCanScrollRight(input.scrollLeft < input.scrollWidth - input.clientWidth);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      const beforeCursor = value.substring(0, cursorPosition);
      const afterCursor = value.substring(cursorPosition);
      const newValue = beforeCursor + suggestion + afterCursor;
      onChange(newValue);
      const newPos = cursorPosition + suggestion.length;
      setCursorPosition(newPos);
      setTimeout(() => {
        inputRef.current?.setSelectionRange(newPos, newPos);
      }, 0);
      setSuggestion('');
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      // Clear suggestion on navigation
      setSuggestion('');
      // Update scroll position after navigation
      setTimeout(() => {
        if (inputRef.current) {
          setScrollLeft(inputRef.current.scrollLeft);
        }
      }, 0);
    }
  };

  const handleSelect = (e: React.MouseEvent<HTMLInputElement>) => {
    const pos = e.currentTarget.selectionStart || 0;
    setCursorPosition(pos);
  };
  
  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Update cursor position after key up to ensure it's accurate
    const pos = e.currentTarget.selectionStart || 0;
    setCursorPosition(pos);
    // Sync scroll position
    if (inputRef.current) {
      setScrollLeft(inputRef.current.scrollLeft);
    }
  };

  const isValid = validatePattern(value);

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onSelect={handleSelect}
        onClick={handleSelect}
        placeholder={placeholder}
        className={`w-full px-3 py-2 pr-10 border rounded-lg text-transparent caret-gray-800 dark:caret-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-500 ${
          value && !isValid
            ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-950/20'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
        } ${className}`}
      />
      
      {/* Syntax highlighted overlay with suggestion */}
      <div className="absolute left-0 right-10 top-0 bottom-0 px-3 py-2 pointer-events-none overflow-hidden">
        <div 
          className="flex items-center h-full"
          style={{ transform: `translateX(-${scrollLeft}px)` }}
        >
          <span className="whitespace-nowrap">
          {(() => {
            // Insert suggestion at cursor position
            const beforeCursor = value.substring(0, cursorPosition);
            const afterCursor = value.substring(cursorPosition);
            const fullText = beforeCursor + (suggestion || '') + afterCursor;
            
            let charIndex = 0;
            return fullText.split(/(\{[^}]*\}?)/).map((part, i) => {
              const partStart = charIndex;
              const partEnd = charIndex + part.length;
              charIndex = partEnd;
              
              // Check if this part contains the suggestion
              const suggestionStart = cursorPosition;
              const suggestionEnd = cursorPosition + suggestion.length;
              const containsSuggestion = suggestion && partStart < suggestionEnd && partEnd > suggestionStart;
              
              if (part.startsWith('{')) {
                const isValid = part.endsWith('}') && (part === '{name}' || part === '{number}');
                const isIncomplete = part === '{' || (part.startsWith('{') && !part.endsWith('}'));
                
                // If this part contains suggestion, split it
                if (containsSuggestion) {
                  const beforeSuggestion = part.substring(0, Math.max(0, suggestionStart - partStart));
                  const suggestionPart = part.substring(Math.max(0, suggestionStart - partStart), Math.min(part.length, suggestionEnd - partStart));
                  const afterSuggestion = part.substring(Math.min(part.length, suggestionEnd - partStart));
                  
                  return (
                    <span key={i}>
                      {beforeSuggestion && (
                        <span className={
                          isValid
                            ? 'text-primary-600 dark:text-primary-400'
                            : isIncomplete
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }>{beforeSuggestion}</span>
                      )}
                      {suggestionPart && (
                        <span className="text-gray-400 dark:text-gray-500">{suggestionPart}</span>
                      )}
                      {afterSuggestion && (
                        <span className={
                          isValid
                            ? 'text-primary-600 dark:text-primary-400'
                            : isIncomplete
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }>{afterSuggestion}</span>
                      )}
                    </span>
                  );
                }
                
                return (
                  <span
                    key={i}
                    className={
                      isValid
                        ? 'text-primary-600 dark:text-primary-400'
                        : isIncomplete
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                    }
                  >
                    {part}
                  </span>
                );
              }
              
              // Handle non-brace parts
              if (containsSuggestion) {
                const beforeSuggestion = part.substring(0, Math.max(0, suggestionStart - partStart));
                const suggestionPart = part.substring(Math.max(0, suggestionStart - partStart), Math.min(part.length, suggestionEnd - partStart));
                const afterSuggestion = part.substring(Math.min(part.length, suggestionEnd - partStart));
                
                return (
                  <span key={i}>
                    {beforeSuggestion && <span className="text-gray-800 dark:text-gray-200">{beforeSuggestion}</span>}
                    {suggestionPart && <span className="text-gray-400 dark:text-gray-500">{suggestionPart}</span>}
                    {afterSuggestion && <span className="text-gray-800 dark:text-gray-200">{afterSuggestion}</span>}
                  </span>
                );
              }
              
              return <span key={i} className="text-gray-800 dark:text-gray-200">{part}</span>;
            });
          })()}
          {value === '' && !suggestion && (
            <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
          )}
        </span>
        </div>
      </div>
      
      {/* Left gradient when scrolled right */}
      {canScrollLeft && (
        <div className={`absolute left-0 top-1 bottom-1 w-6 pointer-events-none bg-gradient-to-r ${
          value && !isValid
            ? 'from-red-50 dark:from-red-950/20'
            : 'from-white dark:from-gray-800'
        } to-transparent rounded-l`} />
      )}
      
      {/* Right gradient when can scroll more to the right */}
      {canScrollRight && (
        <div className={`absolute right-10 top-1 bottom-1 w-6 pointer-events-none bg-gradient-to-l ${
          value && !isValid
            ? 'from-red-50 dark:from-red-950/20'
            : 'from-white dark:from-gray-800'
        } to-transparent rounded-r`} />
      )}
      
      {/* Validation indicator */}
      <div className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
        value && !isValid
          ? 'bg-red-50 dark:bg-red-950/20'
          : 'bg-white dark:bg-gray-800'
      }`}>
        {value && (
          isValid ? (
            <Check className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          ) : (
            <X className="w-4 h-4 text-red-500" />
          )
        )}
      </div>
    </div>
  );
});

FilePatternInput.displayName = 'FilePatternInput';