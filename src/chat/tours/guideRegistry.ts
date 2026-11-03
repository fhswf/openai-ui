export type TourPreparation =
  | "open-mobile-header-actions"
  | "open-settings-navigation"
  | "open-history"
  | "open-chat-options"
  | "open-mcp-services-dialog"
  | "open-settings";

export interface FeatureTourStep {
  target: string;
  titleKey: string;
  bodyKey: string;
  prepare?: TourPreparation;
}

export interface FeatureGuide {
  id: string;
  revision: number;
  announceIn: string;
  titleKey: string;
  descriptionKey: string;
  steps: FeatureTourStep[];
}

// Keep IDs stable. Increase a guide's revision and update announceIn when its
// instructions change enough that people should see the guide again.
export const featureGuides: FeatureGuide[] = [
  {
    id: "chat-history-search",
    revision: 1,
    announceIn: "0.60.0",
    titleKey: "tour_history_title",
    descriptionKey: "tour_history_description",
    steps: [
      {
        target: "chat-history-trigger",
        titleKey: "tour_history_step1_title",
        bodyKey: "tour_history_step1_body",
        prepare: "open-mobile-header-actions",
      },
      {
        target: "chat-history-search",
        titleKey: "tour_history_step2_title",
        bodyKey: "tour_history_step2_body",
        prepare: "open-history",
      },
    ],
  },
  {
    id: "document-search",
    revision: 2,
    announceIn: "0.60.0",
    titleKey: "tour_documents_title",
    descriptionKey: "tour_documents_description",
    steps: [
      {
        target: "chat-options-trigger",
        titleKey: "tour_documents_step1_title",
        bodyKey: "tour_documents_step1_body",
        prepare: "open-mobile-header-actions",
      },
      {
        target: "documents-menu-trigger",
        titleKey: "tour_documents_step2_title",
        bodyKey: "tour_documents_step2_body",
        prepare: "open-chat-options",
      },
    ],
  },
  {
    id: "custom-gpt-profiles",
    revision: 1,
    announceIn: "0.60.0",
    titleKey: "tour_custom_gpt_title",
    descriptionKey: "tour_custom_gpt_description",
    steps: [
      {
        target: "settings-trigger",
        titleKey: "tour_custom_gpt_step1_title",
        bodyKey: "tour_custom_gpt_step1_body",
        prepare: "open-settings-navigation",
      },
      {
        target: "custom-gpt-settings",
        titleKey: "tour_custom_gpt_step2_title",
        bodyKey: "tour_custom_gpt_step2_body",
        prepare: "open-settings",
      },
    ],
  },
  {
    id: "mcp-services",
    revision: 2,
    announceIn: "0.60.0",
    titleKey: "tour_mcp_title",
    descriptionKey: "tour_mcp_description",
    steps: [
      {
        target: "chat-options-trigger",
        titleKey: "tour_mcp_step1_title",
        bodyKey: "tour_mcp_step1_body",
        prepare: "open-mobile-header-actions",
      },
      {
        target: "mcp-services-menu-trigger",
        titleKey: "tour_mcp_step2_title",
        bodyKey: "tour_mcp_step2_body",
        prepare: "open-chat-options",
      },
      {
        target: "mcp-service-identity-fields",
        titleKey: "tour_mcp_step3_title",
        bodyKey: "tour_mcp_step3_body",
        prepare: "open-mcp-services-dialog",
      },
      {
        target: "mcp-tool-access-settings",
        titleKey: "tour_mcp_step4_title",
        bodyKey: "tour_mcp_step4_body",
        prepare: "open-mcp-services-dialog",
      },
      {
        target: "mcp-auth-settings",
        titleKey: "tour_mcp_step5_title",
        bodyKey: "tour_mcp_step5_body",
        prepare: "open-mcp-services-dialog",
      },
      {
        target: "mcp-service-save",
        titleKey: "tour_mcp_step6_title",
        bodyKey: "tour_mcp_step6_body",
        prepare: "open-mcp-services-dialog",
      },
      {
        target: "mcp-configured-services",
        titleKey: "tour_mcp_step7_title",
        bodyKey: "tour_mcp_step7_body",
        prepare: "open-mcp-services-dialog",
      },
    ],
  },
  {
    id: "encrypted-chat-storage",
    revision: 1,
    announceIn: "0.60.0",
    titleKey: "tour_encrypted_storage_title",
    descriptionKey: "tour_encrypted_storage_description",
    steps: [
      {
        target: "settings-trigger",
        titleKey: "tour_encrypted_storage_step1_title",
        bodyKey: "tour_encrypted_storage_step1_body",
        prepare: "open-settings-navigation",
      },
      {
        target: "encrypted-storage-setting",
        titleKey: "tour_encrypted_storage_step2_title",
        bodyKey: "tour_encrypted_storage_step2_body",
        prepare: "open-settings",
      },
    ],
  },
];

export function getFeatureGuide(id: string | null | undefined) {
  return featureGuides.find((guide) => guide.id === id);
}
