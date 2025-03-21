"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";

import { config } from "~/components/providers/WagmiProvider";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, optimism } from "wagmi/chains";
import { useSession } from "next-auth/react";
import { createStore } from "mipd";
import { Label } from "~/components/ui/label";
import { PROJECT_TITLE } from "~/lib/constants";

function SnakeGame() {
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [direction, setDirection] = useState<'RIGHT' | 'LEFT' | 'UP' | 'DOWN'>('RIGHT');
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [score, setScore] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);

  const generateFood = () => ({
    x: Math.floor(Math.random() * 20),
    y: Math.floor(Math.random() * 20)
  });

  const checkCollision = (head: { x: number, y: number }) => {
    return head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20 ||
      snake.some((segment, index) => index !== 0 && segment.x === head.x && segment.y === head.y);
  };

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

      if (checkCollision(head)) {
        setGameOver(true);
        return;
      }

      newSnake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        setFood(generateFood());
        setSpeed(prev => Math.max(50, prev * 0.9));
        setScore(prev => prev + 100);
      } else {
        newSnake.pop();
      }

      setSnake(newSnake);
    };

    const gameInterval = setInterval(moveSnake, speed);
    return () => clearInterval(gameInterval);
  }, [snake, direction, food, gameOver, speed, checkCollision]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Degen Snake 🐍🎩</CardTitle>
        <CardDescription>
          Score: {score} | Speed: {Math.round((200 / speed) * 100)}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div 
          className="relative bg-gray-900 rounded-lg touch-none"
          style={{ width: '400px', height: '400px', touchAction: 'none' }}
        >
          <div 
            className="absolute grid grid-cols-20 grid-rows-20 gap-0" 
            style={{ width: '100%', height: '100%' }}
          >
            {snake.map((segment, index) => (
              <div
                key={index}
                className="bg-green-500 rounded-sm"
                style={{
                  gridColumn: segment.x + 1,
                  gridRow: segment.y + 1,
                  transition: 'all 0.1s linear'
                }}
              />
            ))}
            <div
              className="text-2xl flex items-center justify-center"
              style={{
                gridColumn: food.x + 1,
                gridRow: food.y + 1,
              }}
            >
              🎩
            </div>
          </div>
          {gameOver && (
            <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center text-2xl">
              Game Over! Refresh to play again
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();

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
      <div className="w-[300px] mx-auto py-2 px-2">
        <SnakeGame />
      </div>
    </div>
  );
}
