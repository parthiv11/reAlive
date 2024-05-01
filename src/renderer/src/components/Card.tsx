import { DialogConfig, useApp } from "@/components/AppContext";
import CardModal from "@/components/CardModal";
import EditCardModal from "@/components/EditCardModal";
import Tag from "@/components/Tag";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import { card } from "@/lib/card";
import { queries } from "@/lib/queries";
import { ArrowUpOnSquareIcon, ChatBubbleLeftRightIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/solid";
import { CardBundle } from "@shared/types";
import { motion, useMotionValue } from "framer-motion";
import { toast } from "sonner";
import { CardPattern } from "./ui/card-pattern";

interface CardProps {
  cardBundle: CardBundle;
}

function Card({ cardBundle }: CardProps) {
  console.log(cardBundle)
  const { createModal, createDialog, syncCardBundles, setActiveChatID, closeModal, setPage } = useApp();
  let mouseX = useMotionValue(0);
  let mouseY = useMotionValue(0);

  function onMouseMove({ currentTarget, clientX, clientY }: any) {
    let { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const onDelete = () => {
    const config: DialogConfig = {
      title: `Delete ${cardBundle.data.character.name}`,
      description: `Are you sure you want to delete ${cardBundle.data.character.name}?\n `,
      actionLabel: "Delete",
      onAction: async () => {
        await queries.deleteCard(cardBundle.id);
        syncCardBundles();
      }
    };
    createDialog(config);
  };

  async function createChatWithPersona() {
    const createChatRes = await queries.createChat(cardBundle.id);
    if (createChatRes.kind === "err") {
      toast.error("Error creating new chat.");
      return;
    }
    const chatID = createChatRes.value.lastInsertRowid as number;
    setActiveChatID(chatID);
    setPage("chats");
    closeModal();
  }

  async function exportCardHandler() {
    const res = await card.exportToZip(cardBundle.id);
    if (res.kind === "err") {
      toast.error(`Error exporting card. ${res.error}`);
      return;
    }
    toast.success(`Card exported successfully!`);
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <motion.button
          className="focus:outline-none"
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 }
          }}
          whileTap={{
            scale: 0.98,
            transition: { duration: 0.05, ease: "easeInOut" }
          }}
        >
          <div
            className="group/card justify-top relative flex h-64 w-[34rem] min-w-max cursor-pointer flex-row items-center rounded-xl
              bg-collection-card p-2 shadow-lg hover:shadow-xl transition duration-300"
            onClick={() => {
              createModal(<CardModal cardBundle={cardBundle} onCreateChat={createChatWithPersona} />);
            }}
            onMouseMove={onMouseMove}
          >
            <CardPattern mouseX={mouseX} mouseY={mouseY} />
            <img
              className="z-10 h-60 w-40 rounded-xl object-cover shadow-md"
              src={cardBundle.avatarURI || "default_avatar.png"}
              draggable="false"
            />

            <div className="relative flex flex-grow flex-col space-y-1">
              <div
                className="text-overflow-ellipsis absolute -top-28 z-10 w-full max-w-md overflow-hidden whitespace-nowrap pl-5 text-left text-lg
                  font-semibold text-tx-primary"
              >
                {cardBundle.data.character.name}
              </div>
              <div className="absolute -top-20 z-10 overflow-hidden pl-5 text-left text-sm font-[530] text-tx-secondary">
                {cardBundle.data.character.description}
              </div>
              <div className="absolute -top-2 h-16 space-x-0.5 space-y-1 overflow-hidden pl-5 text-left">
                <div className="flex flex-wrap gap-1">
                  {cardBundle.data.meta.tags.map((tag, idx) => (
                    <Tag key={idx} text={tag} isClickable={false} />
                  ))}
                </div>
              </div>
              <div className="text-tx-tertiary absolute top-20 z-10 pl-5 text-left text-sm font-medium">
                by @{cardBundle.data.meta.creator.card}
              </div>
            </div>
          </div>
        </motion.button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-36 px-1 py-2">
        <ContextMenuItem onSelect={createChatWithPersona}>
          Start Chat
          <ContextMenuShortcut>
            <ChatBubbleLeftRightIcon className="size-4" />
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={exportCardHandler}>
          Export
          <ContextMenuShortcut>
            <ArrowUpOnSquareIcon className="size-4" />
          </ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem
          onSelect={() => {
            createModal(<EditCardModal cardBundle={cardBundle} />);
          }}
        >
          Edit
          <ContextMenuShortcut>
            <PencilIcon className="size-4" />
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onDelete}>
          Delete
          <ContextMenuShortcut>
            <TrashIcon className="size-4" />
          </ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default Card;
