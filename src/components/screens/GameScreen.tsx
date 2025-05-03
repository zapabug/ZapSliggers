import React from 'react';
import GameRenderer from '../game/GameRenderer';
import ActionButtons from '../ui_overlays/ActionButtons';
import { PlayerHUD } from '../ui_overlays/PlayerHUD';
import { useGameLogic } from '../../hooks/useGameLogic';
import { GameSettingsProfile } from '../../config/gameSettings';
import NDK from '@nostr-dev-kit/ndk';
import { GameEndResult } from '../../types/game';

interface GameScreenProps {
  ndk: NDK;
  localPlayerPubkey: string;
  opponentPubkey: string;
  matchId: string;
  onGameEnd: (result: GameEndResult) => void;
  onBackToMenu: () => void;
  settings: GameSettingsProfile;
  mode: 'practice' | 'multiplayer' | 'custom';
}

const GameScreen: React.FC<GameScreenProps> = ({
  ndk,
  localPlayerPubkey,
  opponentPubkey,
  matchId,
  onGameEnd,
  onBackToMenu,
  settings,
  mode,
}) => {
  const {
    playerStates,
    currentPlayerIndex,
    aimStates,
    selectedAbility,
    handleFire,
    handleSelectAbility,
    myPlayerIndex,
    physicsHandles,
    shotTracerHandlers,
  } = useGameLogic({
    settings,
    mode,
    localPlayerPubkey,
    opponentPubkey,
    onGameEnd,
    ndk,
    matchId,
  });

  const showPlayer0Controls = myPlayerIndex === 0 && currentPlayerIndex === 0;
  const showPlayer1Controls = myPlayerIndex === 1 && currentPlayerIndex === 1;
  const isMyTurn = myPlayerIndex === currentPlayerIndex;

  // Derive player pubkeys based on my index
  const player0Pubkey = myPlayerIndex === 0 ? localPlayerPubkey : opponentPubkey;
  const player1Pubkey = myPlayerIndex === 1 ? localPlayerPubkey : opponentPubkey;

  if (!physicsHandles) {
    return <div className="w-full h-full flex items-center justify-center">Initializing Physics...</div>;
  }

  return (
    <div className="relative w-full h-screen flex flex-col bg-black text-white overflow-hidden">
      <button
        onClick={onBackToMenu}
        className="absolute top-2 left-2 z-20 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-semibold"
      >
        Back to Menu
      </button>

      <div className="absolute top-0 left-0 w-1/3 z-10 p-2">
        <PlayerHUD
          pubkey={player0Pubkey}
          currentHp={playerStates[0].hp}
          maxHp={settings.MAX_HP}
          isPlayer1={true}
          ndk={ndk}
        />
      </div>
      <div className="absolute top-0 right-0 w-1/3 z-10 p-2 flex justify-end">
        <PlayerHUD
          pubkey={player1Pubkey}
          currentHp={playerStates[1].hp}
          maxHp={settings.MAX_HP}
          isPlayer1={false}
          ndk={ndk}
        />
      </div>

      <div className={`absolute bottom-0 left-0 right-0 z-10 flex justify-center p-4 ${isMyTurn ? '' : 'opacity-50 pointer-events-none'}`}>
        {(showPlayer0Controls || showPlayer1Controls) && (
          <ActionButtons
            onFire={handleFire}
            selectedAbility={selectedAbility}
            onAbilitySelect={handleSelectAbility}
            usedAbilities={playerStates[currentPlayerIndex].usedAbilities}
            currentHp={playerStates[currentPlayerIndex].hp}
            abilityCost={settings.ABILITY_COST_HP}
            maxAbilityUsesTotal={settings.MAX_ABILITIES_TOTAL}
            maxAbilityUsesPerType={settings.MAX_ABILITIES_PER_TYPE}
            availableAbilities={settings.AVAILABLE_ABILITIES}
            disabled={!isMyTurn}
          />
        )}
        {!isMyTurn && (
          <div className="text-center text-gray-400 bg-black/50 p-2 rounded">
            Waiting for opponent...
          </div>
        )}
      </div>

      <div className="absolute inset-0 z-0">
        <GameRenderer
          physicsHandles={physicsHandles}
          shotTracerHandlers={shotTracerHandlers}
          settings={settings}
          aimStates={aimStates}
        />
      </div>
    </div>
  );
};

export default GameScreen; 