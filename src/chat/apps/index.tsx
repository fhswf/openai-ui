import React, { useState } from "react";
import { Button, Card, Heading, HStack, IconButton, Link, Text } from "@chakra-ui/react";
import { AppsProvider, useApps } from "./context";
import { useGlobal } from "../context";
import { classnames } from "../../components/utils";
import styles from "./apps.module.less";
import { useTranslation } from "react-i18next";
import { AppEditor } from "./AppEditor";
import { LuPencil, LuTrash2, LuShare2, LuPlus } from "react-icons/lu";
import { toaster } from "../components/ui/toaster";

export function AppItem(props) {
  const { t } = useTranslation();
  const { setCurrent, apps, deleteApp, userApps } = useApps();
  const { setApp, newChat, currentApp } = useGlobal();
  const [isEditing, setIsEditing] = useState(false);

  const { category, id } = props;
  const app = apps.find((item) => item.id === id);
  const isUserDefined = userApps?.some((item) => item.id === id);

  const handleShare = () => {
    const json = JSON.stringify(app);
    const encoded = btoa(json);
    const shareUrl = `${globalThis.location.origin}${globalThis.location.pathname}?template=${encoded}`;
    navigator.clipboard.writeText(shareUrl);
    toaster.create({
      title: t("Link copied to clipboard"),
      type: "success",
    });
  };

  return (
    <Card.Root variant={currentApp?.id === props?.id ? "elevated" : "subtle"} marginBottom={4}>
      <Card.Header>
        <HStack justify="space-between" width="100%">
          <Card.Title>{props.title}</Card.Title>
          {isUserDefined && (
            <HStack gap={1}>
              <IconButton
                aria-label="Edit"
                size="xs"
                variant="ghost"
                onClick={() => setIsEditing(true)}
              >
                <LuPencil />
              </IconButton>
              <IconButton
                aria-label="Share"
                size="xs"
                variant="ghost"
                onClick={handleShare}
              >
                <LuShare2 />
              </IconButton>
              <IconButton
                aria-label="Delete"
                size="xs"
                variant="ghost"
                colorPalette="red"
                onClick={() => deleteApp(id)}
              >
                <LuTrash2 />
              </IconButton>
            </HStack>
          )}
        </HStack>
      </Card.Header>
      <Card.Body>
        <Card.Description hyphens="auto">{props.desc}</Card.Description>
      </Card.Body>
      <Card.Footer flexDirection={"row"} justifyContent={"flex-end"}>
        <Button
          variant="solid"
          colorPalette="blue"
          onClick={() => {
            setApp(app);
            newChat(app);
          }}
        >
          {t("Start Chat")}
        </Button>
      </Card.Footer>
      <AppEditor 
        app={app} 
        isOpen={isEditing} 
        onClose={() => setIsEditing(false)} 
      />
    </Card.Root>
  );
}

export function Category(props) {
  const { apps, category } = useApps();
  const list = apps.filter(
    (item) => item.category === category[props.index].id
  );
  return (
    <div>
      <Heading
        paddingInlineStart={2}
        paddingBlockStart={4}
        paddingBlockEnd={4}
        as="h2"
        size="md"
      >
        <span className={classnames(styles.icon, `ico-${props.icon}`)}></span>
        {props?.title}
      </Heading>
      <div>
        {list.map((item, index) => (
          <AppItem {...item} key={item.id} />
        ))}
      </div>
    </div>
  );
}

export function AppContainer() {
  const { category, apps } = useApps();
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div className={styles.apps} data-testid="AppsList" style={{ padding: '0 16px' }}>
      <HStack justify="space-between" align="center" paddingBlock={4}>
        <Heading as="h1" size="xl">Templates</Heading>
        <Button size="sm" colorPalette="blue" onClick={() => setIsAdding(true)}>
          <LuPlus /> { "Add Template" }
        </Button>
      </HStack>
      {category.map((item, index) => (
        <Category index={index} {...item} key={item.id} />
      ))}
      <AppEditor 
        isOpen={isAdding} 
        onClose={() => setIsAdding(false)} 
      />
    </div>
  );
}

export function Apps() {
  return (
    <AppsProvider>
      <AppContainer />
    </AppsProvider>
  );
}
