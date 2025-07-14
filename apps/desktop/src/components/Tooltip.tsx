import React, { ReactNode, useState, useRef, useEffect } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: string;
  delay?: number;
}

export function Tooltip({ children, content, delay = 70 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculatePosition = () => {
    if (!containerRef.current || !tooltipRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const padding = 8;
    const gap = 6; // Gap between element and tooltip
    
    // Start with centered position
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let arrowLeft = '50%';
    let arrowTransform = 'translateX(-50%)';
    
    // Adjust if tooltip goes off right edge
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
      const arrowOffset = rect.left + rect.width / 2 - left;
      arrowLeft = `${arrowOffset}px`;
      arrowTransform = 'none';
    }
    // Adjust if tooltip goes off left edge
    else if (left < padding) {
      left = padding;
      const arrowOffset = rect.left + rect.width / 2 - left;
      arrowLeft = `${arrowOffset}px`;
      arrowTransform = 'none';
    }
    
    setTooltipStyle({
      top: rect.top - tooltipRect.height - gap,
      left: left,
      opacity: 1
    });
    
    setArrowStyle({
      left: arrowLeft,
      transform: arrowTransform
    });
  };

  useEffect(() => {
    if (isVisible) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        calculatePosition();
      });
    }
  }, [isVisible]);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  return (
    <>
      <div 
        ref={containerRef}
        className="inline-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {isVisible && (
        <div 
          ref={tooltipRef}
          className="fixed z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-nowrap pointer-events-none transition-opacity duration-150"
          style={{
            ...tooltipStyle,
            opacity: tooltipStyle.opacity || 0
          }}
        >
          {content}
          <div 
            className="absolute -bottom-1"
            style={arrowStyle}
          >
            <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
          </div>
        </div>
      )}
    </>
  );
}