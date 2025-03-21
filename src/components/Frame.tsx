"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";

import { config } from "~/components/providers/WagmiProvider";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, optimism } from "wagmi/chains";
import { useSession } from "next-auth/react";
import { createStore } from "mipd";
import { Label } from "~/components/ui/label";
import { PROJECT_TITLE } from "~/lib/constants";

interface SnakeGameProps {
  score: number;
  setScore: (value: number | ((prev: number) => number)) => void;
}

function SnakeGame({ score, setScore }: SnakeGameProps) {
  const [snake, setSnake] = useState([{ x: 5, y: 5 }]);
  const [food, setFood] = useState({ x: 2, y: 2 });
  const [direction, setDirection] = useState<'RIGHT' | 'LEFT' | 'UP' | 'DOWN'>('RIGHT');
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);

  const resetGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood({ x: 5, y: 5 });
    setDirection('RIGHT');
    setGameOver(false);
    setSpeed(200);
    setScore(0);
  };

  const generateFood = () => {
    let newFood: {x: number, y: number};
    // Generate new food until we find a position not occupied by the snake
    do {
      newFood = {
        x: Math.floor(Math.random() * 10),
        y: Math.floor(Math.random() * 10)
      };
    } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    
    return newFood;
  };

  const checkCollision = useCallback((head: { x: number, y: number }) => {
    return snake.some((segment, index) => index !== 0 && segment.x === head.x && segment.y === head.y);
  }, [snake]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': if (direction !== 'DOWN') setDirection('UP'); break;
        case 'ArrowDown': if (direction !== 'UP') setDirection('DOWN'); break;
        case 'ArrowLeft': if (direction !== 'RIGHT') setDirection('LEFT'); break;
        case 'ArrowRight': if (direction !== 'LEFT') setDirection('RIGHT'); break;
      }
    };

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0 && direction !== 'LEFT') setDirection('RIGHT');
        else if (deltaX < 0 && direction !== 'RIGHT') setDirection('LEFT');
      } else {
        if (deltaY > 0 && direction !== 'UP') setDirection('DOWN');
        else if (deltaY < 0 && direction !== 'DOWN') setDirection('UP');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('touchstart', (e) => setTouchStartX(e.touches[0].clientX));
    window.addEventListener('touchstart', (e) => setTouchStartY(e.touches[0].clientY));
    window.addEventListener('touchmove', handleTouch, { passive: false });
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('touchstart', (e) => setTouchStartX(e.touches[0].clientX));
      window.removeEventListener('touchstart', (e) => setTouchStartY(e.touches[0].clientY));
      window.removeEventListener('touchmove', handleTouch);
    };
  }, [direction, touchStartX, touchStartY]);

  useEffect(() => {
    if (gameOver) return;

    const moveSnake = () => {
      const newSnake = [...snake];
      const head = { ...newSnake[0] };

      switch (direction) {
        case 'RIGHT': head.x += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
      }

      // Wrap snake around 10x10 grid edges
      head.x = ((head.x % 10) + 10) % 10;
      head.y = ((head.y % 10) + 10) % 10;

      // Only check for self-collision
      if (checkCollision(head)) {
        setGameOver(true);
        return;
      }

      newSnake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        setSpeed(prev => Math.max(50, prev * 0.95));
        setScore((prev: number) => prev + 100);
        setFood(generateFood()); // Generate new food after eating
      } else {
        newSnake.pop();
      }

      setSnake(newSnake);
    };

    const gameInterval = setInterval(moveSnake, speed);
    return () => clearInterval(gameInterval);
  }, [snake, direction, food, gameOver, speed, checkCollision, setScore, generateFood]);


  return (
    <div 
      className="fixed top-0 left-0 w-full h-full bg-gray-900 overflow-hidden"
      style={{
        display: 'grid',
        placeItems: 'center',
        touchAction: 'none'
      }}
    >
      <div 
        className="relative bg-gray-900"
        style={{ 
          width: '95vmin',
          height: '95vmin',
          touchAction: 'none',
          maxWidth: '100%',
          maxHeight: '100%'
        }}
      >
          <div
            className="absolute grid grid-cols-10 grid-rows-10 gap-0"
            style={{ 
              width: '100%',
              height: '100%',
              fontSize: 'clamp(1rem, 3vw, 2rem)',
              background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.1) 0 1px, transparent 1px 100%), repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0 1px, transparent 1px 100%)',
              backgroundSize: '10% 10%'
            }}
          >
            {/* Main snake head */}
            <div
              className="flex items-center justify-center"
              style={{
                gridColumn: snake[0].x + 1,
                gridRow: snake[0].y + 1,
                fontSize: '1.5rem',
                zIndex: 20
              }}
            >
              🐍
            </div>
            
            {/* Snake body trail effect */}
            {snake.slice(1).map((segment, index) => (
              <div
                key={index+1}
                className="flex items-center justify-center opacity-50"
                style={{
                  gridColumn: segment.x + 1,
                  gridRow: segment.y + 1,
                  fontSize: '1rem',
                  zIndex: 19 - index
                }}
              >
                🎩
              </div>
            ))}
            <div
              className="flex items-center justify-center text-2xl animate-pulse"
              style={{
                gridColumn: food.x + 1,
                gridRow: food.y + 1
              }}
            >
              🎩
            </div>
          </div>
          {gameOver && (
            <div className="absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center gap-4 text-2xl">
              <div>Game Over!</div>
              <button 
                onClick={resetGame}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold transition-colors"
              >
                Play Again
              </button>
            </div>
          )}
        </div>
      </div>
  );
}

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [score, setScore] = useState(0);

  const [added, setAdded] = useState(false);

  const [addFrameResult, setAddFrameResult] = useState("");

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      if (!context) {
        return;
      }

      setContext(context);
      setAdded(context.client.added);

      // If frame isn't already added, prompt user to add it
      if (!context.client.added) {
        addFrame();
      }

      sdk.on("frameAdded", ({ notificationDetails }) => {
        setAdded(true);
      });

      sdk.on("frameAddRejected", ({ reason }) => {
        console.log("frameAddRejected", reason);
      });

      sdk.on("frameRemoved", () => {
        console.log("frameRemoved");
        setAdded(false);
      });

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        console.log("notificationsEnabled", notificationDetails);
      });
      sdk.on("notificationsDisabled", () => {
        console.log("notificationsDisabled");
      });

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked");
      });

      console.log("Calling ready");
      sdk.actions.ready({});

      // Set up a MIPD Store, and request Providers.
      const store = createStore();

      // Subscribe to the MIPD Store.
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
        // => [EIP6963ProviderDetail, EIP6963ProviderDetail, ...]
      });
    };
    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-full max-w-[400px] mx-auto pt-4 px-4 md:px-2">
        <div className="text-white absolute top-4 left-4 z-50">
          <div>Score: {score}</div>
        </div>
        <SnakeGame score={score} setScore={setScore} />
      </div>
    </div>
  );
}
