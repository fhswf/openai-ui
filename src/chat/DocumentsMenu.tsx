import React, { useState } from "react";
import { Menu, Portal } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuChevronRight } from "react-icons/lu";
import { useGlobal } from "./context";
import { useFileSearchRegistry } from "./hooks/useFileSearchRegistry";
import { listVectorStores } from "./service/vectorStores";
import {
  listFileSearchStores,
  pruneFileSearchTools,
  setVectorStoreInChat,
} from "./utils/fileSearch";

interface StoreEntry {
  id: string;
  name: string;
}

interface DocumentsMenuProps {
  onManage: VoidFunction;
}

/**
 * Submenu of the chat options menu listing the user's document collections
 * (vector stores) as toggles, plus an entry to open the management dialog.
 */
export function DocumentsMenu({ onManage }: DocumentsMenuProps) {
  const { t } = useTranslation();
  const { options } = useGlobal();
  const { registry, updateRegistry, isInChat } = useFileSearchRegistry();
  const [stores, setStores] = useState<StoreEntry[] | null>(null);

  const loadStores = async () => {
    try {
      const loaded = await listVectorStores(options);
      setStores(loaded.map(({ id, name }) => ({ id, name })));
      updateRegistry((current) =>
        pruneFileSearchTools(
          current,
          loaded.map((store) => store.id)
        )
      );
    } catch (error) {
      // Fall back to the collections known from the tool registry.
      console.error("Could not load vector stores: %o", error);
    }
  };

  const entries = stores ?? listFileSearchStores(registry.tools);

  return (
    <Menu.Root
      positioning={{ placement: "right-start", gutter: 2 }}
      onOpenChange={(event) => {
        if (event.open) void loadStores();
      }}
    >
      <Menu.TriggerItem data-testid="documents-menu-trigger">
        {t("documents_menu")} <LuChevronRight />
      </Menu.TriggerItem>
      <Portal>
        <Menu.Positioner>
          <Menu.Content
            _open={{ animation: "none" }}
            _closed={{ animation: "none" }}
          >
            <Menu.Item
              value="manage_vector_stores"
              onClick={onManage}
              data-testid="vector-stores-manage"
            >
              {t("vector_stores_manage_short")}
            </Menu.Item>
            {entries.length > 0 && <Menu.Separator />}
            {entries.map((store) => (
              <Menu.CheckboxItem
                key={store.id}
                value={store.id}
                checked={isInChat(store.id)}
                // Keep the menu open to toggle several collections at once.
                closeOnSelect={false}
                onCheckedChange={(checked) =>
                  updateRegistry((current) =>
                    setVectorStoreInChat(current, store, checked)
                  )
                }
                data-testid={`documents-menu-store-${store.id}`}
              >
                <Menu.ItemIndicator />
                {store.name}
              </Menu.CheckboxItem>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
