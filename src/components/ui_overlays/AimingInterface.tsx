import React, { useState, useRef, useCallback, useEffect } from 'react';

interface AimingInterfaceProps {
  onAimChange: (aim: { angle: number; power: number }) => void;
  // Store the current angle from the parent, so we can send it back with power changes
  currentAngle: number; 
}

const AimingInterface: React.FC<AimingInterfaceProps> = ({ 
  onAimChange, 
  currentAngle // Receive current angle from parent
}) => {
  const [power, setPower] = useState<number>(50); // Power (0-100)
  const joystickRef = useRef<HTMLDivElement>(null); // Ref for the joystick area
  const knobRef = useRef<HTMLDivElement>(null); // Ref for the knob
  const [isDragging, setIsDragging] = useState(false);

  // --- Type Aliases for Clarity ---
  type DragEvent = globalThis.MouseEvent | globalThis.TouchEvent;

  const calculateAngle = (x: number, y: number, centerX: number, centerY: number): number => {
    const deltaX = x - centerX;
    const deltaY = y - centerY;
    const angleRad = Math.atan2(deltaY, deltaX); // Use const
    let angleDeg = angleRad * (180 / Math.PI);
    angleDeg = (angleDeg + 360) % 360;
    return angleDeg;
  };

  // Use React event types for element handlers
  const handleDragStart = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    event.preventDefault();
  }, []);

  // Use NATIVE event types for window handlers
  const handleWindowDragMove = useCallback((event: DragEvent) => {
    if (!isDragging || !joystickRef.current || !knobRef.current) return;
    
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let clientX, clientY;
    // Check if TouchEvent exists AND if the event is an instance of it
    if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) { 
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      return; // Should not happen, or unsupported event type
    }

    const angleDeg = calculateAngle(clientX, clientY, centerX, centerY);
    const angleRad = angleDeg * (Math.PI / 180);
    const maxDist = rect.width / 2 - knobRef.current.offsetWidth / 2;
    const knobX = Math.cos(angleRad) * maxDist;
    const knobY = Math.sin(angleRad) * maxDist;

    knobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`;
    onAimChange({ angle: angleDeg, power });

  }, [isDragging, onAimChange, power]);

  // Use NATIVE event types for window handlers
  const handleWindowDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(0px, 0px)`;
    }
  }, [isDragging]);

  const handlePowerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newPower = Number(event.target.value);
    setPower(newPower);
    onAimChange({ angle: currentAngle, power: newPower });
  };

  // Attach NATIVE event listeners to window
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleWindowDragMove);
      window.addEventListener('touchmove', handleWindowDragMove);
      window.addEventListener('mouseup', handleWindowDragEnd);
      window.addEventListener('touchend', handleWindowDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleWindowDragMove);
      window.removeEventListener('touchmove', handleWindowDragMove);
      window.removeEventListener('mouseup', handleWindowDragEnd);
      window.removeEventListener('touchend', handleWindowDragEnd);
    };
  }, [isDragging, handleWindowDragMove, handleWindowDragEnd]);

  return (
    // Container for the aiming controls
    <div className="flex flex-col items-center space-y-3">
      
      {/* Joystick Area (Invisible Box) */}
      <div
        ref={joystickRef}
        className="w-28 h-28 bg-gray-800/50 rounded-full relative cursor-grab flex items-center justify-center touch-none"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        {/* Joystick Knob (Blurry Circle) - Styling can be refined */}
        {/* TODO: Add logic to move this knob based on touch/mouse */}
        <div 
          ref={knobRef}
          className={`
            w-10 h-10 bg-purple-500 rounded-full 
            shadow-lg shadow-purple-500/50 ring-2 ring-purple-400/30 
            pointer-events-none transition-transform duration-100 ease-linear
            ${isDragging ? 'opacity-100' : 'opacity-50'} // Conditional opacity class
          `}
          style={{ filter: 'blur(1px)' }} // Example blur effect
        ></div>
      </div>

      {/* Power Bar (Red Slider) */}
      <div className="w-full max-w-[150px] flex flex-col items-center pt-1"> 
        {/* <label htmlFor="powerSlider" className="text-xs font-medium text-red-300 mb-1">
          Power: {power.toFixed(0)}
        </label> */}
        <input 
          id="powerSlider"
          type="range" 
          min="0" 
          max="100" 
          step="1" 
          value={power}
          onChange={handlePowerChange}
          // Custom styling for a red power bar look
          className="w-full h-2 bg-gradient-to-r from-red-800 via-red-600 to-red-500 rounded-lg appearance-none cursor-pointer range-thumb:appearance-none range-thumb:w-3 range-thumb:h-3 range-thumb:bg-white range-thumb:rounded-full range-thumb:shadow-md" 
        />
      </div>
      
    </div>
  );
};

export default AimingInterface; 