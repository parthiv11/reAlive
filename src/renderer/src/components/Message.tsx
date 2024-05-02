/*
  A message component.  
  A message can be from the user or a character.
  Users can copy, edit, regenerate, and rewind messages. 
  Users can only use "regenerate" on the latest message that is sent by a character.
  Users can only use "rewind" on any message that is not the latest message.
*/

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import {
  ArrowPathIcon,
  BackwardIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  TrashIcon
} from "@heroicons/react/24/solid";

import { DialogConfig, useApp } from "@/components/AppContext";
import Dropdown from "@/components/Dropdown";
import Tag from "@/components/Tag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useShiftKey } from "@/lib/hook/useShiftKey";
import { MessageWithCandidates, MessagesHistory, queries } from "@/lib/queries";
import { reply } from "@/lib/reply";
import { time } from "@/lib/time";
import { MessageCandidate as MessageCandidateI, Message as MessageI } from "@shared/db_types";
import { CardBundle } from "@shared/types";
import { useEffect, useMemo, useRef, useState } from "react";
import Markdown, { Components } from "react-markdown";
import { toast } from "sonner";

type MessageOrCandidate = ({ kind: "message" } & MessageI) | ({ kind: "candidate" } & MessageCandidateI);

interface MessageProps {
  messageWithCandidates: MessageWithCandidates;
  messagesHistory: MessagesHistory;
  cardBundle: CardBundle;
  editingMessageID: number | null;
  setEditingMessageID: (id: number | null) => void;
  setEditText: (text: string) => void;
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
  syncChatHistory: () => void;
}

export default function Message({
  messageWithCandidates,
  messagesHistory,
  cardBundle,
  isGenerating,
  setIsGenerating,
  setEditText,
  editingMessageID,
  setEditingMessageID,
  syncChatHistory
}: MessageProps) {
  const editFieldRef = useRef<HTMLDivElement>(null);
  const isShiftKeyPressed = useShiftKey();
  const { createDialog } = useApp();
  const { id: messageID, chat_id: chatID, sender } = messageWithCandidates;
  const isEditing = editingMessageID === messageWithCandidates.id;
  const { name, avatar } =
    messageWithCandidates.sender === "user"
      ? { name: "Parthiv", avatar: "default_avatar.png" }
      : { name: cardBundle.data.character.name, avatar: cardBundle.avatarURI };
  const isLatest = useMemo(
    () => messagesHistory.length > 0 && messagesHistory[messagesHistory.length - 1].id === messageID,
    [messagesHistory]
  );
  const messageAndCandidateArr = useMemo<MessageOrCandidate[]>(() => {
    const ret: MessageOrCandidate[] = [{ kind: "message", ...messageWithCandidates }];
    messageWithCandidates.candidates.forEach((candidate) => {
      ret.push({ kind: "candidate", ...candidate });
    });
    return ret;
  }, [messageWithCandidates]);

  // Always show the prime candidate if it exists, or the message if it doesn't
  const getIDX = () => {
    if (messageWithCandidates.prime_candidate_id) {
      return messageWithCandidates.candidates.findIndex((c) => c.id === messageWithCandidates.prime_candidate_id) + 1;
    }
    return 0;
  };
  const [idx, setIDX] = useState(getIDX);
  useEffect(() => {
    setIDX(getIDX());
  }, [messageWithCandidates]);

  // When the user switches between messages, update the "prime candidate" column in the database accordingly
  useEffect(() => {
    const messageOrCandidate = messageAndCandidateArr[idx];
    if (messageOrCandidate.kind === "message") {
      queries.updateMessagePrimeCandidate(messageID, null);
      return;
    } else {
      queries.updateMessagePrimeCandidate(messageID, messageOrCandidate.id);
    }
  }, [idx]);

  const copyHandler = () => {
    navigator.clipboard.writeText(messageWithCandidates.text);
    toast.success("Message copied to clipboard!");
  };

  const copyTextHandler = () => {
    const selectedText = window.getSelection()?.toString();
    if (selectedText) {
      navigator.clipboard.writeText(selectedText);
      toast.success("Selection copied to clipboard!");
    }
  };

  // Focus on the edit field when the user starts editing
  useEffect(() => {
    if (!isEditing) return;
    focusEditField();
  }, [isEditing]);

  const focusEditField = () => {
    setTimeout(() => {
      if (editFieldRef.current !== null) {
        // Focus on the edit field
        const editField = editFieldRef.current;
        editField.focus();
        // Place the caret at the end of the text
        const range = document.createRange();
        range.selectNodeContents(editFieldRef.current);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }, 0);
  };

  const handleChangeMessage = (idx: number) => {
    // If the message  change to is out of bounds, regenerate the message
    if (idx === messageAndCandidateArr.length) {
      regenerateHandler();
      return;
    }
    // If user is currently in message edit mode, change the edit field to the new message
    if (isEditing) {
      setEditText(messageAndCandidateArr[idx].text);
      focusEditField();
    }
    const clampedValue = Math.min(Math.max(idx, 0), messageAndCandidateArr.length - 1);
    setIDX(clampedValue);
  };

  const editSubmitHandler = async () => {
    setEditingMessageID(null);
    try {
      const text = messageAndCandidateArr[idx].text;
      const id = messageAndCandidateArr[idx].id;
      if (messageAndCandidateArr[idx].kind === "message") {
        await queries.updateMessageText(id, text);
      } else {
        await queries.updateCandidateMessage(id, text);
      }
    } catch (e) {
      toast.error(`Failed to edit the message. Error: ${e}`);
      console.error(e);
    } finally {
      syncChatHistory();
    }
  };

  const editHandler = async () => {
    setEditingMessageID(messageID);
    const text = messageAndCandidateArr[idx].text;
    setEditText(text);
  };

  const rewindHandler = () => {
    const rewind = async () => {
      try {
        await queries.resetChatToMessage(chatID, messageID);
      } catch (e) {
        toast.error(`Failed to rewind chat. Error: ${e}`);
        console.error(e);
      } finally {
        syncChatHistory();
      }
    };

    if (isShiftKeyPressed) {
      rewind();
    } else {
      const config: DialogConfig = {
        title: "Rewind Chat",
        actionLabel: "Rewind",
        description:
          "Are you sure you want to rewind the chat to this message? Rewinding will delete all messages that were sent after this message.",
        onAction: rewind
      };
      createDialog(config);
    }
  };
  const deleteHandler = () => {
    const deleteMessage = async () => {
      try {
        await queries.deleteMessage(messageID);
      } catch (e) {
        toast.error(`Failed to delete message. Error: ${e}`);
        console.error(e);
      } finally {
        syncChatHistory();
      }
    };

    if (isShiftKeyPressed) {
      deleteMessage();
    } else {
      const config: DialogConfig = {
        title: "Delete Message",
        actionLabel: "Delete",
        description: "Are you sure you want to delete this message?",
        onAction: deleteMessage
      };
      createDialog(config);
    }
  };
  const regenerateHandler = async () => {
    if (isGenerating) {
      toast.info("Already generating a reply. Please wait...");
      return;
    }
    setIsGenerating(true);
    try {
      const replyRes = await reply.regenerate(chatID, messageID, cardBundle.data);
      if (replyRes.kind === "err") throw replyRes.error;
      const candidateID = await queries.insertCandidateMessage(messageID, replyRes.value);
      await queries.setCandidateMessageAsPrime(messageID, candidateID);
    } catch (e) {
      toast.error(`Failed to regenerate a reply. Error: ${e}`);
      console.error(e);
    } finally {
      setIsGenerating(false);
      syncChatHistory();
    }
  };

  const isCharacter = messageWithCandidates.sender === "character";
  const isFirst = messagesHistory.length > 0 && messagesHistory[0].id === messageWithCandidates.id;
  const showRegenerate = isLatest && isCharacter && !isFirst;
  const showRewind = !isLatest;
  const menuProps = {
    showRegenerate,
    showRewind,
    onCopy: copyHandler,
    onCopyText: copyTextHandler,
    onEdit: editHandler,
    onRegenerate: regenerateHandler,
    onRewind: rewindHandler,
    onDelete: deleteHandler
  };

  const roleAlignStyles = sender === "user" ? "self-end" : "self-start";
  const roleColorStyles = sender === "user" ? "bg-chat-user-grad" : "bg-chat-character-grad";
  const editingStyles = isEditing ? "outline-2 outline-dashed outline-tx-secondary" : "";
  const baseStyles =
    "h-fit flex items-start space-x-4 pl-3 pr-8 py-2.5 font-[480] hover:brightness-95 text-tx-primary rounded-3xl group/msg";
  return (
    <div className={cn("max-w-3/4 shrink-0", roleAlignStyles)}>
      <ContextMenu>
        {/* Right Click Menu*/}
        <div className="flex flex-col">
          <ContextMenuTrigger>
            {/* Message Component */}
            <div className={cn(baseStyles, editingStyles, roleColorStyles)}>
              <Popover>
                <PopoverTrigger className="m-1.5 shrink-0">
                  <img
                    className="size-12 select-none rounded-full object-cover object-top"
                    draggable="false"
                    src={avatar || "default_avatar.png"}
                    alt="Avatar"
                  />
                </PopoverTrigger>
                <MessagePopoverContent sender={sender} cardBundle={cardBundle} />
              </Popover>
              <div className="flex flex-col justify-start space-y-0.5">
                {/* Name */}
                <div className="flex h-fit flex-row items-center justify-between space-x-3">
                  <div className=" text-base font-semibold text-tx-primary">{name}</div>
                  <MessageDropdownMenu {...menuProps} />
                </div>
                {isEditing ? (
                  // Show edit field if editing
                  <div
                    ref={editFieldRef}
                    className="scroll-secondary h-auto w-full overflow-y-scroll text-wrap break-all bg-transparent text-left focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        editSubmitHandler();
                        e.preventDefault();
                      }
                    }}
                    onInput={(e) => setEditText(e.currentTarget.textContent!)}
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                  >
                    {messageWithCandidates.text}
                  </div>
                ) : (
                  <Markdown
                    allowedElements={["p", "blockquote", "strong", "em"]}
                    unwrapDisallowed
                    skipHtml
                    className="whitespace-pre-wrap"
                    components={sender === "user" ? userMarkdown : characterMarkdown}
                  >
                    {messageWithCandidates.text}
                  </Markdown>
                )}
              </div>
            </div>
            <MessageContextMenuContent {...menuProps} />
          </ContextMenuTrigger>

          {showRegenerate &&
            /* Show the selector arrows if there are multiple candidates */
            (messageWithCandidates.candidates.length > 0 ? (
              <div className="flex flex-row items-center space-x-2 p-2">
                {/* Left Arrow */}
                <button
                  className="size-5"
                  onClick={() => {
                    handleChangeMessage(idx - 1);
                  }}
                >
                  <ChevronLeftIcon className="size-5 text-tx-tertiary" />
                </button>
                <p className="font-mono text-sm font-semibold text-tx-tertiary">{`${idx + 1}/${messageAndCandidateArr.length}`}</p>
                {/* Right Arrow */}
                <button
                  className="size-5"
                  onClick={() => {
                    handleChangeMessage(idx + 1);
                  }}
                >
                  <ChevronRightIcon className="size-5 text-tx-tertiary" />
                </button>
              </div>
            ) : (
              <div className="px-2 py-1">
                {/* Regenrate */}
                <button className="size-6">
                  <ArrowPathIcon className="size-6 text-tx-tertiary" onClick={regenerateHandler} />
                </button>
              </div>
            ))}
        </div>
      </ContextMenu>
    </div>
  );
}

