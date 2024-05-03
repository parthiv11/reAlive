import { useApp } from "@/components/AppContext";
import LogoButton from "@/components/LogoButton";
import { Button } from "@/components/ui/button";
import { GitHubLogoIcon } from '@radix-ui/react-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { card } from "@/lib/card";
import {
  ArrowDownOnSquareIcon,
  ChatBubbleBottomCenterIcon,
  Cog8ToothIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  UserGroupIcon
} from "@heroicons/react/24/solid";
import { useRef } from "react";
import { toast } from "sonner";
import Tooltip from "./ui/tooltip";

interface SideBarProps {
  page: string;
  setPage: (page: string) => void;
}

export default function SideBar({ page, setPage }: SideBarProps) {
  const cardImportInputRef = useRef<HTMLInputElement>(null);
  const { syncCardBundles } = useApp();

  async function cardImportInputChangeHandler(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const res = await card.importFromFileList(files);

    let numValidFiles = 0;
    res.forEach((r) => {
      if (r.kind === "err") {
        toast.error(r.error.message);
        return;
      }
      numValidFiles++;
    });
    if (numValidFiles > 0) {
      toast.success(`${numValidFiles} files imported successfully.`);
    }
    syncCardBundles();
  }

  return (
    <div className="bg-nav-primary mr-3.5 flex h-full w-20 flex-col items-center py-6">
      <input
        ref={cardImportInputRef}
        className="hidden"
        type="file"
        accept=".zip"
        onChange={cardImportInputChangeHandler}
        multiple
      />
      <LogoButton className="mb-4 size-12" />

      {/* Top Button Group*/}
      <div className="flex flex-col">
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <Tooltip tip={'Add Character'} className={"bg-float text-tx-tertiary"}>
              <Button variant="ghost" size="icon" className={"m-2 size-16 rounded-xl"}>
                <PlusCircleIcon className="text-tx-secondary size-8" />
            </Button>
            </Tooltip>
          </DropdownMenuTrigger>
          <DropdownMenuContent sideOffset={-15} className="*:text-tx-primary font-medium p-1.5">
            <DropdownMenuItem
              onSelect={() => {
                setPage("create");
              }}
            >
              <PencilSquareIcon className="size-4 text-tx-secondary mr-2" />
              <span>Create Card</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                cardImportInputRef!.current?.click();
              }}
            >
              <ArrowDownOnSquareIcon className="size-4 text-tx-secondary mr-2" />
              <span> Import Card </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip tip={'Chats'} className={"bg-float text-tx-tertiary"}>
          <Button variant="ghost" className="m-2 size-16 rounded-xl" onClick={() => setPage("chats")}>
          <ChatBubbleBottomCenterIcon className="text-tx-secondary size-8" />
        </Button>
        </Tooltip>
        <Tooltip tip={'Characters'} className={"bg-float text-tx-tertiary"}>
          <Button
            variant="ghost"
            className="m-2 size-16 rounded-xl hover:bg-accent"
            onClick={() => setPage("collections")}
          >
            <UserGroupIcon className="text-tx-secondary size-8" />
          </Button>
        </Tooltip>
        <Tooltip tip={'Setting'} className={"bg-float text-tx-tertiary"}>
          <Button variant="ghost" className="m-2 size-16 rounded-xl hover:bg-accent" onClick={() => setPage("settings")}>
            <Cog8ToothIcon className="text-tx-secondary size-8" />
          </Button>
        </Tooltip>
      </div>

      {/* Spacer */}
      <div className="grow"></div>

      {/* Bottom Button Group*/}
      <div className="flex flex-col space-y-2">
        <Button
          variant="ghost"
          size="icon"
          className="mx-2 size-12 rounded-xl"
          onClick={() => {
            window.api.utils.openURL("https://github.com/parthiv11/reAlive");
            toast.success("Github opened in browser!");
          }}
        >
          <GitHubLogoIcon className="text-tx-tertiary size-7" />
        </Button>

      </div>
    </div>
  );
}
