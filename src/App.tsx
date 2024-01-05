import React, {useEffect, useRef, useState} from "react";

const key = "bounce"

interface State {
  screenTop: number;
  screenLeft: number;
  height: number;
  width: number;
  color: string;
  timestamp: number;
}

const randomColor = (() => {
  "use strict";

  const randomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  return () => {
    var h = randomInt(0, 360);
    var s = randomInt(42, 98);
    var l = randomInt(40, 90);
    return `hsl(${h},${s}%,${l}%)`;
  };
})();

class WindowStateSharer {
  key: string;
  state: Record<string, State>;
  onChange: (state: Record<string, State>) => void;
  windowId: string;
  windowMoveInterval: NodeJS.Timeout;
  color: string = randomColor();

  constructor(
    key: string,
    onStateChange: (state: Record<string, State>) => void,
    refreshInterval = 100,
  ) {
    this.key = key;
    this.onChange = s => onStateChange({...s});
    this.windowId = Math.random().toString(36).slice(5);
    const currentState = this.readState();
    currentState[this.windowId] = this.getCurrentState();
    this.state = currentState;
    this.writeState();

    window.addEventListener("resize", this.handleResize.bind(this));
    window.addEventListener("storage", this.handleStorage.bind(this));
    window.addEventListener("beforeunload", this.handleUnload.bind(this));

    this.windowMoveInterval = setInterval(this.checkForPositionChanges.bind(this), refreshInterval)
  }

  handleStorage(event: StorageEvent) {
    if (event.key !== this.key || !event.newValue) return
    const newState = JSON.parse(event.newValue)
    this.state = newState;
    this.onChange(newState);
  }

  handleUnload() {
    const newState = {...this.state}
    delete newState[this.windowId];
    this.state = newState;
    this.writeState();
  }

  handleResize() {
    this.state[this.windowId] = this.getCurrentState();
    this.writeState();
  }

  getCurrentState(): State {
    const windowState = {
      screenTop: window.screenTop,
      screenLeft: window.screenLeft,
      height: window.innerHeight,
      width: window.innerWidth,
      timestamp: Date.now(),
      color: this.color,
    }

    return windowState;
  }

  readState(): Record<string, State> {
    return JSON.parse(localStorage.getItem(key) || "{}");
  }

  writeState() {
    localStorage.setItem(this.key, JSON.stringify(this.state));
    this.onChange(this.state);
  }

  clearState() {
    localStorage.removeItem(this.key);
    this.state = {
      [this.windowId]: this.getCurrentState(),
    };
    this.writeState();
  }

  checkForPositionChanges() {
    const current = this.getCurrentState();
    const previous = this.state[this.windowId];
    if (!previous) {
      this.state[this.windowId] = current;
      this.writeState();
      return;
    }

    // if (current.screenTop !== previous.screenTop ||
    //   current.screenLeft !== previous.screenLeft) {
    //   if (current.screenTop !== previous.screenTop ||
    //     current.screenLeft !== previous.screenLeft) {
    //   }
    // }
    this.state[this.windowId] = current;
    this.writeState();

    this.cleanupOldStates();
  }

  cleanupOldStates() {
    const now = Date.now();
    const newState = {...this.state};
    Object.entries(this.state).forEach(([id, item]) => {
      if (now - item.timestamp > 1000 && id !== this.windowId) {
        delete newState[id];
      }
    });
    this.state = newState;
    this.writeState();
  }


  [Symbol.dispose]() {
    window.removeEventListener("resize", this.handleResize.bind(this));
    window.removeEventListener("storage", this.handleStorage.bind(this));
    clearInterval(this.windowMoveInterval);
    this.onChange = () => {};
  }
}

const BALL_SIZE = 50;
const BALL_VELOCITY = 8;
const BALL_COLOR = randomColor();

export default function Bounce() {
  const [ballPosition, setBallPosition] = useState({x:100, y:100, Vx: BALL_VELOCITY / 2, Vy: BALL_VELOCITY});
  const [state, setState] = useState<Record<string, State>>({})
  const [windowId, setWindowId] = useState("")
  const sharer = useRef<WindowStateSharer>();

  useEffect(() => {
    sharer.current = new WindowStateSharer(
      key,
      (s) => setState(s),
    );
    setWindowId(sharer.current.windowId);
    return () => sharer.current?.[Symbol.dispose]?.();
  }, [setState]);

  function simulateBall() {
    const nextX = ballPosition.x + ballPosition.Vx;
    const nextY = ballPosition.y + ballPosition.Vy;

    let nextXV = ballPosition.Vx;
    let nextYV = ballPosition.Vy;

    // check for collision with all windows in state except this one
    // bounce off of them if there is a collision

    Object.entries(state).forEach(([id, windowState]) => {
      if (id === windowId) return;
      const distanceFromTop = (windowState.screenTop - window.screenTop);
      const distanceFromLeft = (windowState.screenLeft - window.screenLeft);
      const top = distanceFromTop + windowState.height;
      const left = distanceFromLeft + windowState.width;

      if (nextX + BALL_SIZE >= distanceFromLeft && nextX <= left) {
        if (nextY + BALL_SIZE >= distanceFromTop && nextY <= top) {
          const ballCenter = {x: nextX + (BALL_SIZE / 2), y: nextY + (BALL_SIZE / 2)};
          const windowCenter = {x: distanceFromLeft + (windowState.width / 2), y: distanceFromTop + (windowState.height / 2)};
          const angle = Math.atan2(ballCenter.y - windowCenter.y, ballCenter.x - windowCenter.x);
          const velocity = Math.sqrt((ballPosition.Vx * ballPosition.Vx) + (ballPosition.Vy * ballPosition.Vy));
          nextXV = Math.cos(angle) * velocity;
          nextYV = Math.sin(angle) * velocity;
        }
      }
    })

    if (nextY + BALL_SIZE >= window.innerHeight || nextY <= 0) {
      nextYV = -nextYV;
    }

    if (nextX + BALL_SIZE >= window.innerWidth || nextX <= 0) {
      nextXV = -nextXV;
    }

    setBallPosition({
      x: nextX,
      y: nextY,
      Vx: nextXV,
      Vy: nextYV,
    })
  }

  useEffect(() => {
    requestAnimationFrame(simulateBall)
  })

  const thisWindow = state[windowId];
  if (!thisWindow) return null;

  return (
    <div style={{backgroundColor: thisWindow.color, height: "100vh"}}>
      {Object.entries(state).map(([id, item]) => {
        if (id === windowId) return null;
        const distanceFromTop = (item.screenTop - thisWindow.screenTop);
        const distanceFromLeft = (item.screenLeft - thisWindow.screenLeft);

        return (
          <div key={id} style={{
            position: "fixed",
            top: distanceFromTop,
            left: distanceFromLeft,
            backgroundColor: item.color,
            height: item.height,
            width: item.width,
          }}>
          </div>
        )
      })}

      <div style={{
          position: "fixed",
          top: ballPosition.y,
          left: ballPosition.x,
          width: BALL_SIZE,
          height: BALL_SIZE,
          borderRadius: BALL_SIZE,
          backgroundColor: BALL_COLOR,
        }}
      />

      <button style={{zIndex: 99}} onClick={() => {
        sharer.current?.clearState()

        setBallPosition({
          x: window.innerWidth / 2 - (BALL_SIZE / 2),
          y: window.innerHeight / 2 - (BALL_SIZE / 2),
          Vx: BALL_VELOCITY / 2,
          Vy: BALL_VELOCITY,
        })
      }}>Reset</button>
    </div>
  )
}