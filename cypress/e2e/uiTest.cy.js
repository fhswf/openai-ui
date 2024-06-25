const { isConstructorDeclaration } = require("typescript");
import { setupTest } from '../support/commands.ts';

describe("User Interface", () => {
  beforeEach(() => {
    setupTest();
  });

  it("Check the headline", () => {
    cy.getDataTestId("HeaderTitle").contains(
      "K!mpuls"
    );
  });

  it("Hide and show the conversation sidebar", () => {
    cy.getDataTestId("ConversationSideBar").should("exist");
    cy.getDataTestId("ConversationSideBarBtn").click();
    cy.getDataTestId("ConversationSideBar").should("not.exist");
    cy.getDataTestId("ConversationSideBarBtn").click();
    cy.getDataTestId("ConversationSideBar").should("exist");
  });

  it("Switching between Apps and History", () => {
    cy.getDataTestId("AppsList").should("exist", "be.visible");
    cy.getDataTestId("HistoryList").should("not.exist");
    cy.getDataTestId("HistoryBtn").click();
    cy.getDataTestId("AppsList").should("not.exist");
    cy.getDataTestId("HistoryList").should("exist", "be.visible");
    cy.getDataTestId("AppsBtn").click();
    cy.getDataTestId("HistoryList").should("not.exist");
    cy.getDataTestId("AppsList").should("exist", "be.visible");
  });

  it("Create and edit new conversation", () => {
    cy.getDataTestId("HistoryBtn").click();
    cy.getDataTestId("ConversationCreateBtn").click();
    cy.getDataTestId("HeaderTitle").contains("Dies ist ein neues Gespräch");
    cy.getDataTestId("HistoryList").within(() => {
      cy.getDataTestId("Conversation").eq(0).find('[data-testid="ConversationTitle"]').contains("Dies ist ein neues Gespräch");
      cy.getDataTestId("editConversation").find("i").eq(0).click({ force: true });
      cy.getDataTestId("editConversationTextArea").find("textarea").clear().type("edit conversation text");
      cy.getDataTestId("editConversationSaveBtn").click();
      cy.getDataTestId("Conversation").eq(0).find('[data-testid="ConversationTitle"]').contains("edit conversation text");
    });
    cy.getDataTestId("HeaderTitle").contains("edit conversation text");
  });

  it("Show infos", () => {
    cy.getDataTestId("InformationWindow").should("not.exist");
    cy.getDataTestId("InformationWindowBtn").click();
    cy.getDataTestId("InformationWindow").should("be.visible", "exist");
    cy.getDataTestId("InformationWindowCloseBtn").click(); 
    cy.getDataTestId("InformationWindow").should("not.exist");
  });

  it("Open and close user information", () => {
    cy.getDataTestId("UserInformation").should("not.exist");
    cy.getDataTestId("UserInformationBtn").click();
    cy.getDataTestId("UserInformation").should("be.visible", "exist");
    cy.getDataTestId("UserInformationCloseBtn").click();
    cy.getDataTestId("UserInformation").should("not.exist");
  });

  it("Dark Mode Homepage", () => {
    cy.get("html").should("have.attr", "data-theme", "light");
    cy.getDataTestId("DarkModeBottomLeftBtn").click();
    cy.get("html").should("have.attr", "data-theme", "dark");
    cy.getDataTestId("DarkModeBottomLeftBtn").click();
    cy.get("html").should("have.attr", "data-theme", "light");
  });
});

describe("Config Menu", () => {
  beforeEach(() => {
    setupTest();
    cy.getDataTestId("OpenConfigBtn").click();
  });

  it("Dark Mode Settings", () => {
    cy.get("html").should("have.attr", "data-theme", "light");
    cy.getDataTestId("OptionDarkModeSelect").select("dark");
    cy.get("html").should("have.attr", "data-theme", "dark");
    cy.getDataTestId("OptionDarkModeSelect").select("light");
    cy.get("html").should("have.attr", "data-theme", "light");
  });

  it("Change Send Message Button", () => {
    cy.getDataTestId("SendMessageSelect").select("COMMAND_ENTER").should("have.value", "COMMAND_ENTER");
    cy.getDataTestId("SendMessageSelect").select("ALT_ENTER").should("have.value", "ALT_ENTER");
    cy.getDataTestId("SendMessageSelect").select("ENTER").should("have.value", "ENTER");
  });

  it("Set top P input", () => {
    cy.getDataTestId('SetTopPInput').clear().should("have.value", "0").type("{selectall}1024").should("have.value", "1024");
  });

  it("Set api base url input", () => {
    cy.getDataTestId('ApiBaseURLInput').clear().should("have.value", "").type("a_cypress_input_test").should("have.value", "a_cypress_input_test");
  });

  it("Set api key input", () => {
    cy.getDataTestId('APIKeyInput').clear().should("have.value", "").type("a_cypress_input_test").should("have.value", "a_cypress_input_test");
  });

  it("Set organisation id input", () => {
    cy.getDataTestId('APIOrganisationIDInput').clear().should("have.value", "").type("a_cypress_id_test").should("have.value", "a_cypress_id_test");
  });

  it("Change Fontsize", () => {
    cy.getDataTestId('SettingsHeader').find('h2').should('have.css', 'font-size', '14.4px');
    cy.getDataTestId("ChangeFontSizeSelect").select("Small").should("have.value", "small");
    cy.getDataTestId('SettingsHeader').find('h2').should('have.css', 'font-size', '14.4px');
    cy.getDataTestId("ChangeFontSizeSelect").select("Default").should("have.value", "default");
    cy.getDataTestId('SettingsHeader').find('h2').should('have.css', 'font-size', '16.8px');
    cy.getDataTestId("ChangeFontSizeSelect").select("Middle").should("have.value", "middle");
    cy.getDataTestId('SettingsHeader').find('h2').should('have.css', 'font-size', '15.6px');
    cy.getDataTestId("ChangeFontSizeSelect").select("Large").should("have.value", "large");
    cy.getDataTestId('SettingsHeader').find('h2').should('have.css', 'font-size', '19.2px');
  });

  it("Change OpenAI Model", () => {
    cy.getDataTestId('ChangeAIModelSelect').select("gpt-4-turbo").should("have.value", "gpt-4-turbo");
    cy.getDataTestId('ChangeAIModelSelect').select("gpt-4").should("have.value", "gpt-4");
    cy.getDataTestId('ChangeAIModelSelect').select("gpt-3.5-turbo").should("have.value", "gpt-3.5-turbo");
  });

  it("Set max tokens input", () => {
    cy.getDataTestId('MaxTokensInput').clear().should("have.value", "0").type("{selectall}1024").should("have.value", "1024");
  });

  it("Set temperature input", () => {
    cy.getDataTestId('SetTemperatureInput').clear().should("have.value", "0").type("{selectall}1024").should("have.value", "1024");
  });

  it("Set top P input", () => {
    cy.getDataTestId('SetTopPInput').clear().should("have.value", "0").type("{selectall}1024").should("have.value", "1024");
  });

  it("Set api base url input", () => {
    cy.getDataTestId('ApiBaseURLInput').clear().should("have.value", "").type("a_cypress_input_test").should("have.value", "a_cypress_input_test");
  });

  it("Set api key input", () => {
    cy.getDataTestId('APIKeyInput').clear().should("have.value", "").type("a_cypress_input_test").should("have.value", "a_cypress_input_test");
  });

  it("Set organisation id input", () => {
    cy.getDataTestId('APIOrganisationIDInput').clear().should("have.value", "").type("a_cypress_id_test").should("have.value", "a_cypress_id_test");
  });

  it("Close the settings", () => {
    cy.getDataTestId("SettingsCloseBtn").click();
    cy.getDataTestId("SettingsContainer").should("not.exist");
  })
});