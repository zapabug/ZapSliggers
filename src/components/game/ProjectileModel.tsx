import React from 'react';
import { JSX } from 'react/jsx-runtime';

// Define props using type intersection
// Combine custom props with standard mesh props, omitting our specific 'position' to avoid conflict
type ProjectileModelProps = {
  position: [number, number, number];
  isPlayer1: boolean;
} & Omit<JSX.IntrinsicElements['mesh'], 'position'>;

const ProjectileModel: React.FC<ProjectileModelProps> = ({ position, isPlayer1, ...props }) => {
  const color = isPlayer1 ? '#007bff' : '#dc3545'; // Blue for P1, Red for P2

  return (
    // Pass the explicit position and the rest of the props directly
    <mesh position={position} {...props} castShadow>
      <sphereGeometry args={[0.2, 16, 16]} /> {/* Small sphere */}
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  );
};

export default ProjectileModel; 