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
  cy.get('[data-testid="accept-terms-btn"]').click();
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
    cy.getDataTestId("UserInformation").should("not.exist");
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

  /*
  it("Set top P input", () => {
    cy.getDataTestId('SetTopPInput').clear().should("have.value", "0").type("{selectall}1024").should("have.value", "1024");
  });
  */

  it("Set api base url input", () => {
    cy.getDataTestId('ApiBaseURLInput').clear({ force: true })
    cy.getDataTestId('ApiBaseURLInput').should("have.value", "")
    cy.getDataTestId('ApiBaseURLInput').type("a_cypress_input_test", { force: true })
    cy.getDataTestId('ApiBaseURLInput').should("have.value", "a_cypress_input_test");
  });

  it("Set api key input", () => {
    cy.getDataTestId('APIKeyInput')
      .clear({ force: true }).should("have.value", "")
      .type("a_cypress_input_test", { force: true }).should("have.value", "a_cypress_input_test");
  });

  it("Set organisation id input", () => {
    cy.getDataTestId('APIOrganisationIDInput')
      .clear({ force: true }).should("have.value", "")
      .type("a_cypress_id_test", { force: true }).should("have.value", "a_cypress_id_test");
  });

  /*
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
  */

  /*
  it("Change OpenAI Model", () => {
    cy.getDataTestId('ChangeAIModelSelect').find('button').click();
    cy.get('[data-scope="select"]').contains("gpt-4-turbo").click()
    cy.getDataTestId('ChangeAIModelSelect').find('[data-part="value-text"]').should("have.text", "gpt-4-turbo");

    cy.getDataTestId('ChangeAIModelSelect').find('button').click();
    cy.get('[data-scope="select"]').contains("gpt-4o-mini").click()
    cy.getDataTestId('ChangeAIModelSelect').find('[data-part="value-text"]').should("have.text", "gpt-4o-mini");
  });
  */

  /*
  it("Set max tokens input", () => {
    cy.getDataTestId('MaxTokensInput').clear().should("have.value", "0").type("{selectall}1024").should("have.value", "1024");
  });

  it("Set temperature input", () => {
    cy.getDataTestId('SetTemperatureInput').clear().should("have.value", "0").type("{selectall}1024").should("have.value", "1024");
  });

  it("Set top P input", () => {
    cy.getDataTestId('SetTopPInput').clear().should("have.value", "0").type("{selectall}1024").should("have.value", "1024");
  });
  */

  it("Set api base url input", () => {
    cy.getDataTestId('ApiBaseURLInput')
      .clear({ force: true }).should("have.value", "")
      .type("a_cypress_input_test", { force: true }).should("have.value", "a_cypress_input_test");
  });

  it("Set api key input", () => {
    cy.getDataTestId('APIKeyInput')
      .clear({ force: true }).should("have.value", "")
      .type("a_cypress_input_test", { force: true }).should("have.value", "a_cypress_input_test");
  });

  it("Set organisation id input", () => {
    cy.getDataTestId('APIOrganisationIDInput')
      .clear({ force: true }).should("have.value", "")
      .type("a_cypress_id_test", { force: true }).should("have.value", "a_cypress_id_test");
  });

  it("Close the settings", () => {
    cy.getDataTestId("SettingsCloseBtn").click();
    cy.getDataTestId("SettingsContainer").should("not.exist");
  })
});
