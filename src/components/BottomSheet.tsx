// Универсальный мобильный Bottom Sheet: снизу вверх, свайп для закрытия.
// Использует vaul (уже подключён через shadcn Drawer). Для десктопа
// компонент тоже подходит — просто становится модалкой у нижнего края.
import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  className,
  contentClassName,
}: BottomSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "max-h-[92dvh] rounded-t-3xl border-t bg-background px-0",
          className,
        )}
      >
        {(title || description) && (
          <DrawerHeader className="text-left px-5 pt-2 pb-3">
            {title && <DrawerTitle className="text-xl font-bold">{title}</DrawerTitle>}
            {description && (
              <DrawerDescription className="text-sm text-muted-foreground">
                {description}
              </DrawerDescription>
            )}
          </DrawerHeader>
        )}
        <div
          className={cn(
            "overflow-y-auto overscroll-contain px-5 pb-5",
            contentClassName,
          )}
        >
          {children}
        </div>
        {footer && (
          <DrawerFooter
            className="px-5 pt-3 pb-4 border-t bg-background/95 backdrop-blur safe-pb"
          >
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
