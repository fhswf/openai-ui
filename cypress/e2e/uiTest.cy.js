const { isConstructorDeclaration } = require("typescript");
import { setupTest } from '../support/commands.ts';

describe("Homepage", () => {
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

  it("Check Settings Menu", () => {
    cy.getDataTestId("SettingsMenu").should("exist");
  })

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
    cy.getDataTestId("SettingsMenu").should("exist");
    cy.getDataTestId("SettingsCloseBtn").click();
    cy.getDataTestId("SettingsMenu").should("not.exist");
  })
});

describe("Chat", () => {
  beforeEach(() => {
    setupTest();
    cy.getDataTestId("ChatTextArea").click().type("Cypress wrote this!").should("have.text", "Cypress wrote this!");
  });

  it("Sending a message with the send button", () => {
    cy.getDataTestId("SendMessageBtn").click();
    cy.getDataTestId("ChatTextArea").should("have.text", "");
    cy.getDataTestId("ChatListContainer").should("be.visible");
    cy.getDataTestId("ChatMessage").each((message) => {
      cy.wrap(message).should("contain.text", "Cypress wrote this!");
    });
  });

  it("Sending 2 messages and checking if both are in the chat", () => {
    cy.getDataTestId("SendMessageBtn").click();
    cy.getDataTestId("ChatTextArea").should("have.text", "");
    cy.getDataTestId("ChatListContainer").should("be.visible");
    cy.getDataTestId("ChatTextArea").type("Cypress also wrote this!");
    cy.getDataTestId("ChatTextArea").should(
      "have.text",
      "Cypress also wrote this!"
    );
    cy.getDataTestId("SendMessageBtn").click();
    cy.getDataTestId("ChatListContainer").should("be.visible");

    cy.getDataTestId("ChatListContainer").within(() => {
      // Überprüfe die erste Nachricht
      cy.getDataTestId("ChatMessage")
        .eq(0)
        .should("contain", "Cypress wrote this!");

      // Überprüfe die zweite Nachricht
      cy.getDataTestId("ChatMessage")
        .eq(1)
        .should("contain", "Cypress also wrote this!");
    });
  });

  it("Sending a message with enter", () => {
    cy.getDataTestId("ChatTextArea").click().type("{enter}");
    //cy.getDataTestId("ChatTextArea").should("have.text", "");
    cy.getDataTestId("ChatListContainer").should("be.visible");
    cy.getDataTestId("ChatMessage").each((message) => {
      cy.wrap(message).should("contain.text", "Cypress wrote this!");
    });
  });

  it("Changing the message sending to ctrl+enter and sending it", () => {
    // Change message sending method to use ctrl+enter
    cy.getDataTestId("OpenConfigBtn").click();
    cy.getDataTestId("SendMessageSelect").select("COMMAND_ENTER");
    cy.getDataTestId("SettingsCloseBtn").click();

    // Try sending message using Enter
    cy.getDataTestId("ChatTextArea").click().type("{enter}").should("have.text", "Cypress wrote this!");

    // Send message using ctrl+Enter
    cy.getDataTestId("ChatTextArea").click().type("{ctrl}{enter}").should("have.text", "");

    // Check if the message has been sent
    cy.getDataTestId("ChatMessage").each((message) => {
      cy.wrap(message).should("contain.text", "Cypress wrote this!");
    });
  });
});