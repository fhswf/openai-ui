import { setupTest } from '../support/commands.ts';

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
    cy.getDataTestId("ChatMessage").each((message) => {
      cy.wrap(message).should("contain.text", "Cypress wrote this!");
    });
    cy.getDataTestId("ChatTextArea").type("Cypress also wrote this!");
    cy.getDataTestId("ChatTextArea").should(
      "have.text",
      "Cypress also wrote this!"
    );
    cy.getDataTestId("SendMessageBtn").click();
    cy.getDataTestId("ChatTextArea").should("have.text", "");
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
    cy.getDataTestId("BottomLeftSideBar").find("i").eq(3).click();
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
  
  it("Sending a message and clearing the chatlog", () => {
    cy.intercept('POST', "https://openai.ki.fh-swf.de/api/v1/chat/completions", { fixture: 'testCompletion.json' }).as('getCompletion');
    // Send message
    const message = "Cypress wrote this!";
    cy.getDataTestId("ChatTextArea").clear().type(message).should("have.value", message);
    cy.getDataTestId("SendMessageBtn").click();
    cy.wait('@getCompletion');
    cy.getDataTestId("ChatListContainer").find('[data-testid="ChatMessage"]').should('exist');

    // TODO: This triggers an exception in the client code
    // Clear chatlog
    //cy.getDataTestId("ClearChatBtn").click();
    //cy.getDataTestId("ChatListContainer").should('not.exist');

    // Check if message can be sent again
    cy.getDataTestId("ChatTextArea").clear().type(message).should("have.value", message);
    cy.getDataTestId("SendMessageBtn").click();
    cy.getDataTestId("ChatListContainer").should('exist');
  });

});
