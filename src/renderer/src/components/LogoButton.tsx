import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface LogoButtonProps {
  className?: string;
  [key: string]: any;
}

interface Theme {
  internal: string;
  display: string;
}

export default function LogoButton({ className, rest }: LogoButtonProps) {
  const { setTheme } = useTheme();

  const themes: Theme[] = useMemo(
    () => [
      { internal: "sunny-saffron", display: "Sunny Saffron" },
      { internal: "forest-green", display: "Forest Green" },
      { internal: "ice-white", display: "Ice White" },
      { internal: "ocean-blue", display: "Ocean Blue" },
      { internal: "mountain-gray", display: "Mountain Gray" }
    ],
    []
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none">
        <div className={cn("h-9 w-16 rounded-full bg-logo-grad px-5 py-3", className)} {...rest}></div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div>
          {themes.map((theme) => (
            <DropdownMenuItem key={theme.internal} onClick={() => setTheme(theme.internal)}>
              {theme.display}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
