import { useEffect, useState } from "react";
import semver from "semver";
import { useGlobal } from "./context";
import { useOptions } from "./hooks";

export interface SidebarReleaseMetadata {
  release?: string;
  build_sha?: string;
}

export function useChatSideBarState(
  onMobileOpenChange: (open: boolean) => void,
  closeAbout: VoidFunction
) {
  const { is, setState, options, version, release } = useGlobal();
  const { setGeneral, setAccount } = useOptions();
  const [metadata, setMetadata] = useState<SidebarReleaseMetadata>({});

  const acceptTerms = () => {
    closeAbout();
    setAccount({ terms: true });
  };

  const toggleTheme = () => {
    const currentTheme =
      document.documentElement.dataset.theme ?? options.general.theme;
    setGeneral({ theme: currentTheme === "light" ? "dark" : "light" });
    onMobileOpenChange(false);
  };

  const toggleConfig = () => {
    setState({ is: { ...is, config: !is.config } });
    onMobileOpenChange(false);
  };

  const toggleFullScreen = () => {
    setState({ is: { ...is, fullScreen: !is.fullScreen } });
    onMobileOpenChange(false);
  };

  useEffect(() => {
    fetch("/metadata.json", { cache: "no-cache" })
      .then((response) => response.json())
      .then((data) => {
        console.log(data);
        setMetadata(data);
        if (semver.gt(data.release, version) || !release) {
          console.log("New release: %s", data.release);
          setState({ version: data.release });
          fetch(`${data.repo_url}/releases/tags/openai-ui-v${data.release}`)
            .then((response) => response.json())
            .then((data) => {
              console.log("release data: %j", data);
              setState({ release: data });
            })
            .catch((error) => {
              console.error("Error fetching release data: %s", error);
            });
        }
      });
  }, [version]);

  return {
    acceptTerms,
    is,
    metadata,
    options,
    toggleConfig,
    toggleFullScreen,
    toggleTheme,
  };
}
