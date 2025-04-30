import React, { useState, useEffect } from 'react';

interface AimingInterfaceProps {
  onAimChange: (aim: { angle: number; power: number }) => void;
  // onSubmit prop removed
  // Optional initial values if needed later
  // initialAngle?: number; // in radians
  // initialPower?: number;
}

const AimingInterface: React.FC<AimingInterfaceProps> = ({ 
  onAimChange, 
  // onSubmit prop removed
  // initialAngle = 0, // Default values if using props
  // initialPower = 50
}) => {
  // Angle state removed - will be handled by joystick implementation later
  // const [angleDegrees, setAngleDegrees] = useState<number>(0); 
  const [power, setPower] = useState<number>(50); // Power (0-100)

  // TODO: Update useEffect to get angle from joystick state later
  useEffect(() => {
    // Placeholder angle until joystick is implemented
    const angleRadians = 0; // angleDegrees * (Math.PI / 180);
    onAimChange({ angle: angleRadians, power });
  }, [power, onAimChange]); // Removed angleDegrees from dependencies

  // Angle handler removed
  // const handleAngleChange = (event: React.ChangeEvent<HTMLInputElement>) => { ... };

  const handlePowerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPower(Number(event.target.value));
  };

  return (
    // Container for the aiming controls
    <div className="flex flex-col items-center space-y-3">
      
      {/* Joystick Area (Invisible Box) */}
      <div className="w-28 h-28 bg-gray-800/50 rounded-full relative cursor-grab flex items-center justify-center"> 
        {/* Joystick Knob (Blurry Circle) - Styling can be refined */}
        {/* TODO: Add logic to move this knob based on touch/mouse */}
        <div 
            className="w-10 h-10 bg-purple-500 rounded-full shadow-lg shadow-purple-500/50 ring-2 ring-purple-400/30"
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