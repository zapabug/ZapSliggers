import React from 'react';
import { OrbitControls, Sky } from '@react-three/drei';
import { Vector3 } from 'three';
import LauncherModel from './LauncherModel';
import PlanetModel from './PlanetModel';
import ProjectileModel from './ProjectileModel';

interface ActiveProjectileProp {
  id: string;
  visualId: string;
  position: Vector3;
  playerId: 'P1' | 'P2';
}

interface PlanetProp {
    id: string;
    position: Vector3;
    radius: number;
}

interface Scene3DProps {
  player1AimAngle: number;
  player1Pos: Vector3;
  activeProjectiles: ActiveProjectileProp[];
  planets: PlanetProp[];
  player2AimAngle?: number;
  player2Pos?: Vector3;
}

const Scene3D: React.FC<Scene3DProps> = ({ 
  player1AimAngle, 
  player1Pos, 
  activeProjectiles, 
  planets, 
  player2AimAngle, 
  player2Pos, 
}) => {

  return (
    <>
      {/* Controls for camera manipulation */}
      <OrbitControls />

      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight 
        castShadow 
        position={[5, 10, 7.5]} 
        intensity={1.0} 
        shadow-mapSize-width={1024} 
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[-5, 5, -5]} intensity={0.5} />

      {/* Environment */}
      <Sky sunPosition={[5, 10, 7.5]} />

      {/* Ground Plane */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}> {/* Adjust Y position if needed */}
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#4a5568" /> {/* Simple grey color */}
      </mesh>

      {/* Game Elements */}
      <LauncherModel position={player1Pos.toArray()} isPlayer1={true} aimAngle={player1AimAngle} />
      
      {player2Pos && (
        <LauncherModel 
          position={player2Pos.toArray()} 
          isPlayer1={false} 
          aimAngle={player2AimAngle ?? Math.PI} 
        />
      )}
      
      {planets.map(planet => (
        <PlanetModel key={planet.id} position={planet.position.toArray()} radius={planet.radius} />
      ))}

      {activeProjectiles.map(proj => (
        <ProjectileModel 
          key={proj.visualId}
          position={proj.position.toArray()} 
          isPlayer1={proj.playerId === 'P1'} 
        />
      ))}
    </>
  );
};

export default Scene3D; 