const { isConstructorDeclaration } = require("typescript");

describe("User Interface", () => {
  beforeEach(() => {
    cy.intercept('GET', 'https://openai.ki.fh-swf.de/api/user', { fixture: 'testUser.json' }).as('getUser');
    cy.intercept('GET', "https://openai.ki.fh-swf.de/api/login")
      .then((req) => {
        console.log(req);
      });
    cy.visit("http://localhost:5173/");
    cy.wait('@getUser', { timeout: 15000 });
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

  it("Conversation search bar input works", () => {
    cy.getDataTestId("ConversationSearchBar").find('input').should('exist').then(($input) => {
      cy.wrap($input).type("search input works").should("have.value", "search input works");
    });
  });
});

describe("Dark Mode", () => {
  beforeEach(() => {
    cy.intercept('GET', 'https://openai.ki.fh-swf.de/api/user', { fixture: 'testUser.json' }).as('getUser');
    cy.visit("http://localhost:5173/");
    cy.wait('@getUser');
  });

  it("Down Left Button", () => {
    cy.get("html").should("have.attr", "data-theme", "light");
    cy.getDataTestId("BottomLeftSideBar").find("i").eq(2).click();
    cy.get("html").should("have.attr", "data-theme", "dark");
    cy.getDataTestId("BottomLeftSideBar").find("i").eq(2).click();
    cy.get("html").should("have.attr", "data-theme", "light");
  });

  it("In Settings", () => {
    cy.getDataTestId("BottomLeftSideBar").find("i").eq(3).click();
    cy.get("html").should("have.attr", "data-theme", "light");
    cy.getDataTestId("OptionDarkModeSelect").select("dark");
    cy.get("html").should("have.attr", "data-theme", "dark");
    cy.getDataTestId("OptionDarkModeSelect").select("light");
    cy.get("html").should("have.attr", "data-theme", "light");
  });
});

describe("User Information", () => {
  beforeEach(() => {
    cy.intercept('GET', 'https://openai.ki.fh-swf.de/api/user', { fixture: 'testUser.json' }).as('getUser');
    cy.visit("http://localhost:5173/");
    cy.wait('@getUser');
  });

  it("Open and close user information", () => {
    cy.getDataTestId("UserInformation").should("not.exist");
    cy.getDataTestId("UserInformationBtn").click();
    cy.getDataTestId("UserInformation").should("be.visible", "exist");
    cy.getDataTestId("UserInformationCloseBtn").click();
    cy.getDataTestId("UserInformation").should("not.exist");
  });
});

describe("Config Menu", () => {
  beforeEach(() => {
    cy.intercept('GET', 'https://openai.ki.fh-swf.de/api/user', { fixture: 'testUser.json' }).as('getUser');
    cy.visit("http://localhost:5173/");
    cy.wait("@getUser");
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
    //cy.getDataTestId("ChatTextArea").should("have.text", "");
    cy.wait(2000);
    cy.getDataTestId("ChatListContainer").should("be.visible");
    cy.getDataTestId("ChatMessage").each((message) => {
      cy.wrap(message).should("contain.text", "Cypress wrote this!");
    });
    cy.getDataTestId("ChatTextArea").click().type("Cypress also wrote this!");
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
    // Send message
    cy.getDataTestId("SendMessageBtn").click();
    cy.getDataTestId("ChatListContainer").find('[data-testid="ChatMessage"]').should('exist');

    // Clear chatlog
    cy.getDataTestId("ClearMessageBtn").click();
    cy.getDataTestId("ChatListContainer").should('not.exist');

    // Check if message can be sent again
    const message = "Cypress wrote this!";
    cy.getDataTestId("ChatTextArea").type(message).should("have.value", message);
    cy.getDataTestId("SendMessageBtn").click();
    cy.getDataTestId("ChatListContainer").should('exist');
  });

});