interface MessagePopoverContentProps {
  sender: "user" | "character";
  cardBundle: CardBundle;
}

function MessagePopoverContent({ sender, cardBundle }: MessagePopoverContentProps) {
  if (sender === "user") {
    const bannerURI = "default_banner.png";
    const avatarURI = "default_avatar.png";

    // USER popover
    return (
      <PopoverContent className="scroll-secondary bg-float max-h-[30rem] w-96 overflow-y-scroll p-0 pb-10">
        <MessagePopoverBanner bannerURI={bannerURI} avatarURI={avatarURI} />
        <div className="px-6 pt-12">
          <div className="flex flex-row">
            <div className="pr-10">
              <div className="pb-1.5 text-xl font-semibold">{"personaBundle.data.name"}</div>
            </div>
          </div>
          {/* User details dropdowns */}
          <div className="-mx-2 mt-3 flex flex-col rounded-lg bg-container-primary p-3 space-y-4">
            <h3 className="mb-1 font-semibold text-tx-primary">About</h3>
            <p className="text-sm text-tx-secondary">{"personaBundle.data.description"} </p>
          </div>
        </div>
      </PopoverContent>
    );
  } else {
    const bannerURI = cardBundle.bannerURI;
    const avatarURI = cardBundle.avatarURI;

    // CHARACTER popover
    return (
      <PopoverContent className="scroll-secondary h-[30rem] w-96 overflow-y-scroll bg-float p-0">
        <MessagePopoverBanner bannerURI={bannerURI} avatarURI={avatarURI} />
        <div className="pl-4 pr-2 pt-12">
          <div className="flex flex-row">
            <div className="pr-10">
              <div className="pb-1.5 text-xl font-semibold text-tx-primary">{cardBundle.data.character.name}</div>
              <div className="whitespace-nowrap text-xs text-tx-tertiary font-[550]">
                <p className="">{`created: ${time.isoToFriendly(cardBundle.data.meta.created_at)}`}</p>
                {cardBundle.data.meta.updated_at && <p className="">{`updated: ${cardBundle.data.meta.updated_at}`}</p>}
              </div>
            </div>
            {/* Tags */}
            <div className="flex flex-col gap-y-2">
              <div className="text-sm font-semibold text-tx-primary">Tags:</div>
              <div className="flex flex-wrap gap-x-1.5 gap-y-2">
                {cardBundle.data.meta.tags.map((tag, idx) => (
                  <Tag key={idx} text={tag} />
                ))}
              </div>
            </div>
          </div>
          {/* Character details dropdowns */}
          <div className="mt-6">
            <Dropdown label="Character Description" content={cardBundle.data.character.description} />
          </div>
        </div>
      </PopoverContent>
    );
  }
}

