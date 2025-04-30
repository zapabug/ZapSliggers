import React from 'react';
import { Torus } from '@react-three/drei'; // Import Torus helper

interface PlanetModelProps {
  position: [number, number, number];
  radius: number;
}

const PlanetModel: React.FC<PlanetModelProps> = ({ position, radius }) => {
  return (
    <group position={position}>
      {/* Planet Sphere */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial color="#a0aec0" /> {/* Light grey color */}
      </mesh>

      {/* Simple Ring */}
      {/* Rotate the torus so it lies flat like Saturn's rings */}
      <Torus args={[radius * 1.5, radius * 0.1, 16, 100]} rotation={[-Math.PI / 2, 0, 0]}> 
        {/* args: radius, tubeRadius, radialSegments, tubularSegments */}
        <meshStandardMaterial color="#e2e8f0" /> {/* Slightly lighter grey for ring */}
      </Torus>
    </group>
  );
};

export default PlanetModel; 