import React, { useEffect, useState } from "react";
import { Skeleton } from "@chakra-ui/react";
import styles from "../style/message.module.less";
import classNames from "classnames";

export interface OPFSImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    readonly src?: string;
    readonly alt?: string;
}

export function OPFSImage(props: OPFSImageProps) {
    const { src, alt, className, ...rest } = props;
    const [loaded, setLoaded] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        if (src?.startsWith("opfs://")) {
            const filename = src.replace("opfs://", "");
            navigator.storage
                .getDirectory()
                .then(async (opfs) => {
                    try {
                        const fileHandle = await opfs.getFileHandle(filename);
                        const file = await fileHandle.getFile();
                        const url = URL.createObjectURL(file);
                        if (active) {
                            setImageUrl(url);
                            setLoaded(true);
                        } else {
                            URL.revokeObjectURL(url);
                        }
                    } catch (error) {
                        console.error("Error reading file from OPFS:", error);
                    }
                })
                .catch((error) => {
                    console.error("Error getting OPFS directory:", error);
                });
        } else {
            setImageUrl(src || null);
            setLoaded(true);
        }

        return () => {
            active = false;
            if (imageUrl?.startsWith("blob:")) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [src]);

    if (!imageUrl) {
        return <Skeleton className={classNames(styles.image, className)} />;
    }

    return (
        <img
            src={imageUrl}
            alt={alt || "Image"}
            className={classNames(styles.image, { [styles.loaded]: loaded }, className)}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            {...rest}
        />
    );
}
