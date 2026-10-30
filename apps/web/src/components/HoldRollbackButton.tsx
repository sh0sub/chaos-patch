import { useEffect, useRef, useState } from "react";
import { createHoldConfirmation } from "../holdConfirmation";

type Props = { disabled: boolean; onConfirm: () => void };

export function HoldRollbackButton({ disabled, onConfirm }: Props) {
  const [holding, setHolding] = useState(false);
  const confirmRef = useRef(onConfirm);
  const holdRef = useRef<ReturnType<typeof createHoldConfirmation> | null>(null);
  confirmRef.current = onConfirm;
  if (!holdRef.current) {
    holdRef.current = createHoldConfirmation(() => {
      setHolding(false);
      confirmRef.current();
    });
  }

  const begin = () => {
    if (disabled) return;
    setHolding(true);
    holdRef.current?.begin();
  };
  const cancel = () => {
    setHolding(false);
    holdRef.current?.cancel();
  };

  useEffect(() => () => holdRef.current?.cancel(), []);

  return (
    <button
      className={`rollback-button${holding ? " holding" : ""}`}
      type="button"
      disabled={disabled}
      aria-label="Hold for one second to rollback active patch"
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onKeyDown={(event) => {
        if (!event.repeat && (event.key === " " || event.key === "Enter")) {
          event.preventDefault();
          begin();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") cancel();
      }}
      onBlur={cancel}
    ><span>{holding ? "Keep holding…" : "Hold 1s to rollback"}</span></button>
  );
}
