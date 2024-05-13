const { isConstructorDeclaration } = require("typescript");

function setupTest(){
  if(Cypress.env('TESTENV') === "PROD"){
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
  else{
    cy.visit("https://openai.ki.fh-swf.de");
    cy.get("button").contains("Cluster Login").click()
    cy.get('input#username').type(Cypress.env("CYPRESS_USER_NAME"));
    cy.get('input#password').type(Cypress.env("CYPRESS_USER_PASSWORD"));
    cy.get("input").contains("Login Cluster").click();
    // Der Code kann noch nicht einloggen, da hier keine Daten reingeschrieben werden
    // Diese werden noch von einem Secret in Github kommen.
  }
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
    cy.getDataTestId("BottomLeftSideBar").find("i").eq(1).click();
    cy.getDataTestId("AppsList").should("not.exist");
    cy.getDataTestId("ConversationList").should("exist", "be.visible");
    cy.getDataTestId("BottomLeftSideBar").find("i").eq(0).click();
    cy.getDataTestId("ConversationList").should("not.exist");
    cy.getDataTestId("AppsList").should("exist", "be.visible");
  });

  it("Conversation search bar input works", () => {
    cy.getDataTestId("ConversationSearchBar").find('input').should('exist').then(($input) => {
      cy.wrap($input).type("search input works").should("have.value", "search input works");
    });
  });

  it("Create and edit new conversation", () => {
    cy.getDataTestId("BottomLeftSideBar").find("i").eq(1).click();
    cy.getDataTestId("ConversationCreateBtn").click();
    cy.getDataTestId("HeaderTitle").contains("Dies ist ein neues Gespräch");
    cy.getDataTestId("ConversationList").within(() => {
      cy.get('[data-testid="Conversation"]').eq(0).find('[data-testid="ConversationTitle"]').contains("Dies ist ein neues Gespräch");
      cy.getDataTestId("editConversation").find("i").eq(0).click({ force: true });
      cy.getDataTestId("editConversationTextArea").find("textarea").clear().type("edit conversation text");
      cy.getDataTestId("editConversationSaveBtn").click();
      cy.get('[data-testid="Conversation"]').eq(0).find('[data-testid="ConversationTitle"]').contains("edit conversation text");
    });
    cy.getDataTestId("HeaderTitle").contains("edit conversation text");
  });

  it("Show infos", () => {
    cy.getDataTestId("InformationWindow").should("not.exist");
    cy.getDataTestId("LeftSideBar").find("i").eq(0).click(); //Clicks the Info with the ?
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
    setupTest();
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
    setupTest();
    cy.getDataTestId("OpenConfigBtn").click();
  });

  it("Dark Mode", () => {
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
