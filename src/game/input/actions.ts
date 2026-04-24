export type InputAction =
  | "move-up"
  | "move-down"
  | "move-left"
  | "move-right"
  | "shoot"
  | "slot-1"
  | "slot-2"
  | "slot-3"
  | "slot-4"
  | "slot-5"
  | "pause";

export interface InputFrame {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  shooting: boolean;
  selectedSlot: number;
  useItem: boolean;
}

export const createEmptyInputFrame = (): InputFrame => ({
  moveX: 0,
  moveY: 0,
  aimX: 960,
  aimY: 540,
  shooting: false,
  selectedSlot: 1,
  useItem: false
});
