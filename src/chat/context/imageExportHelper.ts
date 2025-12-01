
async function processImageForExport(c: any, opfs: FileSystemDirectoryHandle | null): Promise<string> {
    if (c.type === "input_text") return c.text;
    if (c.type === "input_image") {
        let imageUrl = c.image_url;
        if (imageUrl?.startsWith("opfs://") && opfs) {
            try {
                const filename = imageUrl.replace("opfs://", "");
                const fileHandle = await opfs.getFileHandle(filename);
                const file = await fileHandle.getFile();
                const reader = new FileReader();
                imageUrl = await new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(file);
                });
            } catch (e) {
                console.error("Failed to read OPFS file for export:", e);
                // Fallback to original URL or placeholder if needed
            }
        }
        return `![Image](${imageUrl})`;
    }
    return "";
}
