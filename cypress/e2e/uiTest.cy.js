const { isConstructorDeclaration } = require("typescript");

function setupTest() {
  if (Cypress.env('TESTENV') === "PROD") {
    cy.visit("https://openai.ki.fh-swf.de");
    cy.get("button").contains("Cluster Login").click()
    cy.get('input#username').type(Cypress.env("CYPRESS_USER_NAME"));
    cy.get('input#password').type(Cypress.env("CYPRESS_USER_PASSWORD"));
    cy.get("input").contains("Login Cluster").click();
  }
  else { // if its not prod, then it selects ci
    cy.intercept('GET', "https://www.gravatar.com/8e596ec8846c54f583994b3773e0c4afc16414733b9640b29b546a41b169dcd1");
    cy.intercept('GET', "https://de.gravatar.com/8e596ec8846c54f583994b3773e0c4afc16414733b9640b29b546a41b169dcd1");
    cy.intercept('GET', 'https://openai.ki.fh-swf.de/api/user', { fixture: 'testUser.json' }).as('getUser');
    cy.intercept('GET', "https://openai.ki.fh-swf.de/api/login")
      .then((req) => {
        console.log(req);
      });
    cy.visit("http://localhost:5173/");
    cy.wait('@getUser', { timeout: 15000 });
  }
  cy.get('[data-testid="accept-terms-btn"]').then(($btn) => {
    if ($btn) {
      cy.get($btn).click();
    }
  });
}

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
    cy.getDataTestId("ConversationList").should("not.exist");
    cy.getDataTestId("btn_history").click();
    cy.getDataTestId("AppsList").should("not.exist");
    cy.getDataTestId("ConversationList").should("exist", "be.visible");
    cy.getDataTestId("btn_apps").click();
    cy.getDataTestId("ConversationList").should("not.exist");
    cy.getDataTestId("AppsList").should("exist", "be.visible");
  });

  it("Conversation search bar input works", () => {
    cy.getDataTestId("ConversationSearchBar").find('input').should('exist').then(($input) => {
      cy.wrap($input).type("search input works").should("have.value", "search input works");
    });
  });

  it("Create and edit new conversation", () => {
    cy.getDataTestId("btn_history").click();
    cy.getDataTestId("ConversationCreateBtn").click();
    cy.getDataTestId("ConversationList").within(() => {
      cy.getDataTestId("editConversation").eq(0).click({ force: true });
      cy.getDataTestId("editConversationTextArea").clear().type("test title");
      cy.getDataTestId("editConversationSaveBtn").click();
      cy.getDataTestId("ConversationTitle").contains("test title");
    });
    cy.getDataTestId("HeaderTitle").contains("test title");
  });

  it("Show infos", () => {
    cy.getDataTestId("InformationWindow").should("not.exist");
    cy.getDataTestId("aboutBtn").click(); //Clicks the Info with the ?
    cy.getDataTestId("InformationWindow").should("be.visible");
    cy.getDataTestId("InformationWindow").should("exist");
  });
});

describe("Dark Mode", () => {
  beforeEach(() => {
    setupTest();
  });

  it("Down Left Button", () => {
    cy.get("html").should("have.attr", "data-theme", "light");
    cy.getDataTestId("OptionDarkModeSelect").click();
    cy.get("html").should("have.attr", "data-theme", "dark");
    cy.getDataTestId("OptionDarkModeSelect").click();
    cy.get("html").should("have.attr", "data-theme", "light");
  });

  it("In Settings", () => {
    cy.getDataTestId("OpenConfigBtn").click();
    cy.get("html").should("have.attr", "data-theme", "light");
    cy.getDataTestId("OptionDarkModeSelect").get('[type="radio"]').check("dark", { force: true })
    cy.get("html").should("have.attr", "data-theme", "dark");
    cy.getDataTestId("OptionDarkModeSelect").get('[type="radio"]').check("light", { force: true })
    cy.get("html").should("have.attr", "data-theme", "light");
  });
});

describe("User Information", () => {
  beforeEach(() => {
    setupTest();
  });

  it("Open and close user information", () => {
    cy.getDataTestId("UserInformation").should("not.be.visible");
    cy.getDataTestId("UserInformationBtn").click();
    cy.getDataTestId("UserInformation").should("be.visible", "exist");
    cy.getDataTestId("UserInformationBtn").click();
    cy.getDataTestId("UserInformation").should("not.be.visible");
  });
});

describe("Config Menu", () => {
  beforeEach(() => {
    setupTest();
    cy.getDataTestId("OpenConfigBtn").click();
  });

  it("Dark Mode", () => {
    cy.get("html").should("have.attr", "data-theme", "light");
    cy.getDataTestId("OptionDarkModeSelect").get('[type="radio"]').check("dark", { force: true });
    cy.get("html").should("have.attr", "data-theme", "dark");
    cy.getDataTestId("OptionDarkModeSelect").get('[type="radio"]').check("light", { force: true });
    cy.get("html").should("have.attr", "data-theme", "light");
  });

  /*
  it("Change Send Message Button", () => {
    cy.getDataTestId("SendMessageSelect").select("COMMAND_ENTER").should("have.value", "COMMAND_ENTER");
    cy.getDataTestId("SendMessageSelect").select("ALT_ENTER").should("have.value", "ALT_ENTER");
    cy.getDataTestId("SendMessageSelect").select("ENTER").should("have.value", "ENTER");
  });
  */

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
    //cy.getDataTestId('SettingsHeader').find('h5').should('have.css', 'font-size', '12px');
    cy.getDataTestId("ChangeFontSizeSelect").select("Small").should("have.value", "small");
    //cy.getDataTestId('SettingsHeader').find('h5').should('have.css', 'font-size', '12px');
    cy.getDataTestId("ChangeFontSizeSelect").select("Default").should("have.value", "default");
    //cy.getDataTestId('SettingsHeader').find('h5').should('have.css', 'font-size', '14px');
    cy.getDataTestId("ChangeFontSizeSelect").select("Middle").should("have.value", "middle");
    //cy.getDataTestId('SettingsHeader').find('h5').should('have.css', 'font-size', '13px');
    cy.getDataTestId("ChangeFontSizeSelect").select("Large").should("have.value", "large");
    //cy.getDataTestId('SettingsHeader').find('h5').should('have.css', 'font-size', '16px');
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