function MessagePopoverBanner({ bannerURI, avatarURI }: { bannerURI: string; avatarURI: string }) {
  return (
    <div className="relative w-full rounded-lg">
      <img src={bannerURI || "default_banner.png"} alt="Banner" className="h-36 w-full object-cover" />
      <img
        src={avatarURI || "default_avatar.png"}
        alt="Profile"
        className="absolute -bottom-12 left-4 size-20 rounded-full border-4 object-cover object-top border-float"
      />
    </div>
  );
}

interface MenuProps {
  showRegenerate: boolean;
  showRewind: boolean;
  onCopy: () => void;
  onCopyText: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onRewind: () => void;
  onDelete: () => void;
}

function MessageDropdownMenu({
  showRegenerate,
  showRewind,
  onCopy,
  onCopyText,
  onEdit,
  onRegenerate,
  onRewind,
  onDelete
}: MenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <EllipsisHorizontalIcon className="size-6 cursor-pointer opacity-0 transition duration-75 ease-out group-hover/msg:opacity-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onCopy}>
            Copy
            <DropdownMenuShortcut className="">
              <ClipboardDocumentIcon className="size-4" />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onEdit}>
            Edit
            <DropdownMenuShortcut>
              <PencilIcon className="size-4" />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          {showRegenerate && (
            <DropdownMenuItem onSelect={onRegenerate}>
              Regenerate
              <DropdownMenuShortcut>
                <ArrowPathIcon className="size-4" />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          )}

          {showRewind && (
            <DropdownMenuItem onSelect={onRewind}>
              Rewind
              <DropdownMenuShortcut>
                <BackwardIcon className="size-4" />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onSelect={onCopyText}>
            Copy Selected
            <DropdownMenuShortcut>
              <ClipboardDocumentIcon className="size-4" />
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={onDelete}>
            Delete
            <DropdownMenuShortcut>
              <TrashIcon className="size-4" />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MessageContextMenuContent({
  showRegenerate,
  showRewind,
  onCopy,
  onCopyText,
  onEdit,
  onRegenerate,
  onRewind,
  onDelete
}: MenuProps) {
  return (
    <ContextMenuContent className="w-40">
      <ContextMenuItem onSelect={onCopy} className="">
        Copy
        <ContextMenuShortcut>
          <ClipboardDocumentIcon className="size-4" />
        </ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={onEdit}>
        Edit
        <ContextMenuShortcut>
          <PencilIcon className="size-4" />
        </ContextMenuShortcut>
      </ContextMenuItem>

      {showRegenerate && (
        <ContextMenuItem onSelect={onRegenerate}>
          Regenerate
          <ContextMenuShortcut>
            <ArrowPathIcon className="size-4" />
          </ContextMenuShortcut>
        </ContextMenuItem>
      )}

      {showRewind && (
        <ContextMenuItem onSelect={onRewind}>
          Rewind
          <ContextMenuShortcut>
            <BackwardIcon className="size-4" />
          </ContextMenuShortcut>
        </ContextMenuItem>
      )}
      <ContextMenuItem onSelect={onCopyText}>
        Copy Selected
        <ContextMenuShortcut>
          <ClipboardDocumentIcon className="size-4" />
        </ContextMenuShortcut>
      </ContextMenuItem>

      <ContextMenuItem onSelect={onDelete}>
        Delete
        <ContextMenuShortcut>
          <TrashIcon className="size-4" />
        </ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

const userMarkdown: Partial<Components> = {
  em: ({ children }) => <span className="font-[550] italic text-tx-primary">{children}</span>,
  strong: ({ children }) => <span className="pr-1 font-bold text-tx-primary">{children}</span>,
  blockquote: ({ children }) => {
    return (
      <div className="flex items-stretch font-medium italic text-tx-secondary">
        <div className="mr-3 min-h-8 w-[5px] shrink-0 rounded-sm bg-chat-user-blockquote-bar" />
        {children}
      </div>
    );
  }
};

const characterMarkdown: Partial<Components> = {
  em: ({ children }) => <span className="pr-1 font-[550] italic text-tx-secondary">{children}</span>,
  strong: ({ children }) => <span className="pr-1 font-bold text-tx-primary">{children}</span>,
  blockquote: ({ children }) => {
    return (
      <div className="flex items-stretch font-medium italic text-tx-secondary">
        <div className="mr-3 min-h-8 w-[5px] shrink-0 rounded-sm bg-chat-character-blockquote-bar" />
        {children}
      </div>
    );
  }
};
