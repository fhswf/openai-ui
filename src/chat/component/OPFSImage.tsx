import React, { useEffect, useRef, useState } from "react";
import { Skeleton } from "@chakra-ui/react";
import styles from "../style/message.module.less";
import classNames from "classnames";
import { getAttachmentStorageId, getOpfsFile } from "../utils/attachments";

export interface OPFSImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    readonly src?: string;
    readonly alt?: string;
    readonly chatId?: string;
    readonly attachmentId?: string;
    readonly fallbackSrc?: string;
}

export function OPFSImage(props: OPFSImageProps) {
    const { src, alt, className, chatId, attachmentId, fallbackSrc, ...rest } = props;
    const [loaded, setLoaded] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [visible, setVisible] = useState(!chatId);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chatId || !containerRef.current || !("IntersectionObserver" in window)) {
            setVisible(true);
            return;
        }
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: "200px" }
        );
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [chatId, src]);

    useEffect(() => {
        let active = true;
        let createdUrl: string | null = null;
        setImageUrl(fallbackSrc || null);
        setLoaded(false);
        if (src?.startsWith("opfs://")) {
            if (!visible) return;
            const filename = src.slice("opfs://".length);
            void (async () => {
                try {
                    const storageId = await getAttachmentStorageId(attachmentId, filename);
                    const file = await getOpfsFile(filename, chatId, storageId);
                    createdUrl = URL.createObjectURL(file);
                    if (active) setImageUrl(createdUrl);
                    else URL.revokeObjectURL(createdUrl);
                } catch (error) {
                    console.error("Error reading attachment:", error);
                }
            })();
        } else {
            setImageUrl(src || null);
            setLoaded(true);
        }

        return () => {
            active = false;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [src, chatId, attachmentId, visible, fallbackSrc]);

    return (
        <div ref={containerRef}>
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={alt || "Image"}
                    className={classNames(styles.image, { [styles.loaded]: loaded }, className)}
                    loading="lazy"
                    onLoad={() => setLoaded(true)}
                    {...rest}
                />
            ) : (
                <Skeleton className={classNames(styles.image, className)} />
            )}
        </div>
    );
}
