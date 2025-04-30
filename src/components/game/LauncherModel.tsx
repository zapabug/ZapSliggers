import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface LauncherModelProps {
  position: [number, number, number];
  isPlayer1: boolean;
  aimAngle: number; // Angle in radians for aiming (around Y-axis)
}

const LauncherModel: React.FC<LauncherModelProps> = ({ position, isPlayer1, aimAngle }) => {
  const groupRef = useRef<THREE.Group>(null);
  const aimingPartRef = useRef<THREE.Mesh>(null); // Ref for the part that rotates
  const color = isPlayer1 ? '#6366f1' : '#ec4899'; // Indigo for P1, Pink for P2
  const cannonColor = '#4b5563'; // Dark grey
  const aimingPartColor = isPlayer1 ? '#a5b4fc' : '#f9a8d4'; // Lighter player color

  // Update rotation when aimAngle changes
  useEffect(() => {
    if (aimingPartRef.current) {
      aimingPartRef.current.rotation.y = aimAngle;
    }
  }, [aimAngle]);

  return (
    <group ref={groupRef} position={position}>
      {/* Hull (wider, flatter box) */}
      <mesh castShadow position={[0, -0.25, 0]}> 
        <boxGeometry args={[2.5, 0.5, 1.5]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Cannons (cylinders on the sides) */}
      {/* Adjust Y position to be slightly above the hull base */}
      {/* Adjust Z position to point slightly outwards if desired */}
      {/* Left Cannon */}
      <mesh castShadow position={[-1.3, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}> 
        <cylinderGeometry args={[0.2, 0.2, 0.8, 16]} /> {/* radiusTop, radiusBottom, height, radialSegments */}
        <meshStandardMaterial color={cannonColor} />
      </mesh>
      {/* Right Cannon */}
      <mesh castShadow position={[1.3, 0.1, 0]} rotation={[0, 0, -Math.PI / 2]}> 
        <cylinderGeometry args={[0.2, 0.2, 0.8, 16]} />
        <meshStandardMaterial color={cannonColor} />
      </mesh>

      {/* Aiming Part (e.g., central arrow launcher barrel) */}
      {/* Position it slightly above the hull */}
      <mesh ref={aimingPartRef} castShadow position={[0, 0.25, 0]}> 
        <cylinderGeometry args={[0.15, 0.15, 1.2, 16]} /> {/* Slimmer, longer cylinder */}
        {/* Rotate the geometry so it points forward (along Z) before instance rotation */}
        <meshStandardMaterial color={aimingPartColor} />
      </mesh>

      {/* Optional: Simple Mast Base */}
      {/* <mesh castShadow position={[0, 0.25, -0.5]}> 
        <cylinderGeometry args={[0.1, 0.1, 0.5, 8]} />
        <meshStandardMaterial color={color} />
      </mesh> */}

    </group>
  );
};

export default LauncherModel; 